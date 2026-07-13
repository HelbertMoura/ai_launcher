//! Self-update commands for AI Launcher.
//!
//! Checks GitHub Releases for a newer version, downloads the installer
//! (NSIS or MSI) with progress events, and validates the checksum before
//! the user is allowed to apply the update.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Emitter;

use crate::util::{compare_versions, download_agent, http_agent};

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
    /// Link to the full release notes on GitHub.
    pub release_notes_url: String,
    /// Short HTML body of the release notes.
    pub release_notes_body: String,
}

#[derive(Debug, Clone)]
struct ReleaseCandidate {
    version: String,
    download_url: String,
    asset_name: String,
    checksum: String,
}

#[derive(Debug, Serialize)]
pub struct VerifiedUpdateResult {
    pub version: String,
    pub asset_name: String,
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
const MAX_UPDATE_BYTES: u64 = 250 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Check GitHub Releases for the latest AI Launcher version.
#[tauri::command]
pub fn check_app_update() -> Result<AppUpdateInfo, String> {
    fetch_release_candidate().map(|(info, _candidate)| info)
}

fn fetch_release_candidate() -> Result<(AppUpdateInfo, ReleaseCandidate), String> {
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

    let tag = json["tag_name"].as_str().ok_or("Resposta sem tag_name")?;
    let version = tag.trim_start_matches('v').to_string();
    if tag != format!("v{version}") {
        return Err("Tag de release fora do formato v<semver>".to_string());
    }

    let update_available = compare_versions(CURRENT_VERSION, &version);

    // Find the NSIS installer asset first, fallback to MSI.
    let assets = json["assets"].as_array().ok_or("Resposta sem assets")?;

    let (download_url, asset_name, checksum) = find_windows_asset(assets, tag, &version)?;

    let release_notes_url = json["html_url"].as_str().unwrap_or_default().to_string();

    let release_notes_body = json["body"]
        .as_str()
        .unwrap_or("")
        .chars()
        .take(2000)
        .collect();

    let info = AppUpdateInfo {
        update_available,
        version: version.clone(),
        current_version: CURRENT_VERSION.to_string(),
        release_notes_url,
        release_notes_body,
    };
    let candidate = ReleaseCandidate {
        version,
        download_url,
        asset_name,
        checksum,
    };
    Ok((info, candidate))
}

/// Re-resolve, download and verify the requested latest release entirely in
/// the backend. The frontend never supplies a URL, checksum or destination.
#[tauri::command]
pub async fn download_verified_app_update(
    app: tauri::AppHandle,
    version: String,
) -> Result<VerifiedUpdateResult, String> {
    let (_info, candidate) = tokio::task::spawn_blocking(fetch_release_candidate)
        .await
        .map_err(|e| format!("Release lookup thread failed: {e}"))??;
    if candidate.version != version {
        return Err("A release mudou desde a última verificação; verifique novamente".to_string());
    }

    let temp_dir = std::env::temp_dir().join("ai-launcher-update");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("mkdir: {e}"))?;
    let file_path = temp_dir.join(&candidate.asset_name);

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
    let download_url = candidate.download_url.clone();
    let checksum = candidate.checksum.clone();

    let result = tokio::task::spawn_blocking(move || {
        download_and_verify(&app_clone, &download_url, &file_path_clone, &checksum)
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
            reveal_verified_update(&path)?;
            Ok(VerifiedUpdateResult {
                version: candidate.version,
                asset_name: candidate.asset_name,
            })
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Find the best Windows installer asset and its matching checksum.
///
/// Returns `(download_url, asset_name, checksum)`. The checksum asset is matched
/// by its file name (`{asset_name}.sha256`, falling back to `{asset_name}.checksum`)
/// so a release with multiple installers can never pair the wrong checksum.
///
/// If the matching checksum asset is missing, or fetching/parsing it fails, the
/// update is ABORTED with an error — we never return an empty checksum, because
/// that would let the frontend skip verification entirely.
fn find_windows_asset(
    assets: &[serde_json::Value],
    tag: &str,
    version: &str,
) -> Result<(String, String, String), String> {
    // Prefer NSIS installer (.exe ending in -setup.exe), then MSI.
    let mut download_url: Option<String> = None;
    let mut asset_name: Option<String> = None;

    for asset in assets {
        let name = asset["name"].as_str().unwrap_or("");
        let url = asset["browser_download_url"]
            .as_str()
            .unwrap_or("")
            .to_string();

        if !is_safe_asset_name(name, version) {
            continue;
        }
        // NSIS installer: AI-Launcher_x64-setup.exe
        if name.ends_with("-setup.exe") {
            download_url = Some(url);
            asset_name = Some(name.to_string());
            continue;
        }
        // MSI fallback
        if download_url.is_none() && name.ends_with(".msi") {
            download_url = Some(url);
            asset_name = Some(name.to_string());
        }
    }

    let download_url = download_url.ok_or("Nenhum instalador Windows encontrado no release")?;
    let asset_name = asset_name.ok_or("Nenhum instalador Windows encontrado no release")?;
    validate_release_asset_url(&download_url, tag, &asset_name)?;

    // Match the checksum asset by the installer's exact file name.
    let checksum_url = find_checksum_url(assets, &asset_name).ok_or_else(|| {
        format!("Checksum (.sha256) ausente para {asset_name}; atualizacao abortada")
    })?;
    let valid_checksum_urls = [
        format!("{download_url}.sha256"),
        format!("{download_url}.checksum"),
    ];
    if !valid_checksum_urls.iter().any(|url| url == &checksum_url) {
        return Err("URL do checksum não corresponde ao asset aprovado".to_string());
    }

    // Fetch and parse the checksum. An unreadable/empty checksum aborts the update.
    let checksum = fetch_checksum(&checksum_url)?;

    Ok((download_url, asset_name, checksum))
}

fn is_safe_asset_name(name: &str, version: &str) -> bool {
    !name.is_empty()
        && name.len() <= 180
        && name.contains("x64")
        && name.contains(version)
        && (name.ends_with("-setup.exe") || name.ends_with(".msi"))
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

fn validate_release_asset_url(url: &str, tag: &str, asset_name: &str) -> Result<(), String> {
    let expected = format!("https://github.com/{GITHUB_REPO}/releases/download/{tag}/{asset_name}");
    if url != expected {
        return Err("URL do instalador não pertence à release oficial esperada".to_string());
    }
    Ok(())
}

/// Find the `browser_download_url` of the checksum asset that matches `asset_name`.
///
/// Matches `{asset_name}.sha256` first, then `{asset_name}.checksum`.
fn find_checksum_url(assets: &[serde_json::Value], asset_name: &str) -> Option<String> {
    let sha_name = format!("{asset_name}.sha256");
    let checksum_name = format!("{asset_name}.checksum");
    assets
        .iter()
        .find(|asset| {
            let name = asset["name"].as_str().unwrap_or("");
            name == sha_name || name == checksum_name
        })
        .and_then(|asset| asset["browser_download_url"].as_str())
        .map(|s| s.to_string())
}

/// Fetch and parse a checksum file. Expected format: `<hash>  <filename>` or just `<hash>`.
fn fetch_checksum(url: &str) -> Result<String, String> {
    http_agent()
        .get(url)
        .call()
        .map_err(|e| format!("Falha ao obter checksum: {e}"))
        .and_then(|resp| {
            let mut body = String::new();
            resp.into_reader()
                .read_to_string(&mut body)
                .map_err(|e| format!("Falha ao ler checksum: {e}"))?;
            parse_checksum(&body)
        })
}

fn parse_checksum(body: &str) -> Result<String, String> {
    body.split_whitespace()
        .next()
        .filter(|s| s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit()))
        .map(|s| s.to_lowercase())
        .ok_or_else(|| "Checksum SHA-256 inválido".to_string())
}

fn download_and_verify(
    app: &tauri::AppHandle,
    url: &str,
    dest: &Path,
    expected_checksum: &str,
) -> Result<PathBuf, String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let partial = dest.with_extension("part");
    let _ = std::fs::remove_file(&partial);
    let resp = download_agent()
        .get(url)
        .call()
        .map_err(|e| format!("Download error: {e}"))?;

    let total = resp
        .header("Content-Length")
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);
    if total > MAX_UPDATE_BYTES {
        return Err("Update excede o limite máximo de download".to_string());
    }
    let mut reader = resp.into_reader();
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&partial)
        .map_err(|e| format!("File create: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut buf = [0u8; 64 * 1024]; // 64 KB chunks
    let mut last_percent: u8 = 0;
    let mut hasher = Sha256::new();

    let result = (|| -> Result<(), String> {
        loop {
            let n = reader
                .read(&mut buf)
                .map_err(|e| format!("Read error: {e}"))?;
            if n == 0 {
                break;
            }
            downloaded += n as u64;
            if downloaded > MAX_UPDATE_BYTES {
                return Err("Update excede o limite máximo de download".to_string());
            }
            file.write_all(&buf[..n])
                .map_err(|e| format!("Write error: {e}"))?;
            hasher.update(&buf[..n]);

            if total > 0 {
                let percent = ((downloaded as f64 / total as f64) * 100.0) as u8;
                if percent != last_percent && percent.is_multiple_of(5) {
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
        file.flush().map_err(|e| format!("Flush error: {e}"))?;
        file.sync_all().map_err(|e| format!("Sync error: {e}"))?;

        let _ = app.emit(
            "app-update-download",
            DownloadProgress {
                phase: "verifying".into(),
                downloaded,
                total,
                percent: 100,
            },
        );
        let actual = format!("{:x}", hasher.finalize());
        if !actual.eq_ignore_ascii_case(expected_checksum) {
            return Err("Checksum verification failed".to_string());
        }
        Ok(())
    })();

    if let Err(error) = result {
        drop(file);
        let _ = std::fs::remove_file(&partial);
        return Err(error);
    }

    drop(file);
    if dest.exists() {
        std::fs::remove_file(dest).map_err(|e| format!("Stale update cleanup failed: {e}"))?;
    }
    std::fs::rename(&partial, dest).map_err(|e| format!("Update finalize failed: {e}"))?;
    Ok(dest.to_path_buf())
}

fn reveal_verified_update(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Err("Verified update file is unavailable".to_string());
    }
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map_err(|e| format!("Failed to reveal verified update: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn matches_sha256_by_exact_asset_name() {
        let assets = vec![
            json!({ "name": "AI-Launcher_15.2.6_x64-setup.exe", "browser_download_url": "https://x/setup.exe" }),
            json!({ "name": "AI-Launcher_15.2.6_x64-setup.exe.sha256", "browser_download_url": "https://x/setup.sha256" }),
        ];
        let url = find_checksum_url(&assets, "AI-Launcher_15.2.6_x64-setup.exe");
        assert_eq!(url.as_deref(), Some("https://x/setup.sha256"));
    }

    #[test]
    fn does_not_pick_unrelated_sha256() {
        // A stray .sha256 belonging to a different asset must NOT be matched.
        let assets = vec![
            json!({ "name": "AI-Launcher_15.2.6_x64-setup.exe", "browser_download_url": "https://x/setup.exe" }),
            json!({ "name": "other-artifact.zip.sha256", "browser_download_url": "https://x/other.sha256" }),
        ];
        let url = find_checksum_url(&assets, "AI-Launcher_15.2.6_x64-setup.exe");
        assert!(url.is_none());
    }

    #[test]
    fn picks_correct_sha256_among_multiple() {
        let assets = vec![
            json!({ "name": "AI-Launcher_x64-setup.exe.sha256", "browser_download_url": "https://x/exe.sha256" }),
            json!({ "name": "AI-Launcher_x64.msi.sha256", "browser_download_url": "https://x/msi.sha256" }),
        ];
        let url = find_checksum_url(&assets, "AI-Launcher_x64.msi");
        assert_eq!(url.as_deref(), Some("https://x/msi.sha256"));
    }

    #[test]
    fn falls_back_to_checksum_extension() {
        let assets = vec![
            json!({ "name": "AI-Launcher_x64.msi.checksum", "browser_download_url": "https://x/msi.checksum" }),
        ];
        let url = find_checksum_url(&assets, "AI-Launcher_x64.msi");
        assert_eq!(url.as_deref(), Some("https://x/msi.checksum"));
    }

    #[test]
    fn aborts_when_checksum_asset_missing() {
        let assets = vec![json!({
            "name": "AI-Launcher_15.2.6_x64-setup.exe",
            "browser_download_url": "https://github.com/HelbertMoura/ai_launcher/releases/download/v15.2.6/AI-Launcher_15.2.6_x64-setup.exe"
        })];
        let result = find_windows_asset(&assets, "v15.2.6", "15.2.6");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Checksum"));
    }

    #[test]
    fn rejects_unsafe_asset_names() {
        assert!(!is_safe_asset_name(
            "..\\evil-15.2.6-x64-setup.exe",
            "15.2.6"
        ));
        assert!(!is_safe_asset_name("AI-Launcher_x64-setup.exe", "15.2.6"));
        assert!(is_safe_asset_name(
            "AI-Launcher_15.2.6_x64-setup.exe",
            "15.2.6"
        ));
    }

    #[test]
    fn validates_exact_official_release_url() {
        let name = "AI-Launcher_15.2.6_x64-setup.exe";
        let valid = format!("https://github.com/{GITHUB_REPO}/releases/download/v15.2.6/{name}");
        assert!(validate_release_asset_url(&valid, "v15.2.6", name).is_ok());
        assert!(validate_release_asset_url(
            "https://example.com/AI-Launcher_15.2.6_x64-setup.exe",
            "v15.2.6",
            name
        )
        .is_err());
    }

    #[test]
    fn checksum_must_be_exact_sha256_hex() {
        assert!(parse_checksum(&"a".repeat(64)).is_ok());
        assert!(parse_checksum("abc123").is_err());
        assert!(parse_checksum(&"z".repeat(64)).is_err());
    }
}
