use std::sync::{Mutex, OnceLock};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::util::{
    get_builtin_providers, get_cli_definitions, read_tray_config, DEFAULT_TRAY_HOTKEY,
};

/// Process-wide handle to the currently-registered global shortcut, so the
/// shortcut handler installed in `main.rs` (which is catch-all across every
/// shortcut the plugin ever sees) can decide whether the event matches
/// the user-configured hotkey before toggling the window. `None` means no
/// hotkey is currently active (failed to register, hotkey cleared, etc).
///
/// Wrapped in `Mutex` so a future Admin/Command Center flow that re-binds
/// the hotkey at runtime (e.g. `set_tray_hotkey`) can swap the value
/// without rebuilding the whole plugin. See SEC-REF005 in
/// `.wolf/audit-2026-08-10.md`.
pub static ACTIVE_SHORTCUT: OnceLock<Mutex<Option<Shortcut>>> = OnceLock::new();

/// Returns true if `pressed` is the shortcut the user actually configured
/// (as opposed to some other shortcut the global-shortcut plugin happens
/// to know about). Used by the catch-all handler in `main.rs` to avoid
/// toggling the window on stray events.
pub fn matches_active_shortcut(pressed: &Shortcut) -> bool {
    ACTIVE_SHORTCUT
        .get()
        .and_then(|m| m.lock().ok())
        .and_then(|guard| guard.as_ref().map(|s| s == pressed))
        .unwrap_or(false)
}

/// Stores `shortcut` as the active global shortcut, returning the
/// previous one (if any) so the caller can unregister it cleanly.
/// Idempotent on failure paths: a poisoned Mutex is treated as "no
/// prior registration" by re-using the value via `into_inner`.
pub fn set_active_shortcut(shortcut: Shortcut) -> Option<Shortcut> {
    let cell = ACTIVE_SHORTCUT.get_or_init(|| Mutex::new(None));
    let mut guard = cell.lock().unwrap_or_else(|p| p.into_inner());
    let previous = guard.take();
    *guard = Some(shortcut);
    previous
}

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

    // Build the launch submenu dynamically from the canonical CLI definitions,
    // so removed CLIs (e.g. Gemini) disappear and new ones (e.g. agy) show up
    // automatically. Menu item ids stay `tray-launch-<key>` for the handler.
    let launch_items: Vec<MenuItem<tauri::Wry>> = get_cli_definitions()
        .iter()
        .map(|cli| {
            MenuItem::with_id(
                app,
                format!("tray-launch-{}", cli.key),
                &cli.name,
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    let launch_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = launch_items
        .iter()
        .map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
        .collect();
    let launch_menu = Submenu::with_items(app, "Lançar CLI", true, &launch_refs)?;

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
    let tab_config = MenuItem::with_id(app, "tray-tab-config", "Ajuda/Config", true, None::<&str>)?;
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

    // Build the provider submenu from the canonical builtin list so we
    // pick up new providers (and provider renames) automatically. The
    // menu-item ids stay `tray-provider-<id>` for the existing handler
    // matcher, which routes the selection to the Admin tab as a
    // provider preset. Custom user-defined providers stay in the
    // frontend storage and are managed via the Admin tab — the tray
    // intentionally does not list them to keep the menu compact and
    // to avoid leaking storage keys into the desktop.
    let provider_items: Vec<MenuItem<tauri::Wry>> = get_builtin_providers()
        .iter()
        .map(|p| {
            MenuItem::with_id(
                app,
                format!("tray-provider-{}", p.id),
                p.display_name,
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    let provider_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = provider_items
        .iter()
        .map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
        .collect();
    let provider_menu = Submenu::with_items(app, "Provider Claude", true, &provider_refs)?;

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

/// Sets up the system tray icon, menu, and event handlers.
///
/// Returns `Box<dyn std::error::Error>` instead of our `AppResult`
/// because `tauri::App::setup()` requires this error type signature.
/// Future work: implement `From<tauri::Error>` for `AppError` and
/// migrate to `AppResult<()>` for consistency.
pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app
        .get_webview_window("main")
        .ok_or("janela 'main' não encontrada")?;
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
            } else {
                set_active_shortcut(shortcut);
            }
        }
        Err(e) => {
            eprintln!("[tray] hotkey inválido '{hotkey_str}': {e} — usando default");
            if let Ok(s) = DEFAULT_TRAY_HOTKEY.parse::<Shortcut>() {
                if app.global_shortcut().register(s).is_ok() {
                    set_active_shortcut(s);
                }
            }
        }
    }

    Ok(())
}
