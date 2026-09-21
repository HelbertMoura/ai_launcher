//! Self-update commands for AI Launcher.
//!
//! Thin wrapper over the official `tauri-plugin-updater`. The plugin
//! fetches `latest.json` from GitHub Releases, validates the signature
//! against the public key baked into the build, downloads the NSIS
//! installer, and runs it on close (passive install mode).
//!
//! The legacy `self_update.rs` (custom GitHub API + SHA-256 verification)
//! was deleted in FEAT-002 step 3/3. The frontend contract
//! (`check_app_update` / `download_verified_app_update`) is preserved so
//! `useAppUpdate.ts` keeps working unchanged.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

use crate::errors::AppError;
use crate::util::compare_versions;

// ---------------------------------------------------------------------------
// Types — kept identical to the legacy contract so the frontend does not
// need to change.
// ---------------------------------------------------------------------------

/// Metadata returned by `check_app_update`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppUpdateInfo {
    /// Whether a newer version exists on GitHub.
    pub update_available: bool,
    /// Version found on the release (e.g. "21.0.0").
    pub version: String,
    /// Current app version (from `CARGO_PKG_VERSION`).
    pub current_version: String,
    /// Link to the full release notes on GitHub.
    pub release_notes_url: String,
    /// Short body of the release notes (truncated to keep the payload small).
    pub release_notes_body: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifiedUpdateResult {
    pub version: String,
    pub asset_name: String,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Check the configured updater endpoint for a newer version.
///
/// We compare the plugin-reported `update.version` against
/// `CARGO_PKG_VERSION` ourselves because the plugin's default comparator
/// only reports availability based on the manifest's own version field —
/// it does not know the running app's version. (Both come from the same
/// semver source so `compare_versions` is enough.)
#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<AppUpdateInfo, AppError> {
    let current = env!("CARGO_PKG_VERSION");
    let updater = app
        .updater()
        .map_err(|e| format!("Falha ao inicializar o atualizador: {e}"))?;

    let result = updater
        .check()
        .await
        .map_err(|e| format!("Falha ao verificar atualizações: {e}"))?;

    let Some(update) = result else {
        return Ok(AppUpdateInfo {
            update_available: false,
            version: current.to_string(),
            current_version: current.to_string(),
            release_notes_url: String::new(),
            release_notes_body: String::new(),
        });
    };

    let latest = update.version.to_string();
    let update_available = compare_versions(current, &latest);

    // `download_url` looks like
    //   https://github.com/HelbertMoura/ai_launcher/releases/download/v21.0.0/AI-Launcher_21.0.0_x64-setup.exe
    // The path includes the tag, so the release notes URL is the parent.
    let release_notes_url = update
        .download_url
        .as_str()
        .split_once("/releases/download/")
        .map(|(head, _)| format!("{head}/releases/tag/v{latest}"))
        .unwrap_or_default();

    let release_notes_body = update.body.unwrap_or_default().chars().take(2000).collect();

    Ok(AppUpdateInfo {
        update_available,
        version: latest,
        current_version: current.to_string(),
        release_notes_url,
        release_notes_body,
    })
}

/// Download and launch the installer for the version returned by
/// `check_app_update`. The plugin streams the NSIS installer, verifies
/// its signature against the baked-in public key, then schedules the
/// install to run on application close (passive mode).
///
/// `version` is the value the user confirmed on; we re-check inside the
/// plugin so a stale call cannot trigger a downgrade.
#[tauri::command]
pub async fn download_verified_app_update(
    app: AppHandle,
    version: String,
) -> Result<VerifiedUpdateResult, AppError> {
    let current = env!("CARGO_PKG_VERSION");
    if !compare_versions(current, &version) {
        return Err(format!(
            "Versão solicitada ({version}) não é mais recente que a atual ({current})"
        )
        .into());
    }

    let updater = app
        .updater()
        .map_err(|e| format!("Falha ao inicializar o atualizador: {e}"))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Falha ao verificar atualizações: {e}"))?
        .ok_or_else(|| "Nenhuma atualização disponível".to_string())?;

    // The plugin's `Update::version` is a `semver::Version`. Without the
    // `semver` crate as a direct dep we cannot pattern-match; we round-trip
    // to a `String` once and compare against the user-supplied `version`.
    // `Display` is required by `Update` so the allocation is unavoidable
    // here — clippy's `cmp_owned` lint flags the comparison but the cost
    // is paid regardless.
    #[allow(clippy::cmp_owned)]
    {
        if update.version.to_string() != version {
            return Err(
                "A release mudou desde a última verificação; verifique novamente"
                    .to_string()
                    .into(),
            );
        }
    }

    // Filename we present to the UI; the plugin does not expose the asset
    // name directly but the path's last segment is sufficient.
    let asset_name = update
        .download_url
        .as_str()
        .rsplit('/')
        .next()
        .unwrap_or("installer")
        .to_string();

    // `download_and_install` runs the installer on app close (passive
    // mode is set in tauri.conf.json). The progress callback is a no-op
    // for now — the plugin does not surface byte-level progress events
    // to the frontend over `app-update-download`. If we need it later,
    // wire it via `tauri::Emitter` from the closure.
    update
        .download_and_install(|_downloaded, _total| {}, || {})
        .await
        .map_err(|e| format!("Falha ao baixar/instalar: {e}"))?;

    Ok(VerifiedUpdateResult {
        version,
        asset_name,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Frontend depends on the exact wire format of these structs.
    /// A roundtrip catches accidental renames and missing fields without
    /// spinning up the Tauri runtime.
    #[test]
    fn app_update_info_serializes_roundtrip() {
        let info = AppUpdateInfo {
            update_available: true,
            version: "21.0.0".into(),
            current_version: "20.0.0".into(),
            release_notes_url: "https://github.com/HelbertMoura/ai_launcher/releases/tag/v21.0.0"
                .into(),
            release_notes_body: "Bug fixes and improvements.".into(),
        };
        let json = serde_json::to_string(&info).expect("serialize");
        let back: AppUpdateInfo = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.update_available, info.update_available);
        assert_eq!(back.version, info.version);
        assert_eq!(back.current_version, info.current_version);
        assert_eq!(back.release_notes_url, info.release_notes_url);
        assert_eq!(back.release_notes_body, info.release_notes_body);
    }

    #[test]
    fn verified_update_result_serializes_roundtrip() {
        let r = VerifiedUpdateResult {
            version: "21.0.0".into(),
            asset_name: "AI-Launcher_21.0.0_x64-setup.exe".into(),
        };
        let json = serde_json::to_string(&r).expect("serialize");
        let back: VerifiedUpdateResult = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.version, r.version);
        assert_eq!(back.asset_name, r.asset_name);
    }
}
