#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod errors;
mod secrets;
mod tray;
mod util;

use std::path::PathBuf;
use tauri::{Manager, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;

use crate::tray::{setup_tray, toggle_main_window};
use crate::util::read_tray_config;

fn main() {
    // Panic hook — salva qualquer panic do backend em disco.
    std::panic::set_hook(Box::new(|info| {
        let ts = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
        let path = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ai-launcher")
            .join("crash");
        let _ = std::fs::create_dir_all(&path);
        let file = path.join(format!("panic-{}.log", ts));
        let payload = format!(
            "timestamp={}\n\n{}\n\nLocation: {:?}\n",
            ts,
            info,
            info.location()
        );
        let _ = std::fs::write(file, payload);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _ = shortcut;
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            // commands::cli
            commands::cli::get_all_clis,
            commands::cli::check_clis,
            commands::cli::check_cli_updates,
            commands::cli::install_cli,
            commands::cli::update_cli,
            commands::cli::update_all_clis,
            commands::cli::launch_cli,
            commands::cli::launch_multi_clis,
            commands::cli::launch_custom_cli,
            // commands::tools
            commands::tools::get_all_tools,
            commands::tools::check_tools,
            commands::tools::install_tool,
            commands::tools::launch_tool,
            commands::tools::launch_custom_ide,
            // commands::updates
            commands::updates::check_all_updates,
            commands::updates::check_latest_release,
            commands::updates::check_tool_updates,
            commands::updates::check_env_updates,
            commands::updates::install_prerequisite,
            commands::updates::update_prerequisite,
            commands::updates::check_environment,
            // commands::self_update
            commands::self_update::check_app_update,
            commands::self_update::download_app_update,
            commands::self_update::verify_update_checksum,
            // commands::config
            commands::config::reset_all_config,
            commands::config::reset_claude_state,
            commands::config::test_provider_connection,
            commands::config::read_usage_stats,
            commands::config::save_crash_log,
            commands::config::read_crash_log,
            // commands::system
            commands::system::open_external_url,
            commands::system::open_in_explorer,
            commands::system::open_crash_dir,
            commands::system::get_tray_hotkey,
            commands::system::set_tray_hotkey,
            commands::system::get_minimize_to_tray,
            commands::system::set_minimize_to_tray,
            // secrets
            secrets::store_secret,
            secrets::get_secret,
            secrets::delete_secret,
            secrets::has_secure_storage,
        ])
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let cfg = read_tray_config();
                if cfg.minimize_to_tray && window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
