#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

// ============================================================
// TIPOS
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
    pub install_method: String, // "npm" | "pip" | "script" | "browser"
    pub install_url: Option<String>, // para "script" ou "browser"
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
    pub method: String, // "npm" | "pip" | "browser" | "script" | "none"
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
struct ProgressEvent {
    key: String,
    phase: String,
    line: String,
}

// ============================================================
// DEFINIÇÕES
// ============================================================

fn get_cli_definitions() -> Vec<CliInfo> {
    let list: Vec<CliInfo> = vec![
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
            // Fork anomalyco/opencode (npm opencode-ai) aceita esta flag.
            // Fallback upstream sst: env OPENCODE_PERMISSION='{"*":"allow"}'.
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
            // README oficial charmbracelet/crush documenta --yolo (não -y).
            flag: Some("--yolo".into()),
            install_cmd: "npm install -g @charmland/crush".into(),
            version_cmd: "crush --version".into(),
            npm_pkg: Some("@charmland/crush".into()),
            pip_pkg: None,
            install_method: "npm".into(),
            install_url: None,
        },
        // Factory Droid — instalação via PowerShell `irm ... | iex` (nativo Windows)
        CliInfo {
            key: "droid".into(),
            name: "Factory Droid".into(),
            command: "droid".into(),
            // --skip-permissions-unsafe = YOLO total (paridade com as outras).
            // Alternativa tiered: --auto high (respeita denylist).
            flag: Some("--skip-permissions-unsafe".into()),
            install_cmd: "irm https://app.factory.ai/cli/windows | iex".into(),
            version_cmd: "droid --version".into(),
            npm_pkg: None,
            pip_pkg: None,
            install_method: "script".into(),
            install_url: Some("https://docs.factory.ai/cli/getting-started/quickstart".into()),
        },
    ];
    list
}

fn get_tool_definitions() -> Vec<ToolInfo> {
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
// HELPERS
// ============================================================

fn resolve_windows_cmd(cmd: &str) -> String {
    match cmd {
        "npm" | "pnpm" | "yarn" | "pip" | "tauri" | "bun" | "code" | "cursor" | "windsurf" => {
            format!("{}.cmd", cmd)
        }
        _ => cmd.to_string(),
    }
}

/// Timeout padrão para subprocessos síncronos (npm list, pip show, --version).
const RUN_SILENT_TIMEOUT_SECS: u64 = 15;

/// Executa comando com timeout. Se exceder, mata o processo (taskkill no Windows)
/// e retorna `(false, None)`. Todos os chamadores novos devem usar esta função —
/// `run_silent` é só um alias com timeout padrão.
fn run_silent_with_timeout(
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
            // Timeout ou erro de join: mata o processo pendurado
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

fn run_silent(cmd: &str, args: &[&str]) -> (bool, Option<String>) {
    run_silent_with_timeout(cmd, args, RUN_SILENT_TIMEOUT_SECS)
}

fn command_exists(cmd: &str) -> bool {
    // 1) where.exe no PATH
    let mut c = Command::new("where");
    c.arg(cmd);
    c.creation_flags(CREATE_NO_WINDOW);
    if c.output().map(|o| o.status.success()).unwrap_or(false) {
        return true;
    }
    // 2) Fallback: %APPDATA%\npm\<cmd>.cmd|.ps1|.exe
    // (npm globals que não estão no PATH da sessão)
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
    // 3) Fallback: %LOCALAPPDATA%\npm
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

/// Remove códigos ANSI (colorização) do output.
fn strip_ansi(s: &str) -> String {
    let re = regex_lite::Regex::new(r"\x1b\[[0-9;?]*[a-zA-Z]").unwrap();
    re.replace_all(s, "").to_string()
}

/// Extrai versão semver de forma robusta: preferência por última linha com padrão,
/// ignora ANSI, ignora versões de dependências (node v22 no banner).
fn extract_version(output: &str) -> Option<String> {
    let clean = strip_ansi(output);
    // Sem \b para casar padrões como "v2.0.1" onde v+digit não formam boundary
    let re = regex_lite::Regex::new(r"(\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?)").ok()?;

    let mut candidates: Vec<String> = Vec::new();
    for line in clean.lines() {
        for m in re.find_iter(line) {
            candidates.push(m.as_str().to_string());
        }
    }
    if candidates.is_empty() {
        // Tentativa com padrão menor (x.y) — sem \b
        let re2 = regex_lite::Regex::new(r"(\d+\.\d+)").ok()?;
        return re2.find(&clean).map(|m| m.as_str().to_string());
    }
    // Prefere a última (normalmente a versão do próprio CLI vem depois do banner)
    candidates.into_iter().last()
}

/// Fonte única de verdade para "qual versão está instalada agora".
/// Ordem: npm global json → pip show → resolved path --version → PATH puro.
/// Todas as funções de check/update DEVEM usar este helper.
fn get_installed_version(cli: &CliInfo) -> Option<String> {
    // 1) npm list -g --json (mais confiável — não depende de PATH)
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
    // 2) pip show
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
    // 3) resolved path (evita shim quebrado em Windows)
    if let Some(resolved) = resolve_cli_path_win(&cli.command) {
        let (_, out) = run_silent(&resolved, &["--version"]);
        if let Some(ref s) = out {
            if let Some(ver) = extract_version(s) {
                return Some(ver);
            }
        }
    }
    // 4) fallback: PATH puro (último recurso)
    let (_, out) = run_silent(&cli.command, &["--version"]);
    out.as_ref().and_then(|s| extract_version(s))
}

fn check_cli_installed(cli: &CliInfo) -> (bool, Option<String>) {
    if let Some(ver) = get_installed_version(cli) {
        return (true, Some(ver));
    }
    // Se não conseguiu versão mas binário existe no PATH ou npm shim
    if command_exists(&cli.command) {
        return (true, Some("detectado".into()));
    }
    (false, None)
}

fn compare_versions(current: &str, latest: &str) -> bool {
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

fn find_windows_terminal() -> Option<String> {
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

fn expand_env(path: &str) -> String {
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

/// Scan recursivo (até profundidade N) procurando executável.
/// Apps Squirrel podem ter `app-X.Y.Z/`, alguns têm `app-X.Y.Z/app/`.
fn scan_subdirs_for_exe_deep(base_dir: &str, exe_names: &[&str], depth: u32) -> Option<PathBuf> {
    let path = std::path::Path::new(base_dir);
    if !path.exists() {
        return None;
    }
    // Direto na pasta
    for exe in exe_names {
        let direct = path.join(exe);
        if direct.exists() {
            return Some(direct);
        }
    }
    if depth == 0 {
        return None;
    }
    // Subpastas: ordena reversa (pega versão mais alta primeiro)
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

/// Compat shim — chama scan_subdirs_for_exe_deep com depth=1.
/// Mantido para call-sites futuros que precisem apenas de 1 nível.
#[allow(dead_code)]
fn scan_subdirs_for_exe(base_dir: &str, exe_names: &[&str]) -> Option<PathBuf> {
    scan_subdirs_for_exe_deep(base_dir, exe_names, 1)
}

/// Tenta ler o .lnk (atalho do Start Menu) para descobrir path do executável real.
/// Fallback muito útil para apps MS Store ou com localização exótica.
fn find_exe_from_start_menu(lnk_name_contains: &str) -> Option<PathBuf> {
    let candidates = [
        expand_env(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs"),
        expand_env(r"%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs"),
    ];
    for base in &candidates {
        let path = std::path::Path::new(base);
        if !path.exists() {
            continue;
        }
        // Walk recursivo simples
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
                                // Resolve o .lnk via PowerShell (nativo e confiável)
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

/// Detecção robusta de Python. `python --version` pode retornar o stub da MS Store.
fn detect_python() -> (bool, Option<String>) {
    let is_valid_output = |s: &str| -> bool {
        !s.to_lowercase().contains("was not found")
            && !s.to_lowercase().contains("microsoft store")
            && !s.to_lowercase().contains("executemanually")
            && s.to_lowercase().contains("python")
    };

    // 1) python --version
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
    // 2) py launcher
    let (ok2, out2) = run_silent("py", &["--version"]);
    if ok2 {
        if let Some(ref s) = out2 {
            if let Some(ver) = extract_version(s) {
                return (true, Some(ver));
            }
        }
    }
    // 3) python3
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
    // 4) Scan paths conhecidos
    {
        let bases = [
            expand_env(r"%LOCALAPPDATA%\Programs\Python"),
            expand_env(r"%PROGRAMFILES%\Python"),
            expand_env(r"%PROGRAMFILES%"),
        ];
        for base in &bases {
            // Scan nível 2 porque pode ser Programs\Python\Python312\python.exe
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

/// Codifica um script PowerShell em UTF-16 LE + base64 para passar via
/// `-EncodedCommand`. Evita qualquer problema de escaping de `;`, `"`, `'`,
/// ou quebras de linha — especialmente importante quando o comando é
/// passado via `wt.exe new-tab`, que trata `;` como separador de ação.
fn encode_powershell_command(script: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let mut bytes = Vec::with_capacity(script.len() * 2);
    for w in script.encode_utf16() {
        bytes.extend_from_slice(&w.to_le_bytes());
    }
    STANDARD.encode(&bytes)
}

/// HTTP agent compartilhado (usa `ureq` com backend TLS padrão = rustls).
/// Evita dependência de `native-tls` / `TlsConnector` explícito (que causou
/// "no TLS backend is configured" em v3.2.4 e panic silencioso em v3.2.3).
fn http_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent(concat!("ai-launcher-pro/", env!("CARGO_PKG_VERSION")))
        .build()
}

/// Fetch via HTTP: versão latest do VS Code (API oficial)
fn fetch_vscode_latest() -> Option<String> {
    let resp = http_agent()
        .get("https://update.code.visualstudio.com/api/releases/stable/win32-x64/version")
        .call()
        .ok()?;
    let json: serde_json::Value = resp.into_json().ok()?;
    json["productVersion"].as_str().map(|s| s.to_string())
}

/// Fetch via GitHub releases API (public). Retorna tag name limpo.
fn fetch_github_latest(repo: &str) -> Option<String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    let resp = http_agent().get(&url).call().ok()?;
    let json: serde_json::Value = resp.into_json().ok()?;
    json["tag_name"]
        .as_str()
        .map(|s| s.trim_start_matches('v').to_string())
}

/// Verifica a última release no repositório oficial no GitHub.
/// Usado pela StatusBar para indicar disponibilidade de update.
#[tauri::command]
fn check_latest_release() -> Result<serde_json::Value, String> {
    let agent = http_agent();
    let url = "https://api.github.com/repos/HelbertMoura/ai_launcher/releases/latest";
    let resp = agent
        .get(url)
        .set(
            "User-Agent",
            &format!("ai-launcher/{}", env!("CARGO_PKG_VERSION")),
        )
        .call()
        .map_err(|e| format!("fetch error: {e}"))?;
    let json: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    Ok(json)
}

/// Resolve o caminho absoluto de um CLI (ex: `claude` → `C:\Users\X\AppData\Roaming\npm\claude.cmd`).
/// Evita depender do PATH da sessão do launcher, que pode estar stale.
///
/// Ordem em 3 níveis:
/// 1) npm globals (mais confiável pra CLIs npm)
/// 2) `where.exe` pulando shims quebrados conhecidos (`.local\bin\` do instalador
///    Anthropic antigo)
/// 3) `where.exe` aceitando qualquer resultado (último recurso — melhor tentar um
///    path potencialmente problemático do que retornar None e cair em `claude`
///    puro sem PATH)
fn resolve_cli_path_win(cmd: &str) -> Option<String> {
    // 1) npm globals
    for prefix in [r"%APPDATA%\npm\", r"%LOCALAPPDATA%\npm\"] {
        let base = expand_env(prefix);
        for ext in &["cmd", "exe", "ps1", "bat"] {
            let full = format!("{}{}.{}", base, cmd, ext);
            if std::path::Path::new(&full).exists() {
                return Some(full);
            }
        }
    }
    // Coleta todos resultados de `where <cmd>`
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

    // 2) where sem shims quebrados
    for path in &where_results {
        if !path.to_lowercase().contains(r"\.local\bin\") {
            return Some(path.clone());
        }
    }
    // 3) where com qualquer resultado (último recurso)
    if let Some(first) = where_results.first() {
        return Some(first.clone());
    }
    None
}

/// Busca binário de IDE/tool em caminhos conhecidos do Windows, com scan recursivo nível 1.
fn find_tool_path(tool_key: &str) -> Option<PathBuf> {
    // (base_dir, [exe_names])
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
            // Scan nível 2 (Squirrel pode ser app-X.Y.Z\app\)
            if let Some(p) = scan_subdirs_for_exe_deep(&base, &exes, 2) {
                return Some(p);
            }
        }
    }
    // Fallback: procura no Start Menu por atalho com nome contendo a chave
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

/// Sanitiza args do usuário contra command injection.
fn sanitize_args(args: &str) -> Result<String, String> {
    let banned = [';', '&', '|', '`', '$', '>', '<'];
    if args.chars().any(|c| banned.contains(&c)) {
        return Err("Argumentos contêm caracteres proibidos (; & | ` $ > <)".into());
    }
    Ok(args.trim().to_string())
}

/// Retorna home dir do usuário.
fn user_home_dir_string() -> String {
    std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
}

/// Valida que diretório existe e é uma pasta.
fn validate_directory(dir: &str) -> Result<String, String> {
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
// COMANDOS TAURI — CHECK/READ
// ============================================================

#[tauri::command]
fn check_environment() -> Vec<CheckResult> {
    let mut results = vec![];

    let (npm_ok, npm_ver) = run_silent("npm", &["--version"]);
    let (_, node_ver) = run_silent("node", &["--version"]);
    results.push(CheckResult {
        name: "Node.js / npm".into(),
        installed: npm_ok,
        version: Some(format!(
            "Node {} / npm {}",
            node_ver.unwrap_or_else(|| "—".into()),
            npm_ver.unwrap_or_else(|| "—".into())
        )),
        install_command: Some("https://nodejs.org".into()),
    });

    let (py_ok, py_ver) = detect_python();
    let (pip_ok, _) = run_silent("pip", &["--version"]);
    results.push(CheckResult {
        name: "Python / pip".into(),
        installed: py_ok || pip_ok, // py_ok é primary; pip_ok complementa
        version: py_ver.map(|v| format!("Python {}", v)),
        install_command: Some("https://python.org".into()),
    });

    let (git_ok, git_ver) = run_silent("git", &["--version"]);
    results.push(CheckResult {
        name: "Git".into(),
        installed: git_ok,
        version: git_ver,
        install_command: Some("https://git-scm.com".into()),
    });

    let (rust_ok, rust_ver) = run_silent("rustc", &["--version"]);
    results.push(CheckResult {
        name: "Rust".into(),
        installed: rust_ok,
        version: rust_ver,
        install_command: Some("https://rustup.rs".into()),
    });

    let (cargo_ok, cargo_ver) = run_silent("cargo", &["--version"]);
    if cargo_ok {
        results.push(CheckResult {
            name: "Cargo".into(),
            installed: true,
            version: cargo_ver,
            install_command: Some("Instalado com Rust".into()),
        });
    }

    let (pnpm_ok, pnpm_ver) = run_silent("pnpm", &["--version"]);
    results.push(CheckResult {
        name: "pnpm".into(),
        installed: pnpm_ok,
        version: pnpm_ver,
        install_command: Some("npm install -g pnpm".into()),
    });

    let (yarn_ok, yarn_ver) = run_silent("yarn", &["--version"]);
    results.push(CheckResult {
        name: "yarn".into(),
        installed: yarn_ok,
        version: yarn_ver,
        install_command: Some("npm install -g yarn".into()),
    });

    let (bun_ok, bun_ver) = run_silent("bun", &["--version"]);
    results.push(CheckResult {
        name: "Bun".into(),
        installed: bun_ok,
        version: bun_ver,
        install_command: Some("https://bun.sh".into()),
    });

    let wt_found = find_windows_terminal().is_some();
    results.push(CheckResult {
        name: "Windows Terminal".into(),
        installed: wt_found,
        version: if wt_found {
            Some("Disponível".into())
        } else {
            None
        },
        install_command: Some("Microsoft Store → Windows Terminal".into()),
    });

    let (pwsh_ok, pwsh_ver) = run_silent("pwsh", &["--version"]);
    results.push(CheckResult {
        name: "PowerShell 7+".into(),
        installed: pwsh_ok,
        version: pwsh_ver,
        install_command: Some("https://github.com/PowerShell/PowerShell".into()),
    });

    let (gitlfs_ok, gitlfs_ver) = run_silent("git", &["lfs", "version"]);
    results.push(CheckResult {
        name: "Git LFS".into(),
        installed: gitlfs_ok,
        version: gitlfs_ver,
        install_command: Some("https://git-lfs.github.com".into()),
    });

    let (docker_ok, docker_ver) = run_silent("docker", &["--version"]);
    results.push(CheckResult {
        name: "Docker".into(),
        installed: docker_ok,
        version: docker_ver,
        install_command: Some("https://docker.com".into()),
    });

    let (vscode_ok, vscode_ver) = run_silent("code", &["--version"]);
    results.push(CheckResult {
        name: "VS Code".into(),
        installed: vscode_ok,
        version: vscode_ver.map(|v| v.lines().next().unwrap_or("").to_string()),
        install_command: Some("https://code.visualstudio.com".into()),
    });

    let (tauri_ok, _) = run_silent("npm", &["list", "-g", "@tauri-apps/cli", "--depth=0"]);
    let (_, tauri_ver) = run_silent("tauri", &["--version"]);
    results.push(CheckResult {
        name: "Tauri CLI".into(),
        installed: tauri_ok,
        version: tauri_ver,
        install_command: Some("npm install -g @tauri-apps/cli".into()),
    });

    results
}

#[tauri::command]
fn check_clis() -> Vec<CheckResult> {
    get_cli_definitions()
        .iter()
        .map(|cli| {
            let (installed, version) = check_cli_installed(cli);
            CheckResult {
                name: cli.name.clone(),
                installed,
                version,
                install_command: Some(cli.install_cmd.clone()),
            }
        })
        .collect()
}

/// Cache em memória para `npm view <pkg> version`.
/// TTL 15 min — evita re-hit npm registry em verificações repetidas.
static NPM_LATEST_CACHE: std::sync::LazyLock<
    std::sync::Mutex<HashMap<String, (String, std::time::Instant)>>,
> = std::sync::LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

const NPM_CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(15 * 60);

fn npm_latest(pkg: &str) -> Option<String> {
    // Cache hit
    if let Ok(cache) = NPM_LATEST_CACHE.lock() {
        if let Some((ver, at)) = cache.get(pkg) {
            if at.elapsed() < NPM_CACHE_TTL {
                return Some(ver.clone());
            }
        }
    }
    // Miss: fetch e armazena
    let (_, raw) = run_silent("npm", &["view", pkg, "version"]);
    let ver = raw.as_ref().and_then(|v| extract_version(v))?;
    if let Ok(mut cache) = NPM_LATEST_CACHE.lock() {
        cache.insert(pkg.to_string(), (ver.clone(), std::time::Instant::now()));
    }
    Some(ver)
}

#[tauri::command]
fn check_cli_updates() -> Vec<UpdateInfo> {
    get_cli_definitions()
        .into_iter()
        .map(|cli| {
            let current = get_installed_version(&cli);
            let latest = cli.npm_pkg.as_ref().and_then(|p| npm_latest(p));
            let has_update = match (&current, &latest) {
                (Some(c), Some(l)) => compare_versions(c, l),
                _ => false,
            };
            let no_api = latest.is_none();
            UpdateInfo {
                cli: cli.name,
                current,
                latest,
                has_update,
                method: cli.install_method.clone(),
                no_api,
                key: None,
            }
        })
        .collect()
}

#[tauri::command]
fn check_env_updates() -> Vec<UpdateInfo> {
    // (display_name, command, npm_pkg_or_none, update_key_for_frontend)
    let items: Vec<(&str, &str, Option<&str>, &str)> = vec![
        ("Node.js", "node", None, "node"),
        ("npm", "npm", Some("npm"), "npm"),
        ("Git", "git", None, "git"),
        ("Python", "python", None, "python"),
        ("Rust", "rustc", None, "rust"),
        ("pnpm", "pnpm", Some("pnpm"), "pnpm"),
        ("yarn", "yarn", Some("yarn"), "yarn"),
        ("Bun", "bun", None, "bun"),
        ("Tauri CLI", "tauri", Some("@tauri-apps/cli"), "tauri"),
    ];
    items
        .into_iter()
        .filter(|(_, cmd, _, _)| command_exists(cmd))
        .map(|(name, cmd, pkg, key)| {
            let (_, current_raw) = run_silent(cmd, &["--version"]);
            let current = current_raw.as_ref().and_then(|v| extract_version(v));
            let latest = pkg.and_then(npm_latest);
            let has_update = match (&current, &latest) {
                (Some(c), Some(l)) => compare_versions(c, l),
                _ => false,
            };
            let no_api = latest.is_none();
            UpdateInfo {
                cli: name.to_string(),
                current,
                latest,
                has_update,
                method: if pkg.is_some() {
                    "npm".into()
                } else {
                    "browser".into()
                },
                no_api,
                key: Some(key.to_string()),
            }
        })
        .collect()
}

#[tauri::command]
fn check_tool_updates() -> Vec<UpdateInfo> {
    get_tool_definitions()
        .iter()
        .filter_map(|tool| {
            let cmd_in_path = command_exists(&tool.command);
            let path = find_tool_path(&tool.key);
            let has_binary = path.is_some();
            if !cmd_in_path && !has_binary {
                return None;
            }
            let current = if cmd_in_path {
                let (_, v) = run_silent(&tool.command, &["--version"]);
                v.and_then(|s| extract_version(&s))
                    .or_else(|| Some("detectado".to_string()))
            } else {
                Some("detectado".to_string())
            };
            let latest = match tool.key.as_str() {
                "vscode" => fetch_vscode_latest(),
                "cursor" => fetch_github_latest("getcursor/cursor"),
                "windsurf" => fetch_github_latest("codeium/windsurf"),
                _ => None,
            };
            let has_update = match (&current, &latest) {
                (Some(c), Some(l)) if c != "detectado" => compare_versions(c, l),
                _ => false,
            };
            let no_api = latest.is_none();
            Some(UpdateInfo {
                cli: tool.name.clone(),
                current,
                latest,
                has_update,
                method: "browser".into(),
                no_api,
                key: Some(tool.key.clone()),
            })
        })
        .collect()
}

#[tauri::command]
async fn check_all_updates(app: tauri::AppHandle) -> Result<UpdatesSummary, String> {
    let _ = app.emit("updates-progress", "start");

    // Roda os 3 checks em paralelo via spawn_blocking para não bloquear o
    // executor Tokio (cada check dispara múltiplos subprocessos npm/pip
    // síncronos). Bônus: paraleliza CLIs + env + tools.
    let app_cli = app.clone();
    let app_env = app.clone();
    let app_tool = app.clone();
    let cli_task = tokio::task::spawn_blocking(move || {
        let r = check_cli_updates();
        let _ = app_cli.emit("updates-progress", "clis-done");
        r
    });
    let env_task = tokio::task::spawn_blocking(move || {
        let r = check_env_updates();
        let _ = app_env.emit("updates-progress", "env-done");
        r
    });
    let tool_task = tokio::task::spawn_blocking(move || {
        let r = check_tool_updates();
        let _ = app_tool.emit("updates-progress", "tools-done");
        r
    });

    let (cli_updates, env_updates, tool_updates) = tokio::try_join!(cli_task, env_task, tool_task)
        .map_err(|e| format!("Falha interna ao verificar updates: {}", e))?;

    let total = cli_updates.iter().filter(|u| u.has_update).count()
        + env_updates.iter().filter(|u| u.has_update).count();

    Ok(UpdatesSummary {
        cli_updates,
        env_updates,
        tool_updates,
        checked_at: chrono_format_local_now(),
        total_with_updates: total,
    })
}

fn chrono_format_local_now() -> String {
    // Evita dependência do crate chrono — usa std::time::SystemTime
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Formato simples: epoch seconds (frontend formata)
    now.to_string()
}

#[tauri::command]
fn check_tools() -> Vec<CheckResult> {
    get_tool_definitions()
        .iter()
        .map(|tool| {
            let cmd_in_path = command_exists(&tool.command);
            let path = find_tool_path(&tool.key);
            let has_binary = path.is_some();
            let installed = cmd_in_path || has_binary;

            let version = if cmd_in_path {
                let (_, v) = run_silent(&tool.command, &["--version"]);
                v.and_then(|s| extract_version(&s))
                    .or(Some("detectado".into()))
            } else if has_binary {
                Some("detectado".into())
            } else {
                None
            };

            CheckResult {
                name: tool.name.clone(),
                installed,
                version,
                install_command: Some(tool.install_hint.clone()),
            }
        })
        .collect()
}

#[tauri::command]
fn get_all_clis() -> Vec<CliInfo> {
    get_cli_definitions()
}

#[tauri::command]
fn get_all_tools() -> Vec<ToolInfo> {
    get_tool_definitions()
}

// ============================================================
// INSTALL / UPDATE ASYNC STREAMING
// ============================================================

async fn stream_install(
    app: tauri::AppHandle,
    key: String,
    program: String,
    args: Vec<String>,
) -> Result<String, String> {
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

    // Persiste log
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

fn append_install_log(key: &str, ok: bool, exit: i32) {
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

/// Log estruturado rotativo em `%APPDATA%\ai-launcher\launcher.log`.
/// Rotaciona quando passa de 1 MB (renomeia atual para `.old`).
/// Falhas silenciosas — log nunca deve propagar erro pro caller.
fn log_event(phase: &str, msg: &str) {
    use std::io::Write;
    let Some(dir) = dirs::config_dir() else {
        return;
    };
    let log_dir = dir.join("ai-launcher");
    let _ = std::fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("launcher.log");
    // Rotação
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
        let _ = writeln!(
            f,
            "[{}] {} | {}",
            chrono_format_local_now(),
            phase,
            msg
        );
    }
}

// v7.1: install/update timeout wrapper.
// Default: 300s (5min). Overridable per-call via the optional `timeout_sec`
// argument sent by the frontend (sourced from AppSettings.commandTimeout).
// `browser` path short-circuits (no process spawned → no timeout needed).
const DEFAULT_INSTALL_TIMEOUT_SEC: u64 = 300;

#[tauri::command]
async fn install_cli(
    app: tauri::AppHandle,
    cli_key: String,
    timeout_sec: Option<u64>,
) -> Result<String, String> {
    let clis = get_cli_definitions();
    let cli = clis
        .iter()
        .find(|c| c.key == cli_key)
        .ok_or_else(|| format!("CLI não encontrado: {}", cli_key))?;

    let key_for_work = cli_key.clone();
    let install_method = cli.install_method.clone();
    let npm_pkg = cli.npm_pkg.clone();
    let pip_pkg = cli.pip_pkg.clone();
    let install_cmd = cli.install_cmd.clone();
    let install_url = cli.install_url.clone();

    let secs = timeout_sec.unwrap_or(DEFAULT_INSTALL_TIMEOUT_SEC);
    let work = async move {
        match install_method.as_str() {
            "npm" => {
                let pkg = npm_pkg.ok_or("Pacote npm ausente")?;
                stream_install(
                    app,
                    key_for_work,
                    "npm".into(),
                    vec!["install".into(), "-g".into(), pkg],
                )
                .await
            }
            "pip" => {
                let pkg = pip_pkg.ok_or("Pacote pip ausente")?;
                stream_install(
                    app,
                    key_for_work,
                    "pip".into(),
                    vec!["install".into(), pkg],
                )
                .await
            }
            "script" => {
                // Factory Droid: `irm https://app.factory.ai/cli/windows | iex` via PowerShell
                stream_install(
                    app,
                    key_for_work,
                    "pwsh".into(),
                    vec!["-Command".into(), install_cmd],
                )
                .await
            }
            "browser" => {
                if let Some(url) = install_url {
                    open::that(&url).map_err(|e| e.to_string())?;
                    Ok(format!("Abrindo {}", url))
                } else {
                    Err("URL de instalação ausente".into())
                }
            }
            other => Err(format!("Método desconhecido: {}", other)),
        }
    };

    match tokio::time::timeout(std::time::Duration::from_secs(secs), work).await {
        Ok(result) => result,
        Err(_) => {
            log_event(
                "install_cli",
                &format!("timeout key={} after {}s", cli_key, secs),
            );
            Err(format!("Comando excedeu o tempo limite de {}s", secs))
        }
    }
}

#[tauri::command]
async fn update_cli(
    app: tauri::AppHandle,
    cli_key: String,
    timeout_sec: Option<u64>,
) -> Result<String, String> {
    log_event("update_cli", &format!("start key={}", cli_key));
    let clis = get_cli_definitions();
    let cli = clis
        .iter()
        .find(|c| c.key == cli_key)
        .ok_or_else(|| format!("CLI não encontrado: {}", cli_key))?;

    let key_for_work = cli_key.clone();
    let install_method = cli.install_method.clone();
    let npm_pkg = cli.npm_pkg.clone();
    let pip_pkg = cli.pip_pkg.clone();
    let install_cmd = cli.install_cmd.clone();

    let secs = timeout_sec.unwrap_or(DEFAULT_INSTALL_TIMEOUT_SEC);
    let work = async move {
        match install_method.as_str() {
            "npm" => {
                let pkg = npm_pkg.ok_or("Pacote npm ausente")?;
                stream_install(
                    app,
                    key_for_work,
                    "npm".into(),
                    vec!["install".into(), "-g".into(), format!("{}@latest", pkg)],
                )
                .await
            }
            "pip" => {
                let pkg = pip_pkg.ok_or("Pacote pip ausente")?;
                stream_install(
                    app,
                    key_for_work,
                    "pip".into(),
                    vec!["install".into(), "--upgrade".into(), pkg],
                )
                .await
            }
            "script" => {
                // Re-executa o script de install (Droid se atualiza via mesmo comando)
                stream_install(
                    app,
                    key_for_work,
                    "pwsh".into(),
                    vec!["-Command".into(), install_cmd],
                )
                .await
            }
            other => Err(format!("Atualização via '{}' não suportada", other)),
        }
    };

    match tokio::time::timeout(std::time::Duration::from_secs(secs), work).await {
        Ok(result) => result,
        Err(_) => {
            log_event(
                "update_cli",
                &format!("timeout key={} after {}s", cli_key, secs),
            );
            Err(format!("Comando excedeu o tempo limite de {}s", secs))
        }
    }
}

#[tauri::command]
async fn update_all_clis(app: tauri::AppHandle) -> Result<String, String> {
    // spawn_blocking: check_cli_updates chama npm list síncrono
    let updates = tokio::task::spawn_blocking(check_cli_updates)
        .await
        .map_err(|e| format!("Falha interna: {}", e))?;
    let clis = get_cli_definitions();
    let mut seen_pkgs: std::collections::HashSet<String> = Default::default();
    let mut count = 0;
    let mut errors: Vec<String> = Vec::new();

    for u in &updates {
        if !u.has_update {
            continue;
        }
        let Some(cli) = clis.iter().find(|c| c.name == u.cli) else {
            continue;
        };
        // Dedupe: 3 variantes do claude-code não devem rodar 3x
        if let Some(ref pkg) = cli.npm_pkg {
            if !seen_pkgs.insert(pkg.clone()) {
                continue;
            }
        }
        match update_cli(app.clone(), cli.key.clone(), None).await {
            Ok(_) => count += 1,
            Err(e) => errors.push(format!("{}: {}", cli.name, e)),
        }
    }

    log_event(
        "update_all",
        &format!("ok={} errors={}", count, errors.len()),
    );
    if errors.is_empty() {
        Ok(format!("{} pacote(s) atualizado(s)", count))
    } else {
        Ok(format!(
            "{} ok, {} erro(s): {}",
            count,
            errors.len(),
            errors.join(" | ")
        ))
    }
}

#[tauri::command]
async fn install_prerequisite(app: tauri::AppHandle, key: String) -> Result<String, String> {
    let url_for = |u: &str| -> Result<String, String> {
        open::that(u).map_err(|e| e.to_string())?;
        Ok(format!("Abrindo {}", u))
    };

    match key.as_str() {
        "node" => url_for("https://nodejs.org/"),
        "git" => url_for("https://git-scm.com/downloads"),
        "python" => url_for("https://www.python.org/downloads/"),
        "rust" => url_for("https://rustup.rs/"),
        "bun" => url_for("https://bun.sh"),
        "docker" => url_for("https://www.docker.com/products/docker-desktop/"),
        "windows-terminal" | "wt" => {
            open::that("ms-windows-store://pdp/?productid=9N0DX20HK701")
                .or_else(|_| open::that("https://aka.ms/terminal"))
                .map_err(|e| e.to_string())?;
            Ok("Abrindo Microsoft Store".into())
        }
        "vscode" => url_for("https://code.visualstudio.com/Download"),
        "git-lfs" => url_for("https://git-lfs.com/"),
        "powershell" => url_for("https://github.com/PowerShell/PowerShell/releases/latest"),
        "pnpm" => {
            stream_install(
                app,
                "pnpm".into(),
                "npm".into(),
                vec!["install".into(), "-g".into(), "pnpm".into()],
            )
            .await
        }
        "yarn" => {
            stream_install(
                app,
                "yarn".into(),
                "npm".into(),
                vec!["install".into(), "-g".into(), "yarn".into()],
            )
            .await
        }
        "tauri" => {
            stream_install(
                app,
                "tauri".into(),
                "npm".into(),
                vec!["install".into(), "-g".into(), "@tauri-apps/cli".into()],
            )
            .await
        }
        _ => Err(format!("Pré-requisito desconhecido: {}", key)),
    }
}

#[tauri::command]
async fn update_prerequisite(app: tauri::AppHandle, key: String) -> Result<String, String> {
    // Itens atualizáveis via npm global
    let npm_map: &[(&str, &str)] = &[
        ("npm", "npm"),
        ("pnpm", "pnpm"),
        ("yarn", "yarn"),
        ("tauri", "@tauri-apps/cli"),
    ];
    if let Some((_, pkg)) = npm_map.iter().find(|(k, _)| *k == key.as_str()) {
        return stream_install(
            app,
            key.clone(),
            "npm".into(),
            vec!["install".into(), "-g".into(), format!("{}@latest", pkg)],
        )
        .await;
    }
    // Itens nativos → abre browser com página oficial
    let browser_urls: &[(&str, &str)] = &[
        ("node", "https://nodejs.org/"),
        ("git", "https://git-scm.com/downloads"),
        ("python", "https://www.python.org/downloads/"),
        ("rust", "https://rustup.rs/"),
        ("bun", "https://bun.sh"),
        ("docker", "https://www.docker.com/products/docker-desktop/"),
        (
            "windows-terminal",
            "ms-windows-store://pdp/?productid=9N0DX20HK701",
        ),
        ("git-lfs", "https://git-lfs.com/"),
        (
            "powershell",
            "https://github.com/PowerShell/PowerShell/releases/latest",
        ),
        ("vscode", "https://code.visualstudio.com/Download"),
    ];
    if let Some((_, url)) = browser_urls.iter().find(|(k, _)| *k == key.as_str()) {
        open::that(*url).map_err(|e| e.to_string())?;
        return Ok(format!("Abrindo página de atualização ({})", url));
    }
    // Não ecoa `key` (input do frontend) para evitar reflexão de string não sanitizada
    let _ = key;
    Err("Pré-requisito desconhecido".into())
}

// ============================================================
// LAUNCH
// ============================================================

#[tauri::command]
fn launch_cli(
    cli_key: String,
    directory: String,
    args: String,
    no_perms: bool,
    env_vars: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let clis = get_cli_definitions();
    let cli = clis
        .iter()
        .find(|c| c.key == cli_key)
        .ok_or_else(|| format!("CLI não encontrado: {}", cli_key))?;

    let safe_args = sanitize_args(&args)?;
    let work_dir = validate_directory(&directory)?;

    // Resolve caminho absoluto do CLI (evita PATH stale da sessão)
    let resolved_cmd =
        resolve_cli_path_win(&cli.command).unwrap_or_else(|| cli.command.clone());

    // Versão PS: `& 'path'` se tem espaço, senão path puro
    let ps_cmd = if resolved_cmd.contains(' ') {
        format!("& '{}'", resolved_cmd.replace('\'', "''"))
    } else {
        resolved_cmd.clone()
    };
    // Versão cmd.exe: sempre entre aspas duplas se tem espaço
    let cmd_cmd = if resolved_cmd.contains(' ') {
        format!("\"{}\"", resolved_cmd)
    } else {
        resolved_cmd.clone()
    };

    let tail_args = {
        let mut s = String::new();
        if !safe_args.is_empty() {
            s.push(' ');
            s.push_str(&safe_args);
        }
        if no_perms {
            if let Some(ref flag) = cli.flag {
                s.push(' ');
                s.push_str(flag);
            }
        }
        s
    };

    let ps_line = format!("{}{}", ps_cmd, tail_args);
    let cmd_line = format!("{}{}", cmd_cmd, tail_args);

    // Script PS multi-linha (usar `\n` em vez de `;` para evitar
    // interpretação pelo Windows Terminal como separador de tab).
    // Depois codificamos em UTF-16 LE + base64 e passamos via
    // `-EncodedCommand`, que aceita QUALQUER conteúdo sem escaping.
    let mut ps_script =
        String::from("$env:Path = \"$env:APPDATA\\npm;$env:LOCALAPPDATA\\npm;\" + $env:Path\n");

    // Defense-in-depth: quando o app injeta envs (provider alternativo via Admin),
    // limpar envs ANTHROPIC_*/CLAUDE_CODE_*/API_TIMEOUT_MS herdadas do shell pai
    // para evitar conflito com o que vamos injetar. A spec oficial da MiniMax e Z.AI
    // exige explicitamente: "Clear ANTHROPIC_* before configuring" (platform.minimax.io).
    if env_vars.is_some() {
        ps_script.push_str(
            "Remove-Item Env:ANTHROPIC_* -ErrorAction SilentlyContinue\n\
             Remove-Item Env:CLAUDE_CODE_* -ErrorAction SilentlyContinue\n\
             Remove-Item Env:API_TIMEOUT_MS -ErrorAction SilentlyContinue\n",
        );
    }

    if let Some(ref vars) = env_vars {
        for (k, v) in vars {
            let esc = v.replace('\'', "''");
            ps_script.push_str(&format!("$env:{} = '{}'\n", k, esc));
        }
    }
    ps_script.push_str(&ps_line);
    ps_script.push('\n');

    let encoded = encode_powershell_command(&ps_script);

    let mut launched = false;

    if let Some(wt) = find_windows_terminal() {
        if std::process::Command::new(&wt)
            .args([
                "new-tab",
                "-d",
                &work_dir,
                "pwsh",
                "-NoExit",
                "-EncodedCommand",
                &encoded,
            ])
            .spawn()
            .is_ok()
        {
            launched = true;
        }
    }
    if !launched
        && std::process::Command::new("pwsh")
            .args(["-NoExit", "-EncodedCommand", &encoded])
            .current_dir(&work_dir)
            .spawn()
            .is_ok()
    {
        launched = true;
    }
    if !launched
        && std::process::Command::new("powershell")
            .args(["-NoExit", "-EncodedCommand", &encoded])
            .current_dir(&work_dir)
            .spawn()
            .is_ok()
    {
        launched = true;
    }
    if !launched {
        // Último recurso: cmd puro
        std::process::Command::new("cmd")
            .args(["/K", &cmd_line])
            .current_dir(&work_dir)
            .spawn()
            .map_err(|e| format!("Erro ao iniciar: {}", e))?;
    }

    Ok(format!("Iniciando: {} em {}", cmd_line, work_dir))
}

// v7.1: Launch a user-defined custom CLI. Mirrors launch_cli's terminal chain
// (Windows Terminal → pwsh → powershell → cmd) for consistency, but takes the
// command + args directly instead of looking up a built-in CLI definition.
#[tauri::command]
fn launch_custom_cli(
    command: String,
    args: Option<String>,
    directory: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<String, String> {
    if command.trim().is_empty() {
        return Err("command vazio".to_string());
    }
    let safe_args = sanitize_args(args.as_deref().unwrap_or(""))?;
    let work_dir = validate_directory(directory.as_deref().unwrap_or(""))?;

    // Resolve absolute path when possible (handles npm global shims on Windows).
    let resolved_cmd = resolve_cli_path_win(&command).unwrap_or_else(|| command.clone());
    let ps_cmd = if resolved_cmd.contains(' ') {
        format!("& '{}'", resolved_cmd.replace('\'', "''"))
    } else {
        resolved_cmd.clone()
    };
    let cmd_cmd = if resolved_cmd.contains(' ') {
        format!("\"{}\"", resolved_cmd)
    } else {
        resolved_cmd.clone()
    };

    let tail_args = if safe_args.is_empty() {
        String::new()
    } else {
        format!(" {}", safe_args)
    };
    let ps_line = format!("{}{}", ps_cmd, tail_args);
    let cmd_line = format!("{}{}", cmd_cmd, tail_args);

    let mut ps_script =
        String::from("$env:Path = \"$env:APPDATA\\npm;$env:LOCALAPPDATA\\npm;\" + $env:Path\n");
    if let Some(ref vars) = env {
        for (k, v) in vars {
            let esc = v.replace('\'', "''");
            ps_script.push_str(&format!("$env:{} = '{}'\n", k, esc));
        }
    }
    ps_script.push_str(&ps_line);
    ps_script.push('\n');

    let encoded = encode_powershell_command(&ps_script);
    let mut launched = false;

    if let Some(wt) = find_windows_terminal() {
        if std::process::Command::new(&wt)
            .args([
                "new-tab",
                "-d",
                &work_dir,
                "pwsh",
                "-NoExit",
                "-EncodedCommand",
                &encoded,
            ])
            .spawn()
            .is_ok()
        {
            launched = true;
        }
    }
    if !launched
        && std::process::Command::new("pwsh")
            .args(["-NoExit", "-EncodedCommand", &encoded])
            .current_dir(&work_dir)
            .spawn()
            .is_ok()
    {
        launched = true;
    }
    if !launched
        && std::process::Command::new("powershell")
            .args(["-NoExit", "-EncodedCommand", &encoded])
            .current_dir(&work_dir)
            .spawn()
            .is_ok()
    {
        launched = true;
    }
    if !launched {
        std::process::Command::new("cmd")
            .args(["/K", &cmd_line])
            .current_dir(&work_dir)
            .spawn()
            .map_err(|e| format!("Erro ao iniciar: {}", e))?;
    }

    Ok(format!("Iniciando: {} em {}", cmd_line, work_dir))
}

// v7.1: Launch a user-defined custom IDE. The stored launch_cmd uses a literal
// "<dir>" placeholder that gets replaced with the chosen directory. Mirrors
// launch_cli's terminal-chain fallback so users see the exact same spawn
// behavior as built-in CLIs.
#[tauri::command]
fn launch_custom_ide(
    launch_cmd: String,
    directory: Option<String>,
) -> Result<String, String> {
    if launch_cmd.trim().is_empty() {
        return Err("launch_cmd vazio".to_string());
    }
    let work_dir = validate_directory(directory.as_deref().unwrap_or(""))?;
    let resolved = launch_cmd.replace("<dir>", &work_dir);

    // Encode as PowerShell so we get the same terminal chain + PATH bootstrap.
    let mut ps_script =
        String::from("$env:Path = \"$env:APPDATA\\npm;$env:LOCALAPPDATA\\npm;\" + $env:Path\n");
    ps_script.push_str(&resolved);
    ps_script.push('\n');
    let encoded = encode_powershell_command(&ps_script);

    let mut launched = false;
    if let Some(wt) = find_windows_terminal() {
        if std::process::Command::new(&wt)
            .args([
                "new-tab",
                "-d",
                &work_dir,
                "pwsh",
                "-NoExit",
                "-EncodedCommand",
                &encoded,
            ])
            .spawn()
            .is_ok()
        {
            launched = true;
        }
    }
    if !launched
        && std::process::Command::new("pwsh")
            .args(["-NoExit", "-EncodedCommand", &encoded])
            .current_dir(&work_dir)
            .spawn()
            .is_ok()
    {
        launched = true;
    }
    if !launched
        && std::process::Command::new("powershell")
            .args(["-NoExit", "-EncodedCommand", &encoded])
            .current_dir(&work_dir)
            .spawn()
            .is_ok()
    {
        launched = true;
    }
    if !launched {
        std::process::Command::new("cmd")
            .args(["/K", &resolved])
            .current_dir(&work_dir)
            .spawn()
            .map_err(|e| format!("Erro ao iniciar: {}", e))?;
    }

    Ok(format!("Iniciando: {} em {}", resolved, work_dir))
}

#[tauri::command]
fn launch_multi_clis(
    cli_keys: Vec<String>,
    directory: String,
    args: String,
    no_perms: bool,
    env_vars: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let mut launched = vec![];
    for cli_key in cli_keys {
        if let Ok(msg) = launch_cli(
            cli_key,
            directory.clone(),
            args.clone(),
            no_perms,
            env_vars.clone(),
        ) {
            launched.push(msg);
        }
    }
    Ok(format!("Iniciados {} CLIs", launched.len()))
}

#[tauri::command]
fn launch_tool(tool_key: String) -> Result<String, String> {
    let tools = get_tool_definitions();
    let tool = tools
        .iter()
        .find(|t| t.key == tool_key)
        .ok_or_else(|| format!("Ferramenta não encontrada: {}", tool_key))?;

    let work_dir = user_home_dir_string();

    if let Some(path) = find_tool_path(&tool.key) {
        if std::process::Command::new(&path)
            .current_dir(&work_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .is_ok()
        {
            return Ok(format!("Iniciando: {}", tool.name));
        }
    }
    let cmd_resolved = resolve_windows_cmd(&tool.command);
    if std::process::Command::new(&cmd_resolved)
        .arg(".")
        .current_dir(&work_dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .is_ok()
    {
        return Ok(format!("Iniciando: {}", tool.name));
    }
    Err(format!(
        "{} não encontrado. Instale: {}",
        tool.name, tool.install_hint
    ))
}

#[tauri::command]
fn install_tool(tool_key: String) -> Result<String, String> {
    let tools = get_tool_definitions();
    let tool = tools
        .iter()
        .find(|t| t.key == tool_key)
        .ok_or_else(|| format!("Ferramenta não encontrada: {}", tool_key))?;

    if let Some(ref url) = tool.install_url {
        open::that(url).map_err(|e| e.to_string())?;
        Ok(format!("Abrindo {}", url))
    } else {
        Err("URL de instalação ausente".into())
    }
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<String, String> {
    if !std::path::Path::new(&path).exists() {
        return Err("Diretório não encontrado".into());
    }
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map(|_| "Aberto".into())
        .map_err(|e| format!("Erro: {}", e))
}

#[tauri::command]
fn open_external_url(url: String) -> Result<String, String> {
    // Apenas https:// é permitido pra evitar command injection via file:// ou
    // protocolos custom. Validação barata mas suficiente pra uso interno.
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("URL deve começar com http(s)://".into());
    }
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn()
        .map(|_| "Aberto".into())
        .map_err(|e| format!("Erro: {}", e))
}

#[tauri::command]
fn reset_all_config() -> Result<String, String> {
    // Remove install.log (localStorage é limpo pelo frontend)
    if let Some(dir) = dirs::config_dir() {
        let log_path = dir.join("ai-launcher").join("install.log");
        if log_path.exists() {
            let _ = std::fs::remove_file(&log_path);
        }
    }
    Ok("Configurações resetadas".into())
}

// ============================================================
// TESTES
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

// ============================================================
// COST AGGREGATOR — v4.0 (F4)
// Lê arquivos de usage locais de Claude Code, Codex, Gemini
// e retorna schema uniforme. Nunca envia nada externamente.
// ============================================================

#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageEntry {
    pub cli: String,           // "claude" | "codex" | "gemini"
    pub date: String,          // ISO yyyy-mm-dd
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub cost_estimate_usd: f64,
    pub model: Option<String>,
    pub project: Option<String>, // cwd quando disponível
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageReport {
    pub entries: Vec<UsageEntry>,
    pub total_tokens_in: u64,
    pub total_tokens_out: u64,
    pub total_cost_usd: f64,
    pub by_cli: std::collections::BTreeMap<String, CliUsageSummary>,
    pub top_projects: Vec<ProjectUsage>,
    pub warnings: Vec<String>, // ex: "arquivo não encontrado", "formato desconhecido"
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CliUsageSummary {
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub cost_usd: f64,
    pub entries: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProjectUsage {
    pub project: String,
    pub cost_usd: f64,
    pub tokens: u64,
}

// Tabela simples de preços (USD por 1M tokens). Atualizável manual.
// Valores aproximados a 2026-04 — apenas estimativa, não billing oficial.
fn price_per_mtoken(cli: &str, model: Option<&str>) -> (f64, f64) {
    // retorna (in_price_per_mtoken, out_price_per_mtoken)
    match (cli, model.unwrap_or("")) {
        ("claude", m) if m.contains("opus") => (15.0, 75.0),
        ("claude", m) if m.contains("sonnet") => (3.0, 15.0),
        ("claude", m) if m.contains("haiku") => (0.80, 4.0),
        ("claude", _) => (3.0, 15.0), // default sonnet-class
        ("codex", _) => (2.5, 10.0),  // gpt-4o-class
        ("gemini", m) if m.contains("pro") => (1.25, 5.0),
        ("gemini", _) => (0.075, 0.30), // flash
        _ => (1.0, 4.0), // fallback
    }
}

fn read_claude_usage(entries: &mut Vec<UsageEntry>, warnings: &mut Vec<String>) {
    // Claude Code: ~/.claude/usage.jsonl — append-only, 1 linha por request
    // Formato esperado (best-effort; formato oficial pode variar):
    // { "timestamp": "2026-04-17T10:00:00Z", "model": "claude-sonnet-4-5",
    //   "input_tokens": 1234, "output_tokens": 567, "cwd": "C:\\projeto" }
    let path = match dirs::home_dir() {
        Some(h) => h.join(".claude").join("usage.jsonl"),
        None => {
            warnings.push("HOME dir desconhecido".to_string());
            return;
        }
    };
    if !path.exists() {
        // arquivo pode não existir (usuário nunca usou) — não é erro
        return;
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            warnings.push(format!("claude usage.jsonl: {}", e));
            return;
        }
    };
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let tokens_in = v
            .get("input_tokens")
            .and_then(|x| x.as_u64())
            .unwrap_or(0);
        let tokens_out = v
            .get("output_tokens")
            .and_then(|x| x.as_u64())
            .unwrap_or(0);
        if tokens_in == 0 && tokens_out == 0 {
            continue;
        }
        let model = v.get("model").and_then(|x| x.as_str()).map(String::from);
        let ts = v.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");
        let date = ts.get(..10).unwrap_or("").to_string();
        let cwd = v.get("cwd").and_then(|x| x.as_str()).map(String::from);
        let (pin, pout) = price_per_mtoken("claude", model.as_deref());
        let cost =
            (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;
        entries.push(UsageEntry {
            cli: "claude".to_string(),
            date,
            tokens_in,
            tokens_out,
            cost_estimate_usd: cost,
            model,
            project: cwd,
        });
    }
}

fn read_codex_usage(entries: &mut Vec<UsageEntry>, warnings: &mut Vec<String>) {
    // Codex (OpenAI): ~/.codex/usage.jsonl (formato análogo ao do Claude mas chaves variam)
    let path = match dirs::home_dir() {
        Some(h) => h.join(".codex").join("usage.jsonl"),
        None => return,
    };
    if !path.exists() {
        return;
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            warnings.push(format!("codex usage.jsonl: {}", e));
            return;
        }
    };
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let tokens_in = v
            .get("prompt_tokens")
            .or_else(|| v.get("input_tokens"))
            .and_then(|x| x.as_u64())
            .unwrap_or(0);
        let tokens_out = v
            .get("completion_tokens")
            .or_else(|| v.get("output_tokens"))
            .and_then(|x| x.as_u64())
            .unwrap_or(0);
        if tokens_in == 0 && tokens_out == 0 {
            continue;
        }
        let model = v.get("model").and_then(|x| x.as_str()).map(String::from);
        let ts = v
            .get("timestamp")
            .or_else(|| v.get("date"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let date = ts.get(..10).unwrap_or("").to_string();
        let cwd = v.get("cwd").and_then(|x| x.as_str()).map(String::from);
        let (pin, pout) = price_per_mtoken("codex", model.as_deref());
        let cost =
            (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;
        entries.push(UsageEntry {
            cli: "codex".to_string(),
            date,
            tokens_in,
            tokens_out,
            cost_estimate_usd: cost,
            model,
            project: cwd,
        });
    }
}

fn read_gemini_usage(entries: &mut Vec<UsageEntry>, warnings: &mut Vec<String>) {
    // Gemini CLI: ~/.gemini/telemetry (diretório com arquivos diários) — best effort
    let base = match dirs::home_dir() {
        Some(h) => h.join(".gemini").join("telemetry"),
        None => return,
    };
    if !base.exists() {
        return;
    }
    let read_dir = match std::fs::read_dir(&base) {
        Ok(rd) => rd,
        Err(e) => {
            warnings.push(format!("gemini telemetry: {}", e));
            return;
        }
    };
    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let v: serde_json::Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let tokens_in = v
                .get("input_tokens")
                .or_else(|| v.get("prompt_token_count"))
                .and_then(|x| x.as_u64())
                .unwrap_or(0);
            let tokens_out = v
                .get("output_tokens")
                .or_else(|| v.get("candidates_token_count"))
                .and_then(|x| x.as_u64())
                .unwrap_or(0);
            if tokens_in == 0 && tokens_out == 0 {
                continue;
            }
            let model = v.get("model").and_then(|x| x.as_str()).map(String::from);
            let ts = v.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");
            let date = ts.get(..10).unwrap_or("").to_string();
            let cwd = v.get("cwd").and_then(|x| x.as_str()).map(String::from);
            let (pin, pout) = price_per_mtoken("gemini", model.as_deref());
            let cost =
                (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;
            entries.push(UsageEntry {
                cli: "gemini".to_string(),
                date,
                tokens_in,
                tokens_out,
                cost_estimate_usd: cost,
                model,
                project: cwd,
            });
        }
    }
}

#[tauri::command]
fn read_usage_stats() -> Result<UsageReport, String> {
    let mut entries: Vec<UsageEntry> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    read_claude_usage(&mut entries, &mut warnings);
    read_codex_usage(&mut entries, &mut warnings);
    read_gemini_usage(&mut entries, &mut warnings);

    let mut total_in: u64 = 0;
    let mut total_out: u64 = 0;
    let mut total_cost: f64 = 0.0;
    let mut by_cli: std::collections::BTreeMap<String, CliUsageSummary> =
        std::collections::BTreeMap::new();
    let mut project_agg: std::collections::HashMap<String, (f64, u64)> =
        std::collections::HashMap::new();

    for e in &entries {
        total_in += e.tokens_in;
        total_out += e.tokens_out;
        total_cost += e.cost_estimate_usd;
        let s = by_cli.entry(e.cli.clone()).or_insert(CliUsageSummary {
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0.0,
            entries: 0,
        });
        s.tokens_in += e.tokens_in;
        s.tokens_out += e.tokens_out;
        s.cost_usd += e.cost_estimate_usd;
        s.entries += 1;
        if let Some(p) = &e.project {
            if !p.is_empty() {
                let v = project_agg.entry(p.clone()).or_insert((0.0, 0));
                v.0 += e.cost_estimate_usd;
                v.1 += e.tokens_in + e.tokens_out;
            }
        }
    }
    let mut top_projects: Vec<ProjectUsage> = project_agg
        .into_iter()
        .map(|(project, (cost, tokens))| ProjectUsage {
            project,
            cost_usd: cost,
            tokens,
        })
        .collect();
    top_projects.sort_by(|a, b| {
        b.cost_usd
            .partial_cmp(&a.cost_usd)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    top_projects.truncate(5);

    Ok(UsageReport {
        entries,
        total_tokens_in: total_in,
        total_tokens_out: total_out,
        total_cost_usd: total_cost,
        by_cli,
        top_projects,
        warnings,
    })
}

// ============================================================
// TRAY + HOTKEY (System Tray + Global Shortcut)
// ============================================================

const DEFAULT_TRAY_HOTKEY: &str = "CommandOrControl+Alt+Space";

// Arquivo local de config para tray/hotkey — %APPDATA%\ai-launcher\tray.json
fn tray_config_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("ai-launcher");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("tray.json")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TrayConfig {
    hotkey: String,
    minimize_to_tray: bool,
}

impl Default for TrayConfig {
    fn default() -> Self {
        Self {
            hotkey: DEFAULT_TRAY_HOTKEY.to_string(),
            minimize_to_tray: false,
        }
    }
}

fn read_tray_config() -> TrayConfig {
    let path = tray_config_path();
    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => TrayConfig::default(),
    }
}

fn write_tray_config(cfg: &TrayConfig) -> Result<(), String> {
    let path = tray_config_path();
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

fn toggle_main_window(app: &AppHandle) {
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

fn show_and_focus(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn get_tray_hotkey() -> Result<String, String> {
    Ok(read_tray_config().hotkey)
}

#[tauri::command]
fn set_tray_hotkey(app: AppHandle, hotkey: String) -> Result<(), String> {
    let trimmed = hotkey.trim().to_string();
    if trimmed.is_empty() {
        return Err("hotkey vazio".to_string());
    }
    // Valida parse antes de persistir
    let _parsed: Shortcut = trimmed
        .parse()
        .map_err(|e| format!("hotkey inválido: {e}"))?;

    // Atualiza arquivo
    let mut cfg = read_tray_config();
    let old = cfg.hotkey.clone();
    cfg.hotkey = trimmed.clone();
    write_tray_config(&cfg)?;

    // Re-registra no plugin global shortcut
    let gs = app.global_shortcut();
    // Unregister antigo (ignora erro: pode não estar registrado)
    if let Ok(old_shortcut) = old.parse::<Shortcut>() {
        let _ = gs.unregister(old_shortcut);
    }
    let new_shortcut: Shortcut = trimmed
        .parse()
        .map_err(|e| format!("hotkey inválido: {e}"))?;
    gs.register(new_shortcut)
        .map_err(|e| format!("falha ao registrar hotkey: {e}"))?;
    Ok(())
}

#[tauri::command]
fn get_minimize_to_tray() -> Result<bool, String> {
    Ok(read_tray_config().minimize_to_tray)
}

#[tauri::command]
fn set_minimize_to_tray(enabled: bool) -> Result<(), String> {
    let mut cfg = read_tray_config();
    cfg.minimize_to_tray = enabled;
    write_tray_config(&cfg)
}

fn build_tray_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let show = MenuItem::with_id(app, "tray-show", "Abrir AI Launcher", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    // Submenu: Lançar CLI
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

    // Submenu: Abrir aba
    let tab_launcher = MenuItem::with_id(
        app,
        "tray-tab-launcher",
        "Launcher",
        true,
        None::<&str>,
    )?;
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

    // Submenu: Provider Claude (quick-switch)
    // Lista estática dos 3 built-ins. Perfis custom ficam só no Admin (UI).
    let prov_anthropic = MenuItem::with_id(
        app, "tray-provider-anthropic", "Anthropic (oficial)", true, None::<&str>,
    )?;
    let prov_zai = MenuItem::with_id(
        app, "tray-provider-zai", "Z.AI (GLM)", true, None::<&str>,
    )?;
    let prov_minimax = MenuItem::with_id(
        app, "tray-provider-minimax", "MiniMax", true, None::<&str>,
    )?;
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
            // Frontend usa 'help' internamente para aba de config/ajuda.
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
            // Não abre foco — troca silenciosa no tray.
            let _ = app.emit("tray-set-provider", provider_id);
        }
        _ => {}
    }
}

// ============================================================
// --- Crash reporter (C3) ---
// ============================================================

fn crash_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ai-launcher")
        .join("crash")
}

#[tauri::command]
fn save_crash_log(stack: String, context: String) -> Result<String, String> {
    let dir = crash_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("falha ao criar diretório de crash: {e}"))?;
    let ts = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let safe_ctx: String = context
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let file = dir.join(format!("{}-{}.log", safe_ctx, ts));
    let payload = format!(
        "context={}\ntimestamp={}\n\n{}\n",
        context, ts, stack
    );
    std::fs::write(&file, payload).map_err(|e| format!("falha ao escrever log: {e}"))?;
    Ok(file.to_string_lossy().to_string())
}

#[tauri::command]
fn read_crash_log(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let canonical = p
        .canonicalize()
        .map_err(|e| format!("caminho inválido: {e}"))?;
    let base = crash_dir();
    let base_canonical = base
        .canonicalize()
        .map_err(|e| format!("diretório de crash inválido: {e}"))?;
    if !canonical.starts_with(&base_canonical) {
        return Err("caminho fora do diretório de crashes".to_string());
    }
    std::fs::read_to_string(&canonical).map_err(|e| format!("falha ao ler log: {e}"))
}

#[tauri::command]
fn open_crash_dir() -> Result<(), String> {
    let dir = crash_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("falha ao criar diretório: {e}"))?;
    Command::new("explorer")
        .arg(&dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("falha ao abrir explorer: {e}"))?;
    Ok(())
}

// ============================================================
// PROVIDER CONNECTION TEST (Rust — sem CORS)
// ============================================================

#[derive(Serialize)]
struct ProviderTestResult {
    ok: bool,
    #[serde(rename = "statusCode")]
    status_code: Option<u16>,
    #[serde(rename = "latencyMs")]
    latency_ms: u64,
    #[serde(rename = "modelEcho")]
    model_echo: Option<String>,
    message: String,
}

/// Testa conexão com endpoint Anthropic-compatible direto do backend Rust
/// para evitar bloqueio CORS do webview Tauri (que gerava "Failed to fetch"
/// mesmo com credenciais corretas).
#[tauri::command]
fn test_provider_connection(
    base_url: String,
    api_key: String,
    model: String,
) -> Result<ProviderTestResult, String> {
    if base_url.trim().is_empty() {
        return Ok(ProviderTestResult {
            ok: false,
            status_code: None,
            latency_ms: 0,
            model_echo: None,
            message: "Sem baseUrl — perfil oficial depende da config local do Claude Code."
                .to_string(),
        });
    }
    if api_key.trim().is_empty() {
        return Ok(ProviderTestResult {
            ok: false,
            status_code: None,
            latency_ms: 0,
            model_echo: None,
            message: "Sem apiKey — preencha antes de testar.".to_string(),
        });
    }
    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 1,
        "messages": [{ "role": "user", "content": "ping" }],
    });

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent(concat!("ai-launcher-pro/", env!("CARGO_PKG_VERSION")))
        .build();

    let t0 = std::time::Instant::now();
    let resp = agent
        .post(&url)
        .set("Content-Type", "application/json")
        .set("x-api-key", &api_key)
        .set("Authorization", &format!("Bearer {}", api_key))
        .set("anthropic-version", "2023-06-01")
        .send_json(body);
    let latency_ms = t0.elapsed().as_millis() as u64;

    match resp {
        Ok(r) => {
            let status = r.status();
            let text = r.into_string().unwrap_or_default();
            let model_echo = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|j| j.get("model").and_then(|m| m.as_str().map(String::from)));
            Ok(ProviderTestResult {
                ok: true,
                status_code: Some(status),
                latency_ms,
                message: format!(
                    "Conectou em {}ms{}",
                    latency_ms,
                    model_echo
                        .as_ref()
                        .map(|m| format!(" · modelo {}", m))
                        .unwrap_or_default()
                ),
                model_echo,
            })
        }
        Err(ureq::Error::Status(code, resp)) => {
            let text = resp.into_string().unwrap_or_default();
            let hint = match code {
                401 | 403 => "Chave inválida ou sem acesso.",
                404 => "Endpoint não encontrado — verifique a baseUrl.",
                429 => "Rate-limited, mas o endpoint responde.",
                _ => "Erro do provider.",
            };
            let snippet = if text.is_empty() {
                String::new()
            } else {
                format!(" · {}", text.chars().take(160).collect::<String>())
            };
            Ok(ProviderTestResult {
                ok: false,
                status_code: Some(code),
                latency_ms,
                model_echo: None,
                message: format!("HTTP {} — {}{}", code, hint, snippet),
            })
        }
        Err(ureq::Error::Transport(t)) => Ok(ProviderTestResult {
            ok: false,
            status_code: None,
            latency_ms,
            model_echo: None,
            message: format!(
                "Falha de rede: {}. Verifique conexão, firewall ou baseUrl.",
                t
            ),
        }),
    }
}

// ============================================================
// RESET CLAUDE CODE STATE
// ============================================================

/// Limpa estado local do Claude Code que pode causar conflitos ao trocar
/// de provider: customApiKeyResponses (prompt já aceito p/ chave antiga),
/// oauthAccount (conta logada) e model (modelo custom fixado).
///
/// Mantém o resto do ~/.claude.json (MCP servers, theme, etc).
#[tauri::command]
fn reset_claude_state() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("HOME não encontrado")?;
    let path = home.join(".claude.json");
    if !path.exists() {
        return Ok("Nada a limpar — ~/.claude.json não existe.".to_string());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Falha ao ler {}: {}", path.display(), e))?;
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("JSON inválido em {}: {}", path.display(), e))?;

    let mut removed = Vec::new();
    if let Some(obj) = json.as_object_mut() {
        for key in ["customApiKeyResponses", "oauthAccount", "model"] {
            if obj.remove(key).is_some() {
                removed.push(key.to_string());
            }
        }
    }

    // Backup antes de sobrescrever
    let backup = path.with_extension("json.bak");
    let _ = std::fs::copy(&path, &backup);

    let serialized = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Falha ao serializar: {}", e))?;
    std::fs::write(&path, serialized)
        .map_err(|e| format!("Falha ao escrever {}: {}", path.display(), e))?;

    if removed.is_empty() {
        Ok("Nada a limpar — nenhum campo conflitante encontrado.".to_string())
    } else {
        Ok(format!(
            "Limpou: {}. Backup em {}.",
            removed.join(", "),
            backup.display()
        ))
    }
}

// ============================================================
// MAIN
// ============================================================

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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        // Qualquer shortcut registrado toggla a janela (só registramos um)
                        let _ = shortcut;
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            check_environment,
            check_clis,
            check_cli_updates,
            check_env_updates,
            check_tool_updates,
            check_all_updates,
            check_tools,
            install_cli,
            update_cli,
            update_all_clis,
            launch_cli,
            launch_custom_cli,
            launch_custom_ide,
            launch_multi_clis,
            launch_tool,
            install_tool,
            open_in_explorer,
            open_external_url,
            get_all_clis,
            get_all_tools,
            install_prerequisite,
            update_prerequisite,
            reset_all_config,
            read_usage_stats,
            get_tray_hotkey,
            set_tray_hotkey,
            get_minimize_to_tray,
            set_minimize_to_tray,
            save_crash_log,
            read_crash_log,
            open_crash_dir,
            test_provider_connection,
            reset_claude_state,
            check_latest_release,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window
                .set_title("AI Launcher Pro - by Helbert Moura | Powered by DevManiac's")
                .unwrap();

            // --- System Tray ---
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

            // --- Hotkey global ---
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
