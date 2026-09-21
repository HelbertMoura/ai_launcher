//! Secure provider credential storage.
//!
//! Cross-platform vault layout (L4a):
//! - **Windows** — Credential Manager via `CredWriteW`/`CredReadW`/`CredDeleteW`,
//!   byte-for-byte the same records as v21: generic credential with target
//!   `DevManiacs.AILauncher/<key>`, UTF-8 blob, `UserName = "AI Launcher"`.
//!   The mechanism is intentionally UNCHANGED, so credentials written by older
//!   builds keep reading without any migration step (the roundtrip test below
//!   pins the exact target name and blob encoding).
//! - **macOS** — Keychain via the `keyring` crate (`apple-native`): service
//!   `DevManiacs.AILauncher`, account `<key>`.
//! - **Linux** — Secret Service (libsecret-compatible) via `keyring`
//!   (`sync-secret-service`): same service/account split.
//!
//! Fail-closed: when the platform vault is unavailable the secret commands
//! return `AppError::SecureStorage` — there is no plaintext or file fallback,
//! on any platform. The legacy `secrets.json` (DPAPI) migration remains
//! Windows-only because that file never existed on macOS/Linux.

#[cfg(windows)]
use serde::Deserialize;
use serde::Serialize;

use crate::errors::AppError;

#[cfg(windows)]
const CREDENTIAL_PREFIX: &str = "DevManiacs.AILauncher/";
const MAX_SECRET_KEY_LEN: usize = 240;
/// Key used for the availability probe (read-only; never written).
const AVAILABILITY_PROBE_KEY: &str = "__ail_availability_probe__";

#[cfg(windows)]
const BACKEND_NAME: &str = "windows-credential-manager";
#[cfg(target_os = "macos")]
const BACKEND_NAME: &str = "macos-keychain";
#[cfg(target_os = "linux")]
const BACKEND_NAME: &str = "linux-secret-service";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretStoreResult {
    stored: bool,
    backend: &'static str,
    migrated_legacy: bool,
}

// ============================================================
// SHARED VALIDATION
// ============================================================

fn validate_key(key: &str) -> Result<(), String> {
    if key.is_empty() {
        return Err("A chave do segredo não pode estar vazia".to_string());
    }
    if key.len() > MAX_SECRET_KEY_LEN {
        return Err("A chave do segredo é longa demais".to_string());
    }
    if !key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, ':' | '.' | '_' | '-'))
    {
        return Err("A chave do segredo contém caracteres não suportados".to_string());
    }
    Ok(())
}

#[cfg(windows)]
fn target_name(key: &str) -> Result<String, String> {
    validate_key(key)?;
    Ok(format!("{CREDENTIAL_PREFIX}{key}"))
}

fn secure_storage_error(msg: String) -> AppError {
    AppError::SecureStorage(msg)
}

// ============================================================
// BACKEND — Windows (Credential Manager, unchanged from v21)
// ============================================================

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn credential_write(key: &str, value: &str) -> Result<(), String> {
    use windows_sys::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_MAX_CREDENTIAL_BLOB_SIZE, CRED_PERSIST_LOCAL_MACHINE,
        CRED_TYPE_GENERIC,
    };

    // Persistence model (SEC-005 in .wolf/audit-2026-08-10.md):
    //
    // `CRED_PERSIST_LOCAL_MACHINE` here does NOT mean "shared across every
    // Windows user on this machine". The Windows Credential Manager is a
    // per-user vault: each Windows account only sees its own credentials and
    // cannot enumerate the records of other users (unless they have admin
    // rights and reach for `CredEnumerate` with the right flags). The
    // LOCAL_MACHINE qualifier only controls whether the record survives
    // logoff/reboot — it does NOT broaden the ACL of the underlying vault.
    //
    // Trade-off vs `CRED_PERSIST_ENTERPRISE` (roaming): the roaming flag
    // would mirror the credential across domain-joined devices via the
    // user's Azure AD / Active Directory profile. For a developer-focused
    // launcher that may run on multiple machines per user, ENTERPRISE is
    // arguably the better default — we kept LOCAL_MACHINE for v21 to keep
    // the failure surface small and explicit (no domain dependency). When
    // the user opts in, switch to `CRED_PERSIST_ENTERPRISE` and verify
    // `CredReadW` still succeeds on the target machine. See SEC-005.

    let bytes = value.as_bytes();
    if bytes.len() > CRED_MAX_CREDENTIAL_BLOB_SIZE as usize {
        return Err(format!(
            "O segredo excede o limite de {CRED_MAX_CREDENTIAL_BLOB_SIZE} bytes do Windows Credential Manager"
        ));
    }

    let mut target = wide_null(&target_name(key)?);
    let mut username = wide_null("AI Launcher");
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: target.as_mut_ptr(),
        CredentialBlobSize: bytes.len() as u32,
        CredentialBlob: bytes.as_ptr() as *mut u8,
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: username.as_mut_ptr(),
        ..Default::default()
    };

    let ok = unsafe { CredWriteW(&credential, 0) };
    if ok == 0 {
        return Err(format!(
            "Falha na gravação no Windows Credential Manager: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(windows)]
fn credential_read(key: &str) -> Result<Option<String>, String> {
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND};
    use windows_sys::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let target = wide_null(&target_name(key)?);
    let mut raw: *mut CREDENTIALW = null_mut();
    let ok = unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) };
    if ok == 0 {
        let error = unsafe { GetLastError() };
        if error == ERROR_NOT_FOUND {
            return Ok(None);
        }
        return Err(format!(
            "Falha na leitura do Windows Credential Manager: {}",
            std::io::Error::from_raw_os_error(error as i32)
        ));
    }
    if raw.is_null() {
        return Err("O Windows Credential Manager retornou um registro vazio".to_string());
    }

    let credential = unsafe { &*raw };
    let value = if credential.CredentialBlobSize == 0 {
        String::new()
    } else {
        let bytes = unsafe {
            std::slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            )
        };
        String::from_utf8(bytes.to_vec())
            .map_err(|e| format!("Stored credential is not valid UTF-8: {e}"))?
    };
    unsafe { CredFree(raw.cast()) };
    Ok(Some(value))
}

#[cfg(windows)]
fn credential_delete(key: &str) -> Result<bool, String> {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND};
    use windows_sys::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};

    let target = wide_null(&target_name(key)?);
    let ok = unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) };
    if ok != 0 {
        return Ok(true);
    }
    let error = unsafe { GetLastError() };
    if error == ERROR_NOT_FOUND {
        return Ok(false);
    }
    Err(format!(
        "Falha na exclusão no Windows Credential Manager: {}",
        std::io::Error::from_raw_os_error(error as i32)
    ))
}

#[cfg(windows)]
fn storage_available() -> bool {
    // Real probe, no side effects: Credential Manager answers ERROR_NOT_FOUND
    // for a target that does not exist (proving the vault is reachable);
    // any other failure means the vault is unusable.
    credential_read(AVAILABILITY_PROBE_KEY).is_ok()
}

// ============================================================
// BACKEND — macOS / Linux (keyring crate, fail-closed)
// ============================================================

#[cfg(not(windows))]
const KEYRING_SERVICE: &str = "DevManiacs.AILauncher";

#[cfg(not(windows))]
fn keyring_entry(key: &str) -> Result<keyring::Entry, String> {
    validate_key(key)?;
    keyring::Entry::new(KEYRING_SERVICE, key).map_err(|e| format!("Keyring unavailable: {e}"))
}

#[cfg(not(windows))]
fn credential_write(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring_entry(key)?;
    entry
        .set_password(value)
        .map_err(|e| format!("Keyring write failed: {e}"))
}

#[cfg(not(windows))]
fn credential_read(key: &str) -> Result<Option<String>, String> {
    let entry = keyring_entry(key)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Falha na leitura do keyring: {e}")),
    }
}

#[cfg(not(windows))]
fn credential_delete(key: &str) -> Result<bool, String> {
    let entry = keyring_entry(key)?;
    match entry.delete_credential() {
        Ok(()) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("Falha na exclusão do keyring: {e}")),
    }
}

#[cfg(not(windows))]
fn storage_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        // Fast, non-blocking pre-check: without a session bus the Secret
        // Service cannot exist, so fail immediately instead of letting the
        // keyring probe wait on D-Bus.
        if !dbus_session_bus_likely() {
            return false;
        }
    }
    // Real probe: read a target that never exists. `NoEntry` proves the
    // backend answered; anything else means the vault is unusable.
    match keyring::Entry::new(KEYRING_SERVICE, AVAILABILITY_PROBE_KEY) {
        Ok(entry) => matches!(entry.get_password(), Ok(_) | Err(keyring::Error::NoEntry)),
        Err(_) => false,
    }
}

#[cfg(target_os = "linux")]
fn dbus_session_bus_likely() -> bool {
    if std::env::var_os("DBUS_SESSION_BUS_ADDRESS").is_some() {
        return true;
    }
    if let Some(runtime) = std::env::var_os("XDG_RUNTIME_DIR") {
        return std::path::Path::new(&runtime).join("bus").exists();
    }
    false
}

// ============================================================
// LEGACY MIGRATION (Windows-only: DPAPI secrets.json)
// ============================================================

#[cfg(windows)]
use base64::{engine::general_purpose::STANDARD as B64, Engine};

#[cfg(windows)]
#[derive(Deserialize, Default)]
struct LegacySecretStore {
    encrypted: bool,
    entries: HashMap<String, String>,
}

#[cfg(windows)]
use std::collections::HashMap;

#[cfg(windows)]
use std::fs;

#[cfg(windows)]
use std::path::PathBuf;

#[cfg(windows)]
fn legacy_file() -> Result<PathBuf, String> {
    let base =
        dirs::data_dir().ok_or("Não foi possível determinar o diretório de dados do aplicativo")?;
    Ok(base
        .join("ai-launcher")
        .join("secrets")
        .join("secrets.json"))
}

#[cfg(windows)]
fn load_legacy_store() -> Result<Option<LegacySecretStore>, String> {
    let path = legacy_file()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Falha ao ler o cofre legado de segredos: {e}"))?;
    let store = serde_json::from_str(&content)
        .map_err(|e| format!("Falha ao interpretar o cofre legado de segredos: {e}"))?;
    Ok(Some(store))
}

#[cfg(windows)]
fn save_legacy_store(store: &LegacySecretStore) -> Result<(), String> {
    let path = legacy_file()?;
    if store.entries.is_empty() {
        if path.exists() {
            fs::remove_file(path)
                .map_err(|e| format!("Falha ao remover o cofre legado já migrado: {e}"))?;
        }
        return Ok(());
    }

    let content = serde_json::json!({
        "encrypted": store.encrypted,
        "entries": store.entries,
    });
    fs::write(
        path,
        serde_json::to_vec_pretty(&content)
            .map_err(|e| format!("Falha ao serializar o cofre legado de segredos: {e}"))?,
    )
    .map_err(|e| format!("Falha ao atualizar o cofre legado de segredos: {e}"))
}

#[cfg(windows)]
fn decode_legacy_value(value: &str, encrypted: bool) -> Result<String, String> {
    let bytes = B64
        .decode(value)
        .map_err(|e| format!("Falha ao decodificar o segredo legado: {e}"))?;
    if encrypted {
        return legacy_dpapi_decrypt(bytes);
    }
    String::from_utf8(bytes).map_err(|e| format!("O segredo legado não é UTF-8 válido: {e}"))
}

#[cfg(windows)]
fn migrate_legacy_secret(key: &str) -> Result<Option<String>, String> {
    let Some(mut store) = load_legacy_store()? else {
        return Ok(None);
    };
    let Some(encoded) = store.entries.get(key).cloned() else {
        return Ok(None);
    };

    let plain = decode_legacy_value(&encoded, store.encrypted)?;
    credential_write(key, &plain)?;
    let verified = credential_read(key)?
        .ok_or("A verificação da migração de credenciais não retornou valor")?;
    if verified != plain {
        let _ = credential_delete(key);
        return Err("Falha na verificação da migração de credenciais".to_string());
    }

    store.entries.remove(key);
    save_legacy_store(&store)?;
    Ok(Some(plain))
}

#[cfg(windows)]
fn delete_legacy_secret(key: &str) -> Result<bool, String> {
    let Some(mut store) = load_legacy_store()? else {
        return Ok(false);
    };
    let removed = store.entries.remove(key).is_some();
    if removed {
        save_legacy_store(&store)?;
    }
    Ok(removed)
}

#[cfg(windows)]
fn legacy_dpapi_decrypt(mut cipher: Vec<u8>) -> Result<String, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: cipher.len() as u32,
        pbData: cipher.as_mut_ptr(),
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            null_mut(),
            null(),
            null(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!(
            "Falha ao descriptografar o segredo legado com DPAPI: {}",
            std::io::Error::last_os_error()
        ));
    }

    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) };
    let value = String::from_utf8(bytes.to_vec())
        .map_err(|e| format!("O valor legado DPAPI não é UTF-8 válido: {e}"));
    unsafe {
        LocalFree(output.pbData.cast());
    }
    value
}

/// Windows-only fallback: migrate a DPAPI-protected legacy value on first read.
#[cfg(windows)]
fn legacy_fallback(key: &str) -> Result<Option<String>, AppError> {
    migrate_legacy_secret(key).map_err(secure_storage_error)
}

/// macOS/Linux have no legacy secrets.json (it was DPAPI/Windows-only), so the
/// legacy step is a no-op that never touches disk.
#[cfg(not(windows))]
fn legacy_fallback(_key: &str) -> Result<Option<String>, AppError> {
    Ok(None)
}

// ============================================================
// TAURI COMMANDS
// ============================================================

#[tauri::command]
pub fn store_secret(key: String, value: String) -> Result<SecretStoreResult, AppError> {
    validate_key(&key).map_err(AppError::new)?;
    credential_write(&key, &value).map_err(secure_storage_error)?;
    let verified = credential_read(&key)
        .map_err(secure_storage_error)?
        .ok_or_else(|| {
            secure_storage_error(
                "A verificação da gravação da credencial não retornou valor".into(),
            )
        })?;
    if verified != value {
        let _ = credential_delete(&key);
        return Err(secure_storage_error(
            "Falha na verificação da gravação da credencial".into(),
        ));
    }
    Ok(SecretStoreResult {
        stored: true,
        backend: BACKEND_NAME,
        migrated_legacy: false,
    })
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, AppError> {
    validate_key(&key).map_err(AppError::new)?;
    if let Some(value) = credential_read(&key).map_err(secure_storage_error)? {
        return Ok(Some(value));
    }
    legacy_fallback(&key)
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<bool, AppError> {
    validate_key(&key).map_err(AppError::new)?;
    let secure_removed = credential_delete(&key).map_err(secure_storage_error)?;
    let legacy_removed = delete_legacy_fallback(&key)?;
    Ok(secure_removed || legacy_removed)
}

/// Legacy-store cleanup is Windows-only; other platforms have no legacy file.
#[cfg(windows)]
fn delete_legacy_fallback(key: &str) -> Result<bool, AppError> {
    delete_legacy_secret(key).map_err(secure_storage_error)
}

#[cfg(not(windows))]
fn delete_legacy_fallback(_key: &str) -> Result<bool, AppError> {
    Ok(false)
}

#[tauri::command]
pub fn has_secure_storage() -> bool {
    storage_available()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_supported_secret_keys() {
        assert!(validate_key("provider-apikey:abc-123_test.v2").is_ok());
    }

    #[test]
    fn rejects_unsafe_secret_keys() {
        for key in ["", "with space", "../escape", "slash/value", "line\nbreak"] {
            assert!(validate_key(key).is_err(), "accepted unsafe key: {key:?}");
        }
    }

    #[cfg(windows)]
    #[test]
    fn legacy_base64_value_decodes_without_persistence() {
        let encoded = B64.encode("sk-test-value".as_bytes());
        assert_eq!(
            decode_legacy_value(&encoded, false).expect("decode"),
            "sk-test-value"
        );
    }

    #[cfg(windows)]
    #[test]
    fn target_names_are_namespaced() {
        assert_eq!(
            target_name("provider-apikey:abc").expect("target"),
            "DevManiacs.AILauncher/provider-apikey:abc"
        );
    }

    #[test]
    fn availability_probe_key_is_valid() {
        assert!(validate_key(AVAILABILITY_PROBE_KEY).is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn credential_roundtrip_writes_reads_and_deletes() {
        // Exercises the REAL Credential Manager: the target name and UTF-8
        // blob produced here are exactly what v21 wrote, so any credential
        // recorded by earlier builds is readable by this implementation.
        let key = "__ail_l4a_roundtrip__";
        let value = "sk-l4a-roundtrip-áéí值";
        credential_write(key, value).expect("credential write");
        let read = credential_read(key)
            .expect("credential read")
            .expect("credential present after write");
        assert_eq!(read, value, "UTF-8 blob must roundtrip unchanged");
        assert!(credential_delete(key).expect("credential delete"));
        assert_eq!(
            credential_read(key).expect("credential read after delete"),
            None,
            "record must be gone after delete"
        );
    }

    #[cfg(windows)]
    #[test]
    fn storage_available_reports_credential_manager_probe() {
        assert!(storage_available(), "Credential Manager probe must succeed");
    }

    #[cfg(not(windows))]
    #[test]
    fn unix_backend_is_named_after_the_platform_vault() {
        // Pure constant assertion — no Keychain/Secret Service access.
        #[cfg(target_os = "macos")]
        assert_eq!(BACKEND_NAME, "macos-keychain");
        #[cfg(target_os = "linux")]
        assert_eq!(BACKEND_NAME, "linux-secret-service");
        assert_eq!(KEYRING_SERVICE, "DevManiacs.AILauncher");
    }
}
