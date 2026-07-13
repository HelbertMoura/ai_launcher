//! Secure provider credential storage.
//!
//! v21 stores each secret as an independent Windows generic credential. The
//! old `secrets.json` file is read only for a verified, idempotent migration.
//! New writes never downgrade to base64 or expose plaintext through a process
//! command line.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};

const CREDENTIAL_PREFIX: &str = "DevManiacs.AILauncher/";
const BACKEND_NAME: &str = "windows-credential-manager";
const MAX_SECRET_KEY_LEN: usize = 240;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretStoreResult {
    stored: bool,
    backend: &'static str,
    migrated_legacy: bool,
}

#[derive(Deserialize, Default)]
struct LegacySecretStore {
    encrypted: bool,
    entries: HashMap<String, String>,
}

fn validate_key(key: &str) -> Result<(), String> {
    if key.is_empty() {
        return Err("Secret key cannot be empty".to_string());
    }
    if key.len() > MAX_SECRET_KEY_LEN {
        return Err("Secret key is too long".to_string());
    }
    if !key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, ':' | '.' | '_' | '-'))
    {
        return Err("Secret key contains unsupported characters".to_string());
    }
    Ok(())
}

fn target_name(key: &str) -> Result<String, String> {
    validate_key(key)?;
    Ok(format!("{CREDENTIAL_PREFIX}{key}"))
}

fn legacy_file() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or("Cannot determine app data directory")?;
    Ok(base
        .join("ai-launcher")
        .join("secrets")
        .join("secrets.json"))
}

fn load_legacy_store() -> Result<Option<LegacySecretStore>, String> {
    let path = legacy_file()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read legacy secret store: {e}"))?;
    let store = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse legacy secret store: {e}"))?;
    Ok(Some(store))
}

fn save_legacy_store(store: &LegacySecretStore) -> Result<(), String> {
    let path = legacy_file()?;
    if store.entries.is_empty() {
        if path.exists() {
            fs::remove_file(path)
                .map_err(|e| format!("Failed to remove migrated legacy secret store: {e}"))?;
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
            .map_err(|e| format!("Failed to serialize legacy secret store: {e}"))?,
    )
    .map_err(|e| format!("Failed to update legacy secret store: {e}"))
}

fn decode_legacy_value(value: &str, encrypted: bool) -> Result<String, String> {
    let bytes = B64
        .decode(value)
        .map_err(|e| format!("Failed to decode legacy secret: {e}"))?;
    if encrypted {
        return legacy_dpapi_decrypt(bytes);
    }
    String::from_utf8(bytes).map_err(|e| format!("Legacy secret is not valid UTF-8: {e}"))
}

fn migrate_legacy_secret(key: &str) -> Result<Option<String>, String> {
    let Some(mut store) = load_legacy_store()? else {
        return Ok(None);
    };
    let Some(encoded) = store.entries.get(key).cloned() else {
        return Ok(None);
    };

    let plain = decode_legacy_value(&encoded, store.encrypted)?;
    credential_write(key, &plain)?;
    let verified =
        credential_read(key)?.ok_or("Credential migration verification returned no value")?;
    if verified != plain {
        let _ = credential_delete(key);
        return Err("Credential migration verification failed".to_string());
    }

    store.entries.remove(key);
    save_legacy_store(&store)?;
    Ok(Some(plain))
}

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
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn credential_write(key: &str, value: &str) -> Result<(), String> {
    use windows_sys::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_MAX_CREDENTIAL_BLOB_SIZE, CRED_PERSIST_LOCAL_MACHINE,
        CRED_TYPE_GENERIC,
    };

    let bytes = value.as_bytes();
    if bytes.len() > CRED_MAX_CREDENTIAL_BLOB_SIZE as usize {
        return Err(format!(
            "Secret exceeds Windows Credential Manager limit of {CRED_MAX_CREDENTIAL_BLOB_SIZE} bytes"
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
            "Windows Credential Manager write failed: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn credential_write(_key: &str, _value: &str) -> Result<(), String> {
    Err("Secure credential storage is only available on Windows".to_string())
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
            "Windows Credential Manager read failed: {}",
            std::io::Error::from_raw_os_error(error as i32)
        ));
    }
    if raw.is_null() {
        return Err("Windows Credential Manager returned an empty record".to_string());
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

#[cfg(not(windows))]
fn credential_read(_key: &str) -> Result<Option<String>, String> {
    Err("Secure credential storage is only available on Windows".to_string())
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
        "Windows Credential Manager delete failed: {}",
        std::io::Error::from_raw_os_error(error as i32)
    ))
}

#[cfg(not(windows))]
fn credential_delete(_key: &str) -> Result<bool, String> {
    Err("Secure credential storage is only available on Windows".to_string())
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
            "Legacy DPAPI decrypt failed: {}",
            std::io::Error::last_os_error()
        ));
    }

    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) };
    let value = String::from_utf8(bytes.to_vec())
        .map_err(|e| format!("Legacy DPAPI value is not valid UTF-8: {e}"));
    unsafe {
        LocalFree(output.pbData.cast());
    }
    value
}

#[cfg(not(windows))]
fn legacy_dpapi_decrypt(_cipher: Vec<u8>) -> Result<String, String> {
    Err("Legacy DPAPI migration is only available on Windows".to_string())
}

#[tauri::command]
pub fn store_secret(key: String, value: String) -> Result<SecretStoreResult, String> {
    validate_key(&key)?;
    credential_write(&key, &value)?;
    let verified =
        credential_read(&key)?.ok_or("Credential write verification returned no value")?;
    if verified != value {
        let _ = credential_delete(&key);
        return Err("Credential write verification failed".to_string());
    }
    Ok(SecretStoreResult {
        stored: true,
        backend: BACKEND_NAME,
        migrated_legacy: false,
    })
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    validate_key(&key)?;
    if let Some(value) = credential_read(&key)? {
        return Ok(Some(value));
    }
    migrate_legacy_secret(&key)
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<bool, String> {
    validate_key(&key)?;
    let secure_removed = credential_delete(&key)?;
    let legacy_removed = delete_legacy_secret(&key)?;
    Ok(secure_removed || legacy_removed)
}

#[tauri::command]
pub fn has_secure_storage() -> bool {
    cfg!(windows)
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

    #[test]
    fn legacy_base64_value_decodes_without_persistence() {
        let encoded = B64.encode("sk-test-value".as_bytes());
        assert_eq!(
            decode_legacy_value(&encoded, false).expect("decode"),
            "sk-test-value"
        );
    }

    #[test]
    fn target_names_are_namespaced() {
        assert_eq!(
            target_name("provider-apikey:abc").expect("target"),
            "DevManiacs.AILauncher/provider-apikey:abc"
        );
    }
}
