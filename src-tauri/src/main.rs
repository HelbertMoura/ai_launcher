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

#[cfg(target_os = "windows")]
fn exit_if_another_instance_is_running() {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows_sys::Win32::System::Threading::CreateMutexW;

    let mutex_name = if std::env::var_os("AI_LAUNCHER_SMOKE").is_some() {
        "Local\\DevManiacs.AILauncher.SingleInstance.Smoke.v1"
    } else {
        "Local\\DevManiacs.AILauncher.SingleInstance.v1"
    };
    let name: Vec<u16> = mutex_name
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    // Keep the named mutex handle open for the process lifetime. Windows closes
    // it automatically when the process exits, which releases the single-instance
    // guard even if the app crashes.
    let handle = unsafe { CreateMutexW(std::ptr::null(), 1, name.as_ptr()) };
    if !handle.is_null() && unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        std::process::exit(0);
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    exit_if_another_instance_is_running();

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

    let builder = tauri::Builder::default();
    let builder = if std::env::var_os("AI_LAUNCHER_SMOKE").is_some() {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
    };

    builder
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_notification::init())
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
            commands::cli::scan_project_stack,
            commands::cli::read_project_profile,
            commands::cli::write_project_profile,
            // commands::session
            commands::session::list_active_sessions,
            commands::session::kill_session,
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
            commands::self_update::download_verified_app_update,
            // commands::config
            commands::config::reset_all_config,
            commands::config::reset_claude_state,
            commands::config::test_provider_connection,
            commands::config::read_usage_stats,
            commands::config::save_crash_log,
            commands::config::read_crash_log,
            // commands::system
            commands::system::open_external_url,
            commands::system::open_crash_dir,
            commands::system::get_tray_hotkey,
            commands::system::set_tray_hotkey,
            commands::system::get_minimize_to_tray,
            commands::system::set_minimize_to_tray,
            // commands::mcp
            commands::mcp::list_mcp_servers,
            commands::mcp::add_mcp_server,
            commands::mcp::update_mcp_server,
            commands::mcp::remove_mcp_server,
            commands::mcp::mcp_health_check,
            // commands::runbook
            commands::runbook::run_runbook_step,
            commands::runbook::stop_runbook_execution,
            commands::runbook::evaluate_runbook_condition,
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
