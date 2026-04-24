// ==============================================================================
// AI Launcher Pro - Secure Secrets Storage
// Stores API keys using Windows DPAPI encryption via PowerShell subprocess.
// Falls back to base64-only encoding with warning when DPAPI is unavailable.
// ==============================================================================

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Keystore file format
// ---------------------------------------------------------------------------

/// Secrets file format. `encrypted` flag indicates DPAPI was used.
#[derive(Serialize, Deserialize, Default)]
struct SecretStore {
    /// Whether the values are DPAPI-encrypted (versus base64-only fallback).
    encrypted: bool,
    /// Map of secret key -> base64-encoded (and possibly DPAPI-encrypted) value.
    entries: HashMap<String, String>,
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

fn secrets_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir().ok_or("Cannot determine app data directory")?;
    let dir = base.join("ai-launcher").join("secrets");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create secrets dir: {e}"))?;
    }
    Ok(dir)
}

fn secrets_file() -> Result<PathBuf, String> {
    Ok(secrets_dir()?.join("secrets.json"))
}

fn load_store() -> Result<SecretStore, String> {
    let path = secrets_file()?;
    if !path.exists() {
        return Ok(SecretStore::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read secrets file: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse secrets file: {e}"))
}

fn save_store(store: &SecretStore) -> Result<(), String> {
    let path = secrets_file()?;
    let content =
        serde_json::to_string_pretty(store).map_err(|e| format!("Failed to serialize secrets: {e}"))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write secrets file: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Encryption / Decryption
// ---------------------------------------------------------------------------

/// Encrypt a value. On Windows, attempts DPAPI via PowerShell subprocess.
/// Falls back to base64-only encoding (not encrypted, but not human-readable).
fn encrypt_value(plain: &str) -> Result<(String, bool), String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(encrypted) = dpapi_encrypt(plain) {
            return Ok((encrypted, true));
        }
    }
    let encoded = B64.encode(plain.as_bytes());
    Ok((encoded, false))
}

/// Decrypt a value. Returns the plaintext string.
fn decrypt_value(cipher: &str, was_encrypted: bool) -> Result<String, String> {
    if was_encrypted {
        #[cfg(target_os = "windows")]
        {
            return dpapi_decrypt(cipher);
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = cipher;
            return Err("DPAPI decryption not available on this platform".to_string());
        }
    }
    // Base64-only fallback
    let bytes = B64
        .decode(cipher)
        .map_err(|e| format!("Failed to decode base64 secret: {e}"))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 in secret: {e}"))
}

// ---------------------------------------------------------------------------
// Windows DPAPI via PowerShell
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn dpapi_encrypt(plain: &str) -> Result<String, String> {
    let b64_plain = B64.encode(plain.as_bytes());
    let ps_script = format!(
        r#"
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('{}')
$enc = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
[Convert]::ToBase64String($enc)
"#,
        b64_plain
    );
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps_script,
        ])
        .output()
        .map_err(|e| format!("Failed to run PowerShell for DPAPI: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("DPAPI encrypt failed: {}", stderr.trim()));
    }
    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if result.is_empty() {
        return Err("DPAPI encrypt returned empty result".to_string());
    }
    Ok(result)
}

#[cfg(target_os = "windows")]
fn dpapi_decrypt(cipher: &str) -> Result<String, String> {
    let ps_script = format!(
        r#"
Add-Type -AssemblyName System.Security
$enc = [Convert]::FromBase64String('{}')
$plain = [Security.Cryptography.ProtectedData]::Unprotect($enc, $null, 'CurrentUser')
[Convert]::ToBase64String($plain)
"#,
        cipher
    );
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps_script,
        ])
        .output()
        .map_err(|e| format!("Failed to run PowerShell for DPAPI decrypt: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("DPAPI decrypt failed: {}", stderr.trim()));
    }
    let b64_plain = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let bytes = B64
        .decode(&b64_plain)
        .map_err(|e| format!("Failed to decode DPAPI result: {e}"))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 in decrypted secret: {e}"))
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// Store a secret securely. Returns `true` if DPAPI encryption was used.
#[tauri::command]
pub fn store_secret(key: String, value: String) -> Result<bool, String> {
    if key.is_empty() {
        return Err("Secret key cannot be empty".to_string());
    }
    let mut store = load_store()?;
    let (encrypted_val, was_encrypted) = encrypt_value(&value)?;
    store.encrypted = was_encrypted;
    store.entries.insert(key, encrypted_val);
    save_store(&store)?;
    Ok(was_encrypted)
}

/// Retrieve a secret. Returns `null` (None) if not found.
#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    let store = load_store()?;
    match store.entries.get(&key) {
        Some(cipher) => {
            let plain = decrypt_value(cipher, store.encrypted)?;
            Ok(Some(plain))
        }
        None => Ok(None),
    }
}

/// Delete a secret. Returns `true` if the key existed.
#[tauri::command]
pub fn delete_secret(key: String) -> Result<bool, String> {
    let mut store = load_store()?;
    let removed = store.entries.remove(&key).is_some();
    if removed {
        save_store(&store)?;
    }
    Ok(removed)
}

/// Check if secure storage (DPAPI on Windows) is available.
#[tauri::command]
pub fn has_secure_storage() -> bool {
    #[cfg(target_os = "windows")]
    {
        dpapi_encrypt("__probe__").is_ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_roundtrip() {
        let plain = "sk-ant-test-key-12345";
        let encoded = B64.encode(plain.as_bytes());
        let decoded = B64.decode(&encoded).expect("decode");
        let result = String::from_utf8(decoded).expect("utf8");
        assert_eq!(result, plain);
    }

    #[test]
    fn encrypt_decrypt_roundtrip() {
        // Test that encrypt -> decrypt produces the original value,
        // regardless of whether DPAPI or base64 fallback is used.
        let plain = "sk-ant-test-key-roundtrip-12345";
        let (encoded, was_encrypted) = encrypt_value(plain).expect("encrypt");
        let result = decrypt_value(&encoded, was_encrypted).expect("decrypt");
        assert_eq!(result, plain);
    }
}
