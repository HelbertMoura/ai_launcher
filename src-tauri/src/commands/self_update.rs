//! Self-update commands for AI Launcher.
//!
//! Checks GitHub Releases for a newer version, downloads the installer
//! (NSIS or MSI) with progress events, and validates the checksum before
//! the user is allowed to apply the update.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;
use tauri::Emitter;

use crate::util::{compare_versions, http_agent};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Metadata returned by `check_app_update`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppUpdateInfo {
    /// Whether a newer version exists on GitHub.
    pub update_available: bool,
    /// Version found on the release (e.g. "15.1.0").
    pub version: String,
    /// Current app version (from CARGO_PKG_VERSION).
    pub current_version: String,
    /// Direct download URL for the Windows installer.
    pub download_url: String,
    /// SHA-256 checksum hex string (from .sha256 file next to the asset).
    pub checksum: String,
    /// Link to the full release notes on GitHub.
    pub release_notes_url: String,
    /// Short HTML body of the release notes.
    pub release_notes_body: String,
}

/// Progress payload emitted during download.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub phase: String,
    pub downloaded: u64,
    pub total: u64,
    pub percent: u8,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_REPO: &str = "HelbertMoura/ai_launcher";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Check GitHub Releases for the latest AI Launcher version.
#[tauri::command]
pub fn check_app_update() -> Result<AppUpdateInfo, String> {
    let url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );

    let agent = http_agent();
    let resp = agent
        .get(&url)
        .set("User-Agent", &format!("ai-launcher/{}", CURRENT_VERSION))
        .call()
        .map_err(|e| format!("Erro ao buscar releases: {e}"))?;

    let json: serde_json::Value = resp.into_json().map_err(|e| format!("JSON parse: {e}"))?;

    let tag = json["tag_name"]
        .as_str()
        .ok_or("Resposta sem tag_name")?;
    let version = tag.trim_start_matches('v').to_string();

    let update_available = compare_versions(CURRENT_VERSION, &version);

    // Find the NSIS installer asset first, fallback to MSI.
    let assets = json["assets"]
        .as_array()
        .ok_or("Resposta sem assets")?;

    let (download_url, checksum) = find_windows_asset(assets, &version)?;

    let release_notes_url = json["html_url"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    let release_notes_body = json["body"]
        .as_str()
        .unwrap_or("")
        .chars()
        .take(2000)
        .collect();

    Ok(AppUpdateInfo {
        update_available,
        version,
        current_version: CURRENT_VERSION.to_string(),
        download_url,
        checksum,
        release_notes_url,
        release_notes_body,
    })
}

/// Download the installer to a temp directory, emitting progress events.
/// Returns the local file path on success.
#[tauri::command]
pub async fn download_app_update(
    app: tauri::AppHandle,
    _version: String,
    download_url: String,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("ai-launcher-update");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("mkdir: {e}"))?;

    // Derive filename from URL.
    let file_name = download_url
        .rsplit('/')
        .next()
        .unwrap_or("ai-launcher-update.exe")
        .to_string();
    let file_path = temp_dir.join(&file_name);

    // Emit start event.
    let _ = app.emit(
        "app-update-download",
        DownloadProgress {
            phase: "start".into(),
            downloaded: 0,
            total: 0,
            percent: 0,
        },
    );

    // Download with progress tracking via a separate thread.
    let app_clone = app.clone();
    let file_path_clone = file_path.clone();

    let result = tokio::task::spawn_blocking(move || {
        download_with_progress(&app_clone, &download_url, &file_path_clone)
    })
    .await
    .map_err(|e| format!("Thread error: {e}"))?;

    match result {
        Ok(path) => {
            let _ = app.emit(
                "app-update-download",
                DownloadProgress {
                    phase: "done".into(),
                    downloaded: 0,
                    total: 0,
                    percent: 100,
                },
            );
            Ok(path)
        }
        Err(e) => {
            let _ = app.emit(
                "app-update-download",
                DownloadProgress {
                    phase: "error".into(),
                    downloaded: 0,
                    total: 0,
                    percent: 0,
                },
            );
            Err(e)
        }
    }
}

/// Verify the SHA-256 checksum of the downloaded file.
#[tauri::command]
pub fn verify_update_checksum(_version: String, expected_checksum: String) -> Result<bool, String> {
    let temp_dir = std::env::temp_dir().join("ai-launcher-update");
    if !temp_dir.exists() {
        return Err("Diretorio de download nao encontrado".into());
    }

    // Find the downloaded file.
    let file = std::fs::read_dir(&temp_dir)
        .map_err(|e| format!("Erro ao ler diretorio: {e}"))?
        .filter_map(|e| e.ok())
        .find(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            // Look for NSIS or MSI matching the version pattern.
            name_str.ends_with(".exe")
                || name_str.ends_with(".msi")
        })
        .ok_or("Arquivo de atualizacao nao encontrado no diretorio temporario")?;

    let data = std::fs::read(file.path()).map_err(|e| format!("Erro ao ler arquivo: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&data);
    let result = hasher.finalize();
    let actual = format!("{:x}", result);

    Ok(actual.eq_ignore_ascii_case(&expected_checksum))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Find the best Windows installer asset and its checksum from the release assets.
fn find_windows_asset(
    assets: &[serde_json::Value],
    _version: &str,
) -> Result<(String, String), String> {
    // Prefer NSIS installer (.exe ending in -setup.exe), then MSI.
    let mut download_url: Option<String> = None;
    let mut checksum_url: Option<String> = None;

    for asset in assets {
        let name = asset["name"].as_str().unwrap_or("");
        let url = asset["browser_download_url"]
            .as_str()
            .unwrap_or("")
            .to_string();

        // NSIS installer: AI-Launcher_x64-setup.exe
        if name.ends_with("-setup.exe") && name.contains("x64") {
            download_url = Some(url);
            continue;
        }
        // MSI fallback
        if download_url.is_none() && name.ends_with(".msi") && name.contains("x64") {
            download_url = Some(url);
            continue;
        }
        // Checksum file (.sha256 or .checksum)
        if name.ends_with(".sha256") || name.ends_with(".checksum") {
            checksum_url = Some(url);
        }
    }

    let download_url = download_url.ok_or("Nenhum instalador Windows encontrado no release")?;

    // Try to fetch the checksum.
    let checksum = match checksum_url {
        Some(url) => fetch_checksum(&url),
        None => String::new(),
    };

    Ok((download_url, checksum))
}

/// Fetch and parse a checksum file. Expected format: `<hash>  <filename>` or just `<hash>`.
fn fetch_checksum(url: &str) -> String {
    http_agent()
        .get(url)
        .call()
        .ok()
        .and_then(|resp| {
            let mut body = String::new();
            resp.into_reader().read_to_string(&mut body).ok()?;
            // Take the first hex token.
            body.split_whitespace()
                .next()
                .filter(|s| s.chars().all(|c| c.is_ascii_hexdigit()))
                .map(|s| s.to_lowercase())
        })
        .unwrap_or_default()
}

/// Download a file with chunk-based progress events.
fn download_with_progress(
    app: &tauri::AppHandle,
    url: &str,
    dest: &std::path::Path,
) -> Result<String, String> {
    let resp = http_agent()
        .get(url)
        .call()
        .map_err(|e| format!("Download error: {e}"))?;

    let total = resp.header("Content-Length").and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
    let mut reader = resp.into_reader();
    let mut file = std::fs::File::create(dest).map_err(|e| format!("File create: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut buf = [0u8; 64 * 1024]; // 64 KB chunks
    let mut last_percent: u8 = 0;

    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("Read error: {e}"))?;
        if n == 0 {
            break;
        }
        std::io::Write::write_all(&mut file, &buf[..n]).map_err(|e| format!("Write error: {e}"))?;
        downloaded += n as u64;

        if total > 0 {
            let percent = ((downloaded as f64 / total as f64) * 100.0) as u8;
            if percent != last_percent && percent % 5 == 0 {
                last_percent = percent;
                let _ = app.emit(
                    "app-update-download",
                    DownloadProgress {
                        phase: "downloading".into(),
                        downloaded,
                        total,
                        percent,
                    },
                );
            }
        }
    }

    Ok(dest.to_string_lossy().to_string())
}
