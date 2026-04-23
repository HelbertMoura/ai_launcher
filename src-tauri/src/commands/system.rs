use std::os::windows::process::CommandExt;
use std::process::Command;

use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::util::{crash_dir, read_tray_config, write_tray_config, CREATE_NO_WINDOW};

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<String, String> {
    if !std::path::Path::new(&path).exists() {
        return Err("Diretório não encontrado".into());
    }
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map(|_| "Aberto".into())
        .map_err(|e| format!("Erro: {}", e))
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<String, String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("URL deve começar com http(s)://".into());
    }
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn()
        .map(|_| "Aberto".into())
        .map_err(|e| format!("Erro: {}", e))
}

#[tauri::command]
pub fn open_crash_dir() -> Result<(), String> {
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
pub fn get_tray_hotkey() -> Result<String, String> {
    Ok(read_tray_config().hotkey)
}

#[tauri::command]
pub fn set_tray_hotkey(app: tauri::AppHandle, hotkey: String) -> Result<(), String> {
    let trimmed = hotkey.trim().to_string();
    if trimmed.is_empty() {
        return Err("hotkey vazio".to_string());
    }
    let _parsed: Shortcut = trimmed
        .parse()
        .map_err(|e| format!("hotkey inválido: {e}"))?;

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
pub fn get_minimize_to_tray() -> Result<bool, String> {
    Ok(read_tray_config().minimize_to_tray)
}

#[tauri::command]
pub fn set_minimize_to_tray(enabled: bool) -> Result<(), String> {
    let mut cfg = read_tray_config();
    cfg.minimize_to_tray = enabled;
    write_tray_config(&cfg)
}
