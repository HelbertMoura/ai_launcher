use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::definitions::CliInfo;
use super::process::{command_exists, run_silent};
use super::terminal::{expand_env, resolve_cli_path, scan_subdirs_for_exe_deep};

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckResult {
    pub key: String,
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub install_command: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub cli: String,
    pub current: Option<String>,
    pub latest: Option<String>,
    pub has_update: bool,
    pub method: String,
    pub no_api: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdatesSummary {
    pub cli_updates: Vec<UpdateInfo>,
    pub env_updates: Vec<UpdateInfo>,
    pub tool_updates: Vec<UpdateInfo>,
    pub checked_at: String,
    pub total_with_updates: usize,
}

pub fn strip_ansi(s: &str) -> String {
    let re = regex_lite::Regex::new(r"\x1b\[[0-9;?]*[a-zA-Z]").unwrap();
    re.replace_all(s, "").to_string()
}

pub fn extract_version(output: &str) -> Option<String> {
    let clean = strip_ansi(output);
    let re = regex_lite::Regex::new(r"(\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?)").ok()?;

    let mut candidates: Vec<String> = Vec::new();
    for line in clean.lines() {
        for m in re.find_iter(line) {
            candidates.push(m.as_str().to_string());
        }
    }
    if candidates.is_empty() {
        let re2 = regex_lite::Regex::new(r"(\d+\.\d+)").ok()?;
        return re2.find(&clean).map(|m| m.as_str().to_string());
    }
    candidates.into_iter().last()
}

pub fn get_installed_version(cli: &CliInfo) -> Option<String> {
    if cli.key == "claude" || cli.install_method == "script" || !cli.extra_paths.is_empty() {
        if let Some(resolved) = resolve_cli_path(&cli.command, &cli.extra_paths) {
            let (_, out) = run_silent(&resolved, &["--version"]);
            if let Some(ref s) = out {
                if let Some(ver) = extract_version(s) {
                    return Some(ver);
                }
            }
        }
    }
    if let Some(ref npm_pkg) = cli.npm_pkg {
        let (_, out) = run_silent("npm", &["list", "-g", npm_pkg, "--depth=0", "--json"]);
        if let Some(ref s) = out {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(s) {
                if let Some(ver) = v["dependencies"][npm_pkg]["version"].as_str() {
                    return Some(ver.to_string());
                }
            }
        }
    }
    if let Some(ref pip_pkg) = cli.pip_pkg {
        let (_, out) = run_silent("pip", &["show", pip_pkg]);
        if let Some(ref s) = out {
            if let Some(line) = s.lines().find(|l| l.starts_with("Version:")) {
                let ver = line.replace("Version:", "").trim().to_string();
                if !ver.is_empty() {
                    return Some(ver);
                }
            }
        }
    }
    if let Some(resolved) = resolve_cli_path(&cli.command, &cli.extra_paths) {
        let (_, out) = run_silent(&resolved, &["--version"]);
        if let Some(ref s) = out {
            if let Some(ver) = extract_version(s) {
                return Some(ver);
            }
        }
    }
    let (_, out) = run_silent(&cli.command, &["--version"]);
    out.as_ref().and_then(|s| extract_version(s))
}

/// Reads the PE `ProductVersion` metadata via PowerShell. Windows-only
/// evidence; other platforms return `None` and callers fall back to
/// "detectado" when the tool is present.
#[cfg(windows)]
pub fn read_exe_product_version(path: &std::path::Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let escaped = path.to_string_lossy().replace('\'', "''");
    let ps = format!(
        "(Get-Item -LiteralPath '{}').VersionInfo.ProductVersion",
        escaped
    );
    let (ok, out) = run_silent("powershell", &["-NoProfile", "-Command", &ps]);
    if !ok {
        return None;
    }
    out.as_deref().and_then(extract_version)
}

#[cfg(not(windows))]
pub fn read_exe_product_version(_path: &std::path::Path) -> Option<String> {
    None
}

pub fn check_cli_installed(cli: &CliInfo) -> (bool, Option<String>) {
    if let Some(ver) = get_installed_version(cli) {
        return (true, Some(ver));
    }
    if command_exists(&cli.command) {
        return (true, Some("detectado".into()));
    }
    (false, None)
}

pub fn compare_versions(current: &str, latest: &str) -> bool {
    let parse_parts = |v: &str| -> Vec<u64> {
        v.trim()
            .trim_start_matches('v')
            .split('.')
            .filter_map(|p| {
                p.chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .ok()
            })
            .collect()
    };

    let cur_parts = parse_parts(current);
    let lat_parts = parse_parts(latest);

    if cur_parts.is_empty() || lat_parts.is_empty() {
        return current.trim() != latest.trim();
    }

    let max_len = cur_parts.len().max(lat_parts.len());
    for i in 0..max_len {
        let c = cur_parts.get(i).unwrap_or(&0);
        let l = lat_parts.get(i).unwrap_or(&0);
        if c != l {
            return c < l;
        }
    }
    false
}

pub fn detect_python() -> (bool, Option<String>) {
    let is_valid_output = |s: &str| -> bool {
        !s.to_lowercase().contains("was not found")
            && !s.to_lowercase().contains("microsoft store")
            && !s.to_lowercase().contains("executemanually")
            && s.to_lowercase().contains("python")
    };

    let (ok1, out1) = run_silent("python", &["--version"]);
    if ok1 {
        if let Some(ref s) = out1 {
            if is_valid_output(s) {
                if let Some(ver) = extract_version(s) {
                    return (true, Some(ver));
                }
            }
        }
    }
    let (ok2, out2) = run_silent("py", &["--version"]);
    if ok2 {
        if let Some(ref s) = out2 {
            if let Some(ver) = extract_version(s) {
                return (true, Some(ver));
            }
        }
    }
    let (ok3, out3) = run_silent("python3", &["--version"]);
    if ok3 {
        if let Some(ref s) = out3 {
            if is_valid_output(s) {
                if let Some(ver) = extract_version(s) {
                    return (true, Some(ver));
                }
            }
        }
    }
    {
        let bases = [
            expand_env(r"%LOCALAPPDATA%\Programs\Python"),
            expand_env(r"%PROGRAMFILES%\Python"),
            expand_env(r"%PROGRAMFILES%"),
        ];
        for base in &bases {
            if let Some(py) = scan_subdirs_for_exe_deep(base, &["python.exe"], 2) {
                let py_str = py.to_string_lossy().to_string();
                let (_, out) = run_silent(&py_str, &["--version"]);
                if let Some(ref s) = out {
                    if let Some(ver) = extract_version(s) {
                        return (true, Some(ver));
                    }
                }
                return (true, Some("detectado".into()));
            }
        }
    }
    (false, None)
}

pub fn http_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent(concat!("ai-launcher-pro/", env!("CARGO_PKG_VERSION")))
        .build()
}

#[allow(dead_code)]
pub fn download_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(30))
        .timeout_read(std::time::Duration::from_secs(60))
        .user_agent(concat!("ai-launcher-pro/", env!("CARGO_PKG_VERSION")))
        .build()
}

pub fn fetch_vscode_latest() -> Option<String> {
    // VS Code publishes per-platform stable channels; ask for the current OS.
    #[cfg(target_os = "macos")]
    let platform = "darwin";
    #[cfg(all(unix, not(target_os = "macos")))]
    let platform = "linux-x64";
    #[cfg(windows)]
    let platform = "win32-x64";
    let url =
        format!("https://update.code.visualstudio.com/api/releases/stable/{platform}/version");
    let resp = http_agent().get(&url).call().ok()?;
    let json: serde_json::Value = resp.into_json().ok()?;
    json["productVersion"].as_str().map(|s| s.to_string())
}

pub fn fetch_github_latest(repo: &str) -> Option<String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    let resp = http_agent().get(&url).call().ok()?;
    let json: serde_json::Value = resp.into_json().ok()?;
    json["tag_name"]
        .as_str()
        .map(|s| s.trim_start_matches('v').to_string())
}

pub fn fetch_manifest_version(url: &str) -> Option<String> {
    let resp = http_agent().get(url).call().ok()?;
    let body = resp.into_string().ok()?;
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
        if let Some(v) = json["version"].as_str() {
            return Some(v.trim_start_matches('v').to_string());
        }
        if let Some(t) = json["tag_name"].as_str() {
            return Some(t.trim_start_matches('v').to_string());
        }
    }
    extract_version(&body)
}

static NPM_LATEST_CACHE: std::sync::LazyLock<
    std::sync::Mutex<HashMap<String, (String, std::time::Instant)>>,
> = std::sync::LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

const NPM_CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(15 * 60);

fn npm_latest_http(pkg: &str) -> Option<String> {
    let url = format!("https://registry.npmjs.org/{}/latest", pkg);
    let resp = http_agent().get(&url).call().ok()?;
    let json: serde_json::Value = resp.into_json().ok()?;
    json["version"].as_str().and_then(extract_version)
}

pub fn npm_latest(pkg: &str) -> Option<String> {
    if let Ok(cache) = NPM_LATEST_CACHE.lock() {
        if let Some((ver, at)) = cache.get(pkg) {
            if at.elapsed() < NPM_CACHE_TTL {
                return Some(ver.clone());
            }
        }
    }
    let ver = npm_latest_http(pkg).or_else(|| {
        let (_, raw) = run_silent("npm", &["view", pkg, "version"]);
        raw.as_ref().and_then(|v| extract_version(v))
    })?;
    if let Ok(mut cache) = NPM_LATEST_CACHE.lock() {
        cache.insert(pkg.to_string(), (ver.clone(), std::time::Instant::now()));
    }
    Some(ver)
}
