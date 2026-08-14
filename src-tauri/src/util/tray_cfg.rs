use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub const DEFAULT_TRAY_HOTKEY: &str = "CommandOrControl+Alt+Space";

pub fn tray_config_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("ai-launcher");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("tray.json")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrayConfig {
    pub hotkey: String,
    pub minimize_to_tray: bool,
}

impl Default for TrayConfig {
    fn default() -> Self {
        Self {
            hotkey: DEFAULT_TRAY_HOTKEY.to_string(),
            minimize_to_tray: false,
        }
    }
}

pub fn read_tray_config() -> TrayConfig {
    let path = tray_config_path();
    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => TrayConfig::default(),
    }
}

pub fn write_tray_config(cfg: &TrayConfig) -> Result<(), String> {
    let path = tray_config_path();
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn crash_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ai-launcher")
        .join("crash")
}
