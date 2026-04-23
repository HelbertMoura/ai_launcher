use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::util::{read_tray_config, DEFAULT_TRAY_HOTKEY};

pub fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        let minimized = window.is_minimized().unwrap_or(false);
        if visible && !minimized {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

pub fn show_and_focus(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn build_tray_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let show = MenuItem::with_id(app, "tray-show", "Abrir AI Launcher", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    let launch_claude =
        MenuItem::with_id(app, "tray-launch-claude", "Claude Code", true, None::<&str>)?;
    let launch_codex = MenuItem::with_id(app, "tray-launch-codex", "Codex", true, None::<&str>)?;
    let launch_gemini =
        MenuItem::with_id(app, "tray-launch-gemini", "Gemini", true, None::<&str>)?;
    let launch_qwen = MenuItem::with_id(app, "tray-launch-qwen", "Qwen", true, None::<&str>)?;
    let launch_kilocode = MenuItem::with_id(
        app,
        "tray-launch-kilocode",
        "Kilo Code",
        true,
        None::<&str>,
    )?;
    let launch_opencode = MenuItem::with_id(
        app,
        "tray-launch-opencode",
        "OpenCode",
        true,
        None::<&str>,
    )?;
    let launch_crush = MenuItem::with_id(app, "tray-launch-crush", "Crush", true, None::<&str>)?;
    let launch_droid = MenuItem::with_id(app, "tray-launch-droid", "Droid", true, None::<&str>)?;
    let launch_menu = Submenu::with_items(
        app,
        "Lançar CLI",
        true,
        &[
            &launch_claude,
            &launch_codex,
            &launch_gemini,
            &launch_qwen,
            &launch_kilocode,
            &launch_opencode,
            &launch_crush,
            &launch_droid,
        ],
    )?;

    let update_all = MenuItem::with_id(
        app,
        "tray-update-all",
        "Atualizar todos os CLIs",
        true,
        None::<&str>,
    )?;

    let tab_launcher = MenuItem::with_id(app, "tray-tab-launcher", "Launcher", true, None::<&str>)?;
    let tab_install = MenuItem::with_id(app, "tray-tab-install", "Instalar", true, None::<&str>)?;
    let tab_updates =
        MenuItem::with_id(app, "tray-tab-updates", "Atualizações", true, None::<&str>)?;
    let tab_costs = MenuItem::with_id(app, "tray-tab-costs", "Custos", true, None::<&str>)?;
    let tab_config =
        MenuItem::with_id(app, "tray-tab-config", "Ajuda/Config", true, None::<&str>)?;
    let tabs_menu = Submenu::with_items(
        app,
        "Abrir aba",
        true,
        &[
            &tab_launcher,
            &tab_install,
            &tab_updates,
            &tab_costs,
            &tab_config,
        ],
    )?;

    let prov_anthropic = MenuItem::with_id(
        app,
        "tray-provider-anthropic",
        "Anthropic (oficial)",
        true,
        None::<&str>,
    )?;
    let prov_zai = MenuItem::with_id(app, "tray-provider-zai", "Z.AI (GLM)", true, None::<&str>)?;
    let prov_minimax =
        MenuItem::with_id(app, "tray-provider-minimax", "MiniMax", true, None::<&str>)?;
    let provider_menu = Submenu::with_items(
        app,
        "Provider Claude",
        true,
        &[&prov_anthropic, &prov_zai, &prov_minimax],
    )?;

    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Sair", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &show,
            &sep1,
            &launch_menu,
            &provider_menu,
            &update_all,
            &tabs_menu,
            &sep2,
            &quit,
        ],
    )
}

fn handle_tray_menu_event(app: &AppHandle, id: &str) {
    match id {
        "tray-show" => show_and_focus(app),
        "tray-quit" => app.exit(0),
        "tray-update-all" => {
            show_and_focus(app);
            let _ = app.emit("tray-update-all", ());
        }
        id if id.starts_with("tray-launch-") => {
            let cli_key = id.strip_prefix("tray-launch-").unwrap_or("").to_string();
            show_and_focus(app);
            let _ = app.emit("tray-launch-cli", cli_key);
        }
        id if id.starts_with("tray-tab-") => {
            let tab_key = id.strip_prefix("tray-tab-").unwrap_or("").to_string();
            let mapped = if tab_key == "config" {
                "help".to_string()
            } else {
                tab_key
            };
            show_and_focus(app);
            let _ = app.emit("tray-open-tab", mapped);
        }
        id if id.starts_with("tray-provider-") => {
            let provider_id = id.strip_prefix("tray-provider-").unwrap_or("").to_string();
            let _ = app.emit("tray-set-provider", provider_id);
        }
        _ => {}
    }
}

/// Build tray icon, register global hotkey. Called from main.rs setup().
pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main").unwrap();
    window.set_title("AI Launcher Pro - by Helbert Moura | Powered by DevManiac's")?;

    let menu = build_tray_menu(app.handle())?;
    let mut tray_builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("AI Launcher Pro")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_tray_menu_event(app, event.id().as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_and_focus(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon);
    }
    let _tray = tray_builder.build(app)?;

    let cfg = read_tray_config();
    let hotkey_str = cfg.hotkey.clone();
    match hotkey_str.parse::<Shortcut>() {
        Ok(shortcut) => {
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("[tray] falha ao registrar hotkey '{hotkey_str}': {e}");
            }
        }
        Err(e) => {
            eprintln!("[tray] hotkey inválido '{hotkey_str}': {e} — usando default");
            if let Ok(s) = DEFAULT_TRAY_HOTKEY.parse::<Shortcut>() {
                let _ = app.global_shortcut().register(s);
            }
        }
    }

    Ok(())
}
