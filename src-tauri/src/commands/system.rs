use std::os::windows::process::CommandExt;
use std::process::Command;

use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::errors::AppError;
use crate::util::{crash_dir, read_tray_config, write_tray_config, CREATE_NO_WINDOW};

/// Pure validation for `open_external_url`: trims the input, enforces the
/// http(s) scheme and rejects control characters/whitespace to avoid argument
/// injection. Returns the trimmed URL ready to be opened.
fn validate_external_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim().to_string();
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") {
        return Err("URL deve começar com http(s)://".into());
    }
    if trimmed.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("URL contém caracteres inválidos".into());
    }
    Ok(trimmed)
}

/// Pure normalization for `set_tray_hotkey`: trims, rejects empty input and
/// validates the shortcut through the global-shortcut parser. Returns the
/// normalized hotkey string; performs no state changes.
fn normalize_hotkey(hotkey: &str) -> Result<String, String> {
    let trimmed = hotkey.trim().to_string();
    if trimmed.is_empty() {
        return Err("hotkey vazio".to_string());
    }
    let _parsed: Shortcut = trimmed
        .parse()
        .map_err(|e| format!("hotkey inválido: {e}"))?;
    Ok(trimmed)
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<String, AppError> {
    let trimmed = validate_external_url(&url)?;
    // `open::that` uses ShellExecute, avoiding the `cmd /C start` injection vector.
    open::that(trimmed)
        .map(|_| "Aberto".into())
        .map_err(|e| AppError::new(format!("Erro: {}", e)))
}

#[tauri::command]
pub fn open_crash_dir() -> Result<(), AppError> {
    let dir = crash_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("falha ao criar diretório: {e}"))?;
    Command::new("explorer")
        .arg(&dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("falha ao abrir explorer: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_tray_hotkey() -> Result<String, AppError> {
    Ok(read_tray_config().hotkey)
}

#[tauri::command]
pub fn set_tray_hotkey(app: tauri::AppHandle, hotkey: String) -> Result<(), AppError> {
    let trimmed = normalize_hotkey(&hotkey)?;

    let mut cfg = read_tray_config();
    let old = cfg.hotkey.clone();
    cfg.hotkey = trimmed.clone();
    write_tray_config(&cfg)?;

    let gs = app.global_shortcut();
    if let Ok(old_shortcut) = old.parse::<Shortcut>() {
        let _ = gs.unregister(old_shortcut);
    }
    let new_shortcut: Shortcut = trimmed
        .parse()
        .map_err(|e| format!("hotkey inválido: {e}"))?;
    gs.register(new_shortcut)
        .map_err(|e| format!("falha ao registrar hotkey: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_minimize_to_tray() -> Result<bool, AppError> {
    Ok(read_tray_config().minimize_to_tray)
}

#[tauri::command]
pub fn set_minimize_to_tray(enabled: bool) -> Result<(), AppError> {
    let mut cfg = read_tray_config();
    cfg.minimize_to_tray = enabled;
    write_tray_config(&cfg).map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- validate_external_url -------------------------------------------------

    #[test]
    fn validate_external_url_accepts_http_and_https_and_trims() {
        assert_eq!(
            validate_external_url("https://nodejs.org/").unwrap(),
            "https://nodejs.org/"
        );
        assert_eq!(
            validate_external_url("  http://example.com  ").unwrap(),
            "http://example.com"
        );
    }

    #[test]
    fn validate_external_url_blocks_non_http_schemes() {
        for bad in &[
            "ftp://example.com/file",
            "file:///C:/Windows/System32/calc.exe",
            "javascript:alert(1)",
            "ms-windows-store://pdp/?productid=9N0DX20HK701",
            "example.com",
            "//example.com",
            "",
            "   ",
        ] {
            let err = validate_external_url(bad).unwrap_err();
            assert!(
                err.contains("http(s)"),
                "esquema bloqueado deve exigir http(s): {bad:?} -> {err}"
            );
        }
    }

    #[test]
    fn validate_external_url_rejects_whitespace_and_control_chars() {
        for bad in &[
            "https://example.com/a b",
            "https://example.com/\tx",
            "https://example.com/a\nb",
            "https://example.com/a\rb",
            "https://example.com/\u{0}",
        ] {
            let err = validate_external_url(bad).unwrap_err();
            assert!(
                err.contains("inválidos"),
                "controle/espaço deve ser rejeitado: {bad:?} -> {err}"
            );
        }
    }

    // ---- normalize_hotkey ------------------------------------------------------

    #[test]
    fn normalize_hotkey_trims_and_accepts_valid_combos() {
        assert_eq!(
            normalize_hotkey("  CmdOrCtrl+Alt+L  ").unwrap(),
            "CmdOrCtrl+Alt+L"
        );
        assert_eq!(normalize_hotkey("Ctrl+Shift+P").unwrap(), "Ctrl+Shift+P");
        assert_eq!(normalize_hotkey("Alt+F4").unwrap(), "Alt+F4");
    }

    #[test]
    fn normalize_hotkey_rejects_empty_input() {
        let err = normalize_hotkey("").unwrap_err();
        assert_eq!(err, "hotkey vazio");
        assert_eq!(normalize_hotkey("   ").unwrap_err(), "hotkey vazio");
    }

    #[test]
    fn normalize_hotkey_rejects_unparseable_shortcuts() {
        for bad in &[
            "not-a-hotkey",
            "Ctrl+",
            "+L",
            "Shift+Ctrl",      // apenas modificadores, sem tecla principal
            "Ctrl+Shift+C+A",  // mais de uma tecla principal
            "Ctrl+NoTeclaXyz", // tecla inexistente
        ] {
            let err = normalize_hotkey(bad).unwrap_err();
            assert!(
                err.starts_with("hotkey inválido"),
                "combo inválido deve falhar no parse: {bad:?} -> {err}"
            );
        }
    }
}
