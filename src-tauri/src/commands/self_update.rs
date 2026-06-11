//! Self-update commands for AI Launcher.
//!
//! Checks GitHub Releases for a newer version, downloads the installer
//! (NSIS or MSI) with progress events, and validates the checksum before
//! the user is allowed to apply the update.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;
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
    /// Direct download URL for the Windows installer.
    pub download_url: String,
    /// File name of the Windows installer asset (used to match its .sha256).
    #[serde(default)]
    pub asset_name: String,
    /// SHA-256 checksum hex string (from `{asset_name}.sha256` next to the asset).
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

    let tag = json["tag_name"].as_str().ok_or("Resposta sem tag_name")?;
    let version = tag.trim_start_matches('v').to_string();

    let update_available = compare_versions(CURRENT_VERSION, &version);

    // Find the NSIS installer asset first, fallback to MSI.
    let assets = json["assets"].as_array().ok_or("Resposta sem assets")?;

    let (download_url, asset_name, checksum) = find_windows_asset(assets, &version)?;

    let release_notes_url = json["html_url"].as_str().unwrap_or_default().to_string();

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
        asset_name,
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
///
/// Hashes the EXACT `file_path` returned by `download_app_update` (not a
/// best-guess scan of the temp dir). An empty `expected_checksum` is rejected
/// so the frontend can never skip verification silently. After hashing, the
/// download temp dir is cleaned up.
#[tauri::command]
pub fn verify_update_checksum(
    _version: String,
    file_path: String,
    expected_checksum: String,
) -> Result<bool, String> {
    if expected_checksum.trim().is_empty() {
        return Err("Checksum esperado ausente; atualizacao abortada".into());
    }

    let path = std::path::PathBuf::from(&file_path);
    if !path.is_file() {
        return Err(format!(
            "Arquivo de atualizacao nao encontrado: {file_path}"
        ));
    }

    // Guard against path traversal: `file_path` arrives over IPC from the
    // frontend, so a malicious value (e.g. "../../sensitive.dat") could make us
    // hash and read an arbitrary file. Canonicalize both the candidate and the
    // expected download directory, then require the candidate to live inside it.
    let expected_dir = std::env::temp_dir().join("ai-launcher-update");
    let canonical_dir = expected_dir
        .canonicalize()
        .map_err(|e| format!("Diretorio de atualizacao indisponivel: {e}"))?;
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Caminho de atualizacao invalido: {e}"))?;
    if !canonical_path.starts_with(&canonical_dir) {
        return Err("Caminho de atualizacao fora do diretorio permitido; abortado".into());
    }

    let data = std::fs::read(&canonical_path).map_err(|e| format!("Erro ao ler arquivo: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&data);
    let result = hasher.finalize();
    let actual = format!("{:x}", result);

    let valid = actual.eq_ignore_ascii_case(expected_checksum.trim());

    // On failure, the file is corrupted/tampered — remove the whole download
    // temp dir so a bad installer can never be launched. On success keep it:
    // the frontend opens the installer right after this call.
    if !valid {
        let temp_dir = std::env::temp_dir().join("ai-launcher-update");
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    Ok(valid)
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
    _version: &str,
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

        // NSIS installer: AI-Launcher_x64-setup.exe
        if name.ends_with("-setup.exe") && name.contains("x64") {
            download_url = Some(url);
            asset_name = Some(name.to_string());
            continue;
        }
        // MSI fallback
        if download_url.is_none() && name.ends_with(".msi") && name.contains("x64") {
            download_url = Some(url);
            asset_name = Some(name.to_string());
        }
    }

    let download_url = download_url.ok_or("Nenhum instalador Windows encontrado no release")?;
    let asset_name = asset_name.ok_or("Nenhum instalador Windows encontrado no release")?;

    // Match the checksum asset by the installer's exact file name.
    let checksum_url = find_checksum_url(assets, &asset_name).ok_or_else(|| {
        format!("Checksum (.sha256) ausente para {asset_name}; atualizacao abortada")
    })?;

    // Fetch and parse the checksum. An unreadable/empty checksum aborts the update.
    let checksum = fetch_checksum(&checksum_url);
    if checksum.is_empty() {
        return Err(format!(
            "Falha ao obter checksum de {asset_name}; atualizacao abortada"
        ));
    }

    Ok((download_url, asset_name, checksum))
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
    let resp = download_agent()
        .get(url)
        .call()
        .map_err(|e| format!("Download error: {e}"))?;

    let total = resp
        .header("Content-Length")
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);
    let mut reader = resp.into_reader();
    let mut file = std::fs::File::create(dest).map_err(|e| format!("File create: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut buf = [0u8; 64 * 1024]; // 64 KB chunks
    let mut last_percent: u8 = 0;

    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("Read error: {e}"))?;
        if n == 0 {
            break;
        }
        std::io::Write::write_all(&mut file, &buf[..n]).map_err(|e| format!("Write error: {e}"))?;
        downloaded += n as u64;

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

    Ok(dest.to_string_lossy().to_string())
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
        let assets = vec![
            json!({ "name": "AI-Launcher_x64-setup.exe", "browser_download_url": "https://x/setup.exe" }),
        ];
        let result = find_windows_asset(&assets, "15.2.6");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Checksum"));
    }

    #[test]
    fn verify_rejects_empty_checksum() {
        let result = verify_update_checksum("15.2.6".into(), "whatever".into(), "   ".into());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Checksum"));
    }

    #[test]
    fn verify_rejects_path_outside_update_dir() {
        // A file that exists but lives outside the allowed update dir (e.g. a
        // path-traversal attempt) must be rejected before it is read/hashed.
        use std::io::Write;
        let mut outside = std::env::temp_dir();
        outside.push(format!("ai-launcher-traversal-{}.dat", std::process::id()));
        {
            let mut f = std::fs::File::create(&outside).expect("create temp file");
            f.write_all(b"secret").expect("write temp file");
        }

        let result = verify_update_checksum(
            "15.2.6".into(),
            outside.to_string_lossy().to_string(),
            "abc123".into(),
        );
        let _ = std::fs::remove_file(&outside);

        assert!(result.is_err());
        let err = result.unwrap_err();
        // Either the allowed dir does not exist yet, or the path is outside it —
        // both are rejections, never a successful hash of an arbitrary file.
        assert!(
            err.contains("fora do diretorio")
                || err.contains("Diretorio de atualizacao")
                || err.contains("Caminho de atualizacao"),
            "unexpected error: {err}"
        );
    }
}
