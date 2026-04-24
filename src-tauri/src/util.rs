// Shared utilities, type definitions, and global helpers.
// Extracted from main.rs during v14 modularization.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;

pub const CREATE_NO_WINDOW: u32 = 0x08000000;

// ============================================================
// TIPOS PÚBLICOS
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CliInfo {
    pub key: String,
    pub name: String,
    pub command: String,
    pub flag: Option<String>,
    pub install_cmd: String,
    pub version_cmd: String,
    pub npm_pkg: Option<String>,
    pub pip_pkg: Option<String>,
    pub install_method: String,
    pub install_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolInfo {
    pub key: String,
    pub name: String,
    pub command: String,
    pub install_hint: String,
    pub install_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckResult {
    /// Canonical key matched by `install_prerequisite` (e.g. "node", "git", "vscode").
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

#[derive(Debug, Serialize, Clone)]
pub struct ProgressEvent {
    pub key: String,
    pub phase: String,
    pub line: String,
}

// ============================================================
// DEFINIÇÕES DE CLI / TOOLS
// ============================================================

pub fn get_cli_definitions() -> Vec<CliInfo> {
    vec![
        CliInfo {
            key: "claude".into(),
            name: "Claude".into(),
            command: "claude".into(),
            flag: Some("--dangerously-skip-permissions".into()),
            install_cmd: "npm install -g @anthropic-ai/claude-code".into(),
            version_cmd: "claude --version".into(),
            npm_pkg: Some("@anthropic-ai/claude-code".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        CliInfo {
            key: "codex".into(),
            name: "Codex".into(),
            command: "codex".into(),
            flag: Some("--dangerously-bypass-approvals-and-sandbox".into()),
            install_cmd: "npm install -g @openai/codex".into(),
            version_cmd: "codex --version".into(),
            npm_pkg: Some("@openai/codex".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        CliInfo {
            key: "gemini".into(),
            name: "Gemini".into(),
            command: "gemini".into(),
            flag: Some("--yolo".into()),
            install_cmd: "npm install -g @google/gemini-cli".into(),
            version_cmd: "gemini --version".into(),
            npm_pkg: Some("@google/gemini-cli".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        CliInfo {
            key: "qwen".into(),
            name: "Qwen".into(),
            command: "qwen".into(),
            flag: Some("--yolo".into()),
            install_cmd: "npm install -g @qwen-code/qwen-code".into(),
            version_cmd: "qwen --version".into(),
            npm_pkg: Some("@qwen-code/qwen-code".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        CliInfo {
            key: "kilocode".into(),
            name: "Kilo Code".into(),
            command: "kilo".into(),
            flag: Some("--auto".into()),
            install_cmd: "npm install -g @kilocode/cli".into(),
            version_cmd: "kilo --version".into(),
            npm_pkg: Some("@kilocode/cli".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        CliInfo {
            key: "opencode".into(),
            name: "OpenCode".into(),
            command: "opencode".into(),
            flag: Some("--dangerously-skip-permissions".into()),
            install_cmd: "npm install -g opencode-ai".into(),
            version_cmd: "opencode --version".into(),
            npm_pkg: Some("opencode-ai".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        CliInfo {
            key: "crush".into(),
            name: "Crush".into(),
            command: "crush".into(),
            flag: Some("--yolo".into()),
            install_cmd: "npm install -g @charmland/crush".into(),
            version_cmd: "crush --version".into(),
            npm_pkg: Some("@charmland/crush".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        CliInfo {
            key: "droid".into(),
            name: "Factory Droid".into(),
            command: "droid".into(),
            flag: Some("--skip-permissions-unsafe".into()),
            install_cmd: "irm https://app.factory.ai/cli/windows | iex".into(),
            version_cmd: "droid --version".into(),
            npm_pkg: None,
            pip_pkg: None,
            install_method: "script".into(),
            install_url: Some("https://docs.factory.ai/cli/getting-started/quickstart".into()),
        },
    ]
}

pub fn get_tool_definitions() -> Vec<ToolInfo> {
    vec![
        ToolInfo {
            key: "vscode".into(),
            name: "VS Code".into(),
            command: "code".into(),
            install_hint: "Download de https://code.visualstudio.com".into(),
            install_url: Some("https://code.visualstudio.com/Download".into()),
        },
        ToolInfo {
            key: "cursor".into(),
            name: "Cursor".into(),
            command: "cursor".into(),
            install_hint: "Download de https://cursor.sh".into(),
            install_url: Some("https://cursor.sh".into()),
        },
        ToolInfo {
            key: "windsurf".into(),
            name: "Windsurf".into(),
            command: "windsurf".into(),
            install_hint: "Download de https://codeium.com/windsurf".into(),
            install_url: Some("https://codeium.com/windsurf".into()),
        },
        ToolInfo {
            key: "antgravity".into(),
            name: "AntGravity".into(),
            command: "antigravity".into(),
            install_hint: "Download de https://antgravity.com".into(),
            install_url: Some("https://antgravity.com".into()),
        },
    ]
}

// ============================================================
// HELPERS — PROCESS / TIMEOUT
// ============================================================

pub fn resolve_windows_cmd(cmd: &str) -> String {
    match cmd {
        "npm" | "pnpm" | "yarn" | "pip" | "tauri" | "bun" | "code" | "cursor" | "windsurf" => {
            format!("{}.cmd", cmd)
        }
        _ => cmd.to_string(),
    }
}

pub const RUN_SILENT_TIMEOUT_SECS: u64 = 15;

pub fn run_silent_with_timeout(
    cmd: &str,
    args: &[&str],
    timeout_secs: u64,
) -> (bool, Option<String>) {
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;

    let cmd_resolved = resolve_windows_cmd(cmd);
    let mut command = Command::new(&cmd_resolved);
    command.args(args);
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());
    command.creation_flags(CREATE_NO_WINDOW);

    let child = match command.spawn() {
        Ok(c) => c,
        Err(_) => return (false, None),
    };
    let pid = child.id();

    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });

    match rx.recv_timeout(Duration::from_secs(timeout_secs)) {
        Ok(Ok(output)) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !stdout.is_empty() {
                    return (true, Some(stdout.chars().take(800).collect()));
                }
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if !stderr.is_empty() {
                    return (true, Some(stderr.chars().take(800).collect()));
                }
                return (true, Some("installed".to_string()));
            }
            (false, None)
        }
        _ => {
            {
                let mut kill = Command::new("taskkill");
                kill.args(["/F", "/T", "/PID", &pid.to_string()]);
                kill.creation_flags(CREATE_NO_WINDOW);
                let _ = kill.output();
            }
            log_event(
                "timeout",
                &format!("{} {} ({}s)", cmd, args.join(" "), timeout_secs),
            );
            (false, None)
        }
    }
}

pub fn run_silent(cmd: &str, args: &[&str]) -> (bool, Option<String>) {
    run_silent_with_timeout(cmd, args, RUN_SILENT_TIMEOUT_SECS)
}

pub fn command_exists(cmd: &str) -> bool {
    let mut c = Command::new("where");
    c.arg(cmd);
    c.creation_flags(CREATE_NO_WINDOW);
    if c.output().map(|o| o.status.success()).unwrap_or(false) {
        return true;
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        let npm_path = format!("{}\\npm", appdata);
        for ext in &["cmd", "ps1", "exe", "bat", ""] {
            let full = if ext.is_empty() {
                format!("{}\\{}", npm_path, cmd)
            } else {
                format!("{}\\{}.{}", npm_path, cmd, ext)
            };
            if std::path::Path::new(&full).exists() {
                return true;
            }
        }
    }
    if let Ok(lad) = std::env::var("LOCALAPPDATA") {
        let npm_path = format!("{}\\npm", lad);
        for ext in &["cmd", "ps1", "exe", "bat", ""] {
            let full = if ext.is_empty() {
                format!("{}\\{}", npm_path, cmd)
            } else {
                format!("{}\\{}.{}", npm_path, cmd, ext)
            };
            if std::path::Path::new(&full).exists() {
                return true;
            }
        }
    }
    false
}

// ============================================================
// HELPERS — STRINGS / VERSIONS
// ============================================================

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
    if let Some(resolved) = resolve_cli_path_win(&cli.command) {
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

// ============================================================
// HELPERS — PATHS / WINDOWS
// ============================================================

pub fn find_windows_terminal() -> Option<String> {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let wt_path = format!("{}\\Microsoft\\WindowsApps\\wt.exe", local_app_data);
        if std::path::Path::new(&wt_path).exists() {
            return Some(wt_path);
        }
    }
    for p in [
        "C:\\Program Files\\WindowsTerminal\\wt.exe",
        "C:\\Program Files (x86)\\WindowsTerminal\\wt.exe",
    ] {
        if std::path::Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    if command_exists("wt") {
        return Some("wt".to_string());
    }
    None
}

pub fn expand_env(path: &str) -> String {
    let mut result = path.to_string();
    for var in &[
        "LOCALAPPDATA",
        "APPDATA",
        "PROGRAMFILES",
        "PROGRAMFILES(X86)",
        "USERPROFILE",
    ] {
        if let Ok(val) = std::env::var(var) {
            result = result.replace(&format!("%{}%", var), &val);
        }
    }
    result
}

pub fn scan_subdirs_for_exe_deep(
    base_dir: &str,
    exe_names: &[&str],
    depth: u32,
) -> Option<PathBuf> {
    let path = std::path::Path::new(base_dir);
    if !path.exists() {
        return None;
    }
    for exe in exe_names {
        let direct = path.join(exe);
        if direct.exists() {
            return Some(direct);
        }
    }
    if depth == 0 {
        return None;
    }
    if let Ok(entries) = std::fs::read_dir(path) {
        let mut subdirs: Vec<_> = entries.flatten().filter(|e| e.path().is_dir()).collect();
        subdirs.sort_by_key(|b| std::cmp::Reverse(b.file_name()));
        for entry in subdirs {
            if let Some(sub) = entry.path().to_str() {
                if let Some(p) = scan_subdirs_for_exe_deep(sub, exe_names, depth - 1) {
                    return Some(p);
                }
            }
        }
    }
    None
}

#[allow(dead_code)]
pub fn scan_subdirs_for_exe(base_dir: &str, exe_names: &[&str]) -> Option<PathBuf> {
    scan_subdirs_for_exe_deep(base_dir, exe_names, 1)
}

pub fn find_exe_from_start_menu(lnk_name_contains: &str) -> Option<PathBuf> {
    let candidates = [
        expand_env(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs"),
        expand_env(r"%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs"),
    ];
    for base in &candidates {
        let path = std::path::Path::new(base);
        if !path.exists() {
            continue;
        }
        let mut stack: Vec<PathBuf> = vec![path.to_path_buf()];
        while let Some(dir) = stack.pop() {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.is_dir() {
                        stack.push(p);
                    } else if p.extension().and_then(|s| s.to_str()) == Some("lnk") {
                        if let Some(name) = p.file_stem().and_then(|s| s.to_str()) {
                            if name
                                .to_lowercase()
                                .contains(&lnk_name_contains.to_lowercase())
                            {
                                let ps_cmd = format!(
                                    "(New-Object -COM WScript.Shell).CreateShortcut('{}').TargetPath",
                                    p.to_string_lossy().replace('\'', "''")
                                );
                                let (_, out) =
                                    run_silent("powershell", &["-NoProfile", "-Command", &ps_cmd]);
                                if let Some(ref s) = out {
                                    let target = s.trim();
                                    if !target.is_empty() && std::path::Path::new(target).exists() {
                                        return Some(PathBuf::from(target));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
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

pub fn encode_powershell_command(script: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let mut bytes = Vec::with_capacity(script.len() * 2);
    for w in script.encode_utf16() {
        bytes.extend_from_slice(&w.to_le_bytes());
    }
    STANDARD.encode(&bytes)
}

pub fn http_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent(concat!("ai-launcher-pro/", env!("CARGO_PKG_VERSION")))
        .build()
}

pub fn fetch_vscode_latest() -> Option<String> {
    let resp = http_agent()
        .get("https://update.code.visualstudio.com/api/releases/stable/win32-x64/version")
        .call()
        .ok()?;
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

pub fn resolve_cli_path_win(cmd: &str) -> Option<String> {
    for prefix in [r"%APPDATA%\npm\", r"%LOCALAPPDATA%\npm\"] {
        let base = expand_env(prefix);
        for ext in &["cmd", "exe", "ps1", "bat"] {
            let full = format!("{}{}.{}", base, cmd, ext);
            if std::path::Path::new(&full).exists() {
                return Some(full);
            }
        }
    }
    let where_results: Vec<String> = {
        let mut c = Command::new("where");
        c.arg(cmd);
        c.creation_flags(CREATE_NO_WINDOW);
        c.output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .map(|s| {
                s.lines()
                    .map(|l| l.trim().to_string())
                    .filter(|l| !l.is_empty() && std::path::Path::new(l).exists())
                    .collect()
            })
            .unwrap_or_default()
    };

    for path in &where_results {
        if !path.to_lowercase().contains(r"\.local\bin\") {
            return Some(path.clone());
        }
    }
    if let Some(first) = where_results.first() {
        return Some(first.clone());
    }
    None
}

pub fn find_tool_path(tool_key: &str) -> Option<PathBuf> {
    let searches: Vec<(String, Vec<&str>)> = match tool_key {
        "vscode" => vec![
            (
                expand_env(r"%LOCALAPPDATA%\Programs\Microsoft VS Code"),
                vec!["Code.exe"],
            ),
            (
                expand_env(r"%PROGRAMFILES%\Microsoft VS Code"),
                vec!["Code.exe"],
            ),
            (
                expand_env(r"%PROGRAMFILES(X86)%\Microsoft VS Code"),
                vec!["Code.exe"],
            ),
        ],
        "cursor" => vec![
            (
                expand_env(r"%LOCALAPPDATA%\Programs\cursor"),
                vec!["Cursor.exe"],
            ),
            (expand_env(r"%LOCALAPPDATA%\Cursor"), vec!["Cursor.exe"]),
            (expand_env(r"%PROGRAMFILES%\Cursor"), vec!["Cursor.exe"]),
        ],
        "windsurf" => vec![
            (
                expand_env(r"%LOCALAPPDATA%\Programs\Windsurf"),
                vec!["Windsurf.exe"],
            ),
            (expand_env(r"%PROGRAMFILES%\Windsurf"), vec!["Windsurf.exe"]),
        ],
        "antgravity" => vec![
            (
                expand_env(r"%LOCALAPPDATA%\Programs\Antigravity"),
                vec!["Antigravity.exe"],
            ),
            (
                expand_env(r"%LOCALAPPDATA%\Programs\AntGravity"),
                vec!["AntGravity.exe"],
            ),
        ],
        _ => vec![],
    };
    for (base, exes) in searches {
        if !exes.is_empty() {
            if let Some(p) = scan_subdirs_for_exe_deep(&base, &exes, 2) {
                return Some(p);
            }
        }
    }
    let lnk_hint = match tool_key {
        "vscode" => Some("visual studio code"),
        "cursor" => Some("cursor"),
        "windsurf" => Some("windsurf"),
        "antgravity" => Some("antigravity"),
        _ => None,
    };
    if let Some(hint) = lnk_hint {
        if let Some(p) = find_exe_from_start_menu(hint) {
            return Some(p);
        }
    }
    None
}

pub fn sanitize_args(args: &str) -> Result<String, String> {
    let banned = [';', '&', '|', '`', '$', '>', '<'];
    if args.chars().any(|c| banned.contains(&c)) {
        return Err("Argumentos contêm caracteres proibidos (; & | ` $ > <)".into());
    }
    Ok(args.trim().to_string())
}

pub fn user_home_dir_string() -> String {
    std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
}

pub fn validate_directory(dir: &str) -> Result<String, String> {
    if dir.is_empty() {
        return Ok(user_home_dir_string());
    }
    let path = std::path::Path::new(dir);
    if !path.exists() {
        return Err(format!("Diretório não existe: {}", dir));
    }
    if !path.is_dir() {
        return Err(format!("Não é um diretório: {}", dir));
    }
    Ok(dir.to_string())
}

// ============================================================
// LOGGING / CACHES
// ============================================================

pub fn append_install_log(key: &str, ok: bool, exit: i32) {
    use std::io::Write;
    if let Some(dir) = dirs::config_dir() {
        let log_dir = dir.join("ai-launcher");
        let _ = std::fs::create_dir_all(&log_dir);
        let log_path = log_dir.join("install.log");
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let now = chrono_format_local_now();
            let _ = writeln!(f, "[{}] key={} ok={} exit={}", now, key, ok, exit);
        }
    }
}

pub fn log_event(phase: &str, msg: &str) {
    use std::io::Write;
    let Some(dir) = dirs::config_dir() else {
        return;
    };
    let log_dir = dir.join("ai-launcher");
    let _ = std::fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("launcher.log");
    if let Ok(meta) = std::fs::metadata(&log_path) {
        if meta.len() > 1_000_000 {
            let old_path = log_dir.join("launcher.log.old");
            let _ = std::fs::remove_file(&old_path);
            let _ = std::fs::rename(&log_path, &old_path);
        }
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = writeln!(f, "[{}] {} | {}", chrono_format_local_now(), phase, msg);
    }
}

pub fn chrono_format_local_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    now.to_string()
}

// ============================================================
// NPM LATEST CACHE
// ============================================================

static NPM_LATEST_CACHE: std::sync::LazyLock<
    std::sync::Mutex<HashMap<String, (String, std::time::Instant)>>,
> = std::sync::LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

const NPM_CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(15 * 60);

pub fn npm_latest(pkg: &str) -> Option<String> {
    if let Ok(cache) = NPM_LATEST_CACHE.lock() {
        if let Some((ver, at)) = cache.get(pkg) {
            if at.elapsed() < NPM_CACHE_TTL {
                return Some(ver.clone());
            }
        }
    }
    let (_, raw) = run_silent("npm", &["view", pkg, "version"]);
    let ver = raw.as_ref().and_then(|v| extract_version(v))?;
    if let Ok(mut cache) = NPM_LATEST_CACHE.lock() {
        cache.insert(pkg.to_string(), (ver.clone(), std::time::Instant::now()));
    }
    Some(ver)
}

// ============================================================
// INSTALL STREAMING (shared between cli::install_cli, updates::install_prerequisite, etc.)
// ============================================================

pub const DEFAULT_INSTALL_TIMEOUT_SEC: u64 = 300;

pub async fn stream_install(
    app: tauri::AppHandle,
    key: String,
    program: String,
    args: Vec<String>,
) -> Result<String, String> {
    use tauri::Emitter;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command as TokioCommand;

    let program_resolved = resolve_windows_cmd(&program);
    let mut cmd = TokioCommand::new(&program_resolved);
    cmd.args(&args);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = app.emit(
        "install-progress",
        ProgressEvent {
            key: key.clone(),
            phase: "start".into(),
            line: format!("$ {} {}", program, args.join(" ")),
        },
    );

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Falha ao iniciar {}: {}", program, e))?;

    if let Some(stdout) = child.stdout.take() {
        let app_c = app.clone();
        let key_c = key.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_c.emit(
                    "install-progress",
                    ProgressEvent {
                        key: key_c.clone(),
                        phase: "stdout".into(),
                        line,
                    },
                );
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app_c = app.clone();
        let key_c = key.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_c.emit(
                    "install-progress",
                    ProgressEvent {
                        key: key_c.clone(),
                        phase: "stderr".into(),
                        line,
                    },
                );
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Erro aguardando processo: {}", e))?;

    let phase = if status.success() { "done" } else { "error" };
    let _ = app.emit(
        "install-progress",
        ProgressEvent {
            key: key.clone(),
            phase: phase.into(),
            line: format!("Exit code: {}", status.code().unwrap_or(-1)),
        },
    );

    append_install_log(&key, status.success(), status.code().unwrap_or(-1));

    if status.success() {
        Ok(format!("{}: sucesso", key))
    } else {
        Err(format!(
            "{}: falhou (exit {})",
            key,
            status.code().unwrap_or(-1)
        ))
    }
}

// ============================================================
// TRAY CONFIG (shared read/write for commands::system + tray.rs)
// ============================================================

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

// ============================================================
// CRASH DIR (shared between commands::config + commands::system)
// ============================================================

pub fn crash_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ai-launcher")
        .join("crash")
}

// ============================================================
// TESTS (moved from main.rs)
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_version_simple() {
        assert_eq!(extract_version("1.2.3"), Some("1.2.3".into()));
        assert_eq!(extract_version("v2.0.1"), Some("2.0.1".into()));
    }

    #[test]
    fn extract_version_last_wins() {
        let out = "node v22.13.0\nclaude 0.8.2";
        assert_eq!(extract_version(out), Some("0.8.2".into()));
    }

    #[test]
    fn extract_version_strips_ansi() {
        let out = "\x1b[32mclaude\x1b[0m version \x1b[1m1.5.7\x1b[0m";
        assert_eq!(extract_version(out), Some("1.5.7".into()));
    }

    #[test]
    fn extract_version_with_prerelease() {
        assert_eq!(
            extract_version("gemini 2.0.0-beta.3"),
            Some("2.0.0-beta.3".into())
        );
    }

    #[test]
    fn extract_version_none_when_no_digits() {
        assert_eq!(extract_version("hello world"), None);
    }

    #[test]
    fn sanitize_args_accepts_safe() {
        assert_eq!(sanitize_args("--verbose").unwrap(), "--verbose");
        assert_eq!(sanitize_args("").unwrap(), "");
        assert_eq!(
            sanitize_args("--model=claude-3").unwrap(),
            "--model=claude-3"
        );
    }

    #[test]
    fn sanitize_args_rejects_injection() {
        for bad in &[
            "a; rm", "a && b", "a | b", "a > file", "a < file", "a`c`", "a$x",
        ] {
            assert!(sanitize_args(bad).is_err(), "should reject: {}", bad);
        }
    }

    #[test]
    fn compare_versions_basic() {
        assert!(compare_versions("1.0.0", "1.0.1"));
        assert!(compare_versions("1.0.0", "2.0.0"));
        assert!(!compare_versions("1.0.0", "1.0.0"));
        assert!(!compare_versions("2.0.0", "1.0.0"));
    }
}
