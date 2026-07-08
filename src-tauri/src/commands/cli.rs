use std::collections::HashMap;

use serde::Serialize;

use crate::util::{
    append_env_assignments, check_cli_installed, compare_versions, encode_powershell_command,
    fetch_manifest_version, find_windows_terminal, get_cli_definitions, get_installed_version,
    log_event, npm_latest, resolve_cli_path_win, sanitize_args, stream_install, validate_directory,
    CheckResult, CliInfo, DEFAULT_INSTALL_TIMEOUT_SEC,
};

/// Result returned by all launch commands.
#[derive(Debug, Serialize)]
pub struct LaunchResult {
    /// Unique session identifier (UUID v4).
    pub session_id: String,
    /// Human-readable message (e.g. "Iniciando: claude em C:\\projects").
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ProjectStackSnapshot {
    pub files: Vec<String>,
    pub manifests: HashMap<String, String>,
}

#[tauri::command]
pub fn get_all_clis() -> Vec<CliInfo> {
    get_cli_definitions()
}

/// Collect safe project shape signals for frontend stack detection.
///
/// This intentionally reads only a tiny allowlist of filenames that describe a
/// project stack. It does not recurse, does not read environment/secret files,
/// and caps manifest reads so a bad checkout cannot freeze the UI.
#[tauri::command]
pub fn scan_project_stack(directory: String) -> Result<ProjectStackSnapshot, String> {
    const MAX_MANIFEST_BYTES: u64 = 256 * 1024;
    const SIGNAL_FILES: &[&str] = &[
        "package.json",
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "bun.lockb",
        "vite.config.ts",
        "vite.config.js",
        "vite.config.mts",
        "vite.config.mjs",
        "vite.config.cts",
        "vite.config.cjs",
        "src/App.tsx",
        "src/App.jsx",
        "src/main.tsx",
        "src/main.jsx",
        "Cargo.toml",
        "Cargo.lock",
        "src-tauri/tauri.conf.json",
        "src-tauri/Cargo.toml",
        "pyproject.toml",
        "requirements.txt",
        "poetry.lock",
        "uv.lock",
        "go.mod",
        "go.sum",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yaml",
        "compose.yml",
        ".mcp.json",
        ".claude/.mcp.json",
        ".ailauncher.json",
    ];
    const MANIFEST_FILES: &[&str] = &["package.json", ".ailauncher.json"];

    let work_dir = validate_directory(&directory)?;
    let root = std::path::Path::new(&work_dir);
    let mut files = Vec::new();
    let mut manifests = HashMap::new();

    for relative in SIGNAL_FILES {
        let path = root.join(relative);
        if !path.is_file() {
            continue;
        }
        files.push((*relative).to_string());
        if !MANIFEST_FILES.contains(relative) {
            continue;
        }
        let meta =
            std::fs::metadata(&path).map_err(|e| format!("Falha ao ler {}: {}", relative, e))?;
        if meta.len() > MAX_MANIFEST_BYTES {
            continue;
        }
        if let Ok(contents) = std::fs::read_to_string(&path) {
            manifests.insert((*relative).to_string(), contents);
        }
    }

    Ok(ProjectStackSnapshot { files, manifests })
}

/// Read a project's `.ailauncher.json` from a chosen directory (B4).
///
/// Returns the raw file contents when present, or `None` when the file does not
/// exist (the common case — not an error). The directory is validated with the
/// same `validate_directory` gate used by the launcher. We only join the fixed
/// filename `.ailauncher.json` (no caller-controlled path component), so there
/// is no path-traversal surface here. A size cap guards against pathological
/// files. Parsing/validation of the JSON happens in the frontend (zod).
#[tauri::command]
pub fn read_project_profile(directory: String) -> Result<Option<String>, String> {
    /// Refuse to read absurdly large files (a `.ailauncher.json` is tiny).
    const MAX_PROFILE_BYTES: u64 = 256 * 1024;

    let work_dir = validate_directory(&directory)?;
    let path = std::path::Path::new(&work_dir).join(".ailauncher.json");
    if !path.is_file() {
        return Ok(None);
    }
    let meta =
        std::fs::metadata(&path).map_err(|e| format!("Falha ao ler .ailauncher.json: {}", e))?;
    if meta.len() > MAX_PROFILE_BYTES {
        return Err(format!(
            ".ailauncher.json é grande demais ({} bytes, limite {})",
            meta.len(),
            MAX_PROFILE_BYTES
        ));
    }
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Falha ao ler .ailauncher.json: {}", e))?;
    Ok(Some(contents))
}

/// Write a project's `.ailauncher.json` into a validated directory.
///
/// The caller provides the full JSON contents, but never the target filename.
/// We validate the root directory, keep the same size cap as reads, require a
/// JSON object, and then write the fixed `.ailauncher.json` path.
#[tauri::command]
pub fn write_project_profile(directory: String, contents: String) -> Result<(), String> {
    const MAX_PROFILE_BYTES: usize = 256 * 1024;

    let work_dir = validate_directory(&directory)?;
    if contents.len() > MAX_PROFILE_BYTES {
        return Err(format!(
            ".ailauncher.json é grande demais ({} bytes, limite {})",
            contents.len(),
            MAX_PROFILE_BYTES
        ));
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&contents).map_err(|e| format!(".ailauncher.json invalido: {}", e))?;
    if !parsed.is_object() {
        return Err(".ailauncher.json precisa ser um objeto JSON".into());
    }
    let path = std::path::Path::new(&work_dir).join(".ailauncher.json");
    std::fs::write(&path, contents)
        .map_err(|e| format!("Falha ao salvar .ailauncher.json: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn check_clis() -> Vec<CheckResult> {
    get_cli_definitions()
        .iter()
        .map(|cli| {
            let (installed, version) = check_cli_installed(cli);
            CheckResult {
                key: cli.key.clone(),
                name: cli.name.clone(),
                installed,
                version,
                install_command: Some(cli.install_cmd.clone()),
            }
        })
        .collect()
}

#[tauri::command]
pub fn check_cli_updates() -> Vec<crate::util::UpdateInfo> {
    use crate::util::UpdateInfo;
    get_cli_definitions()
        .into_iter()
        .map(|cli| {
            let current = get_installed_version(&cli);
            let latest = if let Some(ref url) = cli.update_manifest_url {
                fetch_manifest_version(url)
            } else {
                cli.npm_pkg.as_ref().and_then(|p| npm_latest(p))
            };
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
pub async fn install_cli(
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
                    secs,
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
                    secs,
                )
                .await
            }
            "script" => {
                stream_install(
                    app,
                    key_for_work,
                    "pwsh".into(),
                    vec!["-Command".into(), install_cmd],
                    secs,
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
pub async fn update_cli(
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
                    secs,
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
                    secs,
                )
                .await
            }
            "script" => {
                stream_install(
                    app,
                    key_for_work,
                    "pwsh".into(),
                    vec!["-Command".into(), install_cmd],
                    secs,
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
pub async fn update_all_clis(app: tauri::AppHandle) -> Result<String, String> {
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
pub fn launch_cli(
    app: tauri::AppHandle,
    cli_key: String,
    directory: String,
    args: String,
    no_perms: bool,
    env_vars: Option<HashMap<String, String>>,
) -> Result<LaunchResult, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    let clis = get_cli_definitions();
    let cli = clis
        .iter()
        .find(|c| c.key == cli_key)
        .ok_or_else(|| format!("CLI não encontrado: {}", cli_key))?;

    let safe_args = sanitize_args(&args)?;
    let work_dir = validate_directory(&directory)?;

    let resolved_cmd =
        resolve_cli_path_win(&cli.command, &cli.extra_paths).unwrap_or_else(|| cli.command.clone());

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

    let mut ps_script =
        String::from("$env:Path = \"$env:APPDATA\\npm;$env:LOCALAPPDATA\\npm;\" + $env:Path\n");

    if env_vars.is_some() {
        ps_script.push_str(
            "Remove-Item Env:ANTHROPIC_* -ErrorAction SilentlyContinue\n\
             Remove-Item Env:CLAUDE_CODE_* -ErrorAction SilentlyContinue\n\
             Remove-Item Env:API_TIMEOUT_MS -ErrorAction SilentlyContinue\n",
        );
    }

    if let Some(ref vars) = env_vars {
        append_env_assignments(&mut ps_script, vars);
    }
    ps_script.push_str(&ps_line);
    ps_script.push('\n');

    let encoded = encode_powershell_command(&ps_script);

    spawn_and_track(&app, &session_id, &cli_key, &work_dir, &encoded, &cmd_line)?;

    Ok(LaunchResult {
        session_id,
        message: format!("Iniciando: {} em {}", cmd_line, work_dir),
    })
}

/// Spawn a session and register it for lifecycle tracking.
///
/// Preference order: Windows Terminal (`wt.exe`) → pwsh → powershell → cmd.
/// When launched through `wt.exe`, the `wt` process exits immediately after
/// opening the tab, so the real session cannot be measured — we register it as
/// "detached" (which emits `session-ended` with status="detached" right away).
/// For the direct fallbacks, we retain the child handle and track it: a tokio
/// task awaits the process and emits `session-ended` with the real exit code
/// and duration when it exits.
fn spawn_and_track(
    app: &tauri::AppHandle,
    session_id: &str,
    cli_key: &str,
    work_dir: &str,
    encoded: &str,
    cmd_line: &str,
) -> Result<(), String> {
    if let Some(wt) = find_windows_terminal() {
        if std::process::Command::new(&wt)
            .args([
                "new-tab",
                "-d",
                work_dir,
                "pwsh",
                "-NoExit",
                "-EncodedCommand",
                encoded,
            ])
            .spawn()
            .is_ok()
        {
            crate::commands::session::register_detached(app, session_id, cli_key, work_dir);
            return Ok(());
        }
    }

    // Direct fallbacks: retain the child so the session can be measured.
    for program in ["pwsh", "powershell"] {
        if let Ok(child) = tokio::process::Command::new(program)
            .args(["-NoExit", "-EncodedCommand", encoded])
            .current_dir(work_dir)
            .spawn()
        {
            crate::commands::session::track_child(
                app,
                session_id.to_string(),
                cli_key.to_string(),
                work_dir.to_string(),
                child,
            );
            return Ok(());
        }
    }

    let child = tokio::process::Command::new("cmd")
        .args(["/K", cmd_line])
        .current_dir(work_dir)
        .spawn()
        .map_err(|e| format!("Erro ao iniciar: {}", e))?;
    crate::commands::session::track_child(
        app,
        session_id.to_string(),
        cli_key.to_string(),
        work_dir.to_string(),
        child,
    );
    Ok(())
}

#[tauri::command]
pub fn launch_custom_cli(
    app: tauri::AppHandle,
    command: String,
    args: Option<String>,
    directory: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<LaunchResult, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    if command.trim().is_empty() {
        return Err("command vazio".to_string());
    }
    let safe_args = sanitize_args(args.as_deref().unwrap_or(""))?;
    let work_dir = validate_directory(directory.as_deref().unwrap_or(""))?;

    let resolved_cmd = resolve_cli_path_win(&command, &[]).unwrap_or_else(|| command.clone());
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
        append_env_assignments(&mut ps_script, vars);
    }
    ps_script.push_str(&ps_line);
    ps_script.push('\n');

    let encoded = encode_powershell_command(&ps_script);

    spawn_and_track(&app, &session_id, "custom", &work_dir, &encoded, &cmd_line)?;

    Ok(LaunchResult {
        session_id,
        message: format!("Iniciando: {} em {}", cmd_line, work_dir),
    })
}

#[tauri::command]
pub fn launch_multi_clis(
    app: tauri::AppHandle,
    cli_keys: Vec<String>,
    directory: String,
    args: String,
    no_perms: bool,
    env_vars: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let mut count = 0usize;
    for cli_key in cli_keys {
        if launch_cli(
            app.clone(),
            cli_key,
            directory.clone(),
            args.clone(),
            no_perms,
            env_vars.clone(),
        )
        .is_ok()
        {
            count += 1;
        }
    }
    Ok(format!("Iniciados {} CLIs", count))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a unique temp directory for a test, returning its path.
    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("ail-b4-{}-{}", tag, nanos));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn read_project_profile_returns_none_when_absent() {
        let dir = temp_dir("absent");
        let res = read_project_profile(dir.to_string_lossy().into_owned());
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(res, Ok(None));
    }

    #[test]
    fn read_project_profile_returns_contents_when_present() {
        let dir = temp_dir("present");
        let body = r#"{"version":1,"cli":"claude"}"#;
        std::fs::write(dir.join(".ailauncher.json"), body).expect("write profile");
        let res = read_project_profile(dir.to_string_lossy().into_owned());
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(res, Ok(Some(body.to_string())));
    }

    #[test]
    fn read_project_profile_errors_on_missing_directory() {
        let res = read_project_profile(r"C:\__ail_b4_definitely_missing_dir__".to_string());
        assert!(res.is_err());
    }

    #[test]
    fn read_project_profile_rejects_oversized_file() {
        let dir = temp_dir("oversized");
        // 256 KiB + 1 byte — just over the cap.
        let big = "x".repeat(256 * 1024 + 1);
        std::fs::write(dir.join(".ailauncher.json"), big).expect("write big profile");
        let res = read_project_profile(dir.to_string_lossy().into_owned());
        let _ = std::fs::remove_dir_all(&dir);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("grande demais"));
    }

    #[test]
    fn write_project_profile_writes_valid_json_object() {
        let dir = temp_dir("write-profile");
        let body = r#"{"version":1,"cli":"codex"}"#.to_string();

        write_project_profile(dir.to_string_lossy().into_owned(), body.clone())
            .expect("write profile");
        let saved = std::fs::read_to_string(dir.join(".ailauncher.json")).expect("read profile");
        let _ = std::fs::remove_dir_all(&dir);

        assert_eq!(saved, body);
    }

    #[test]
    fn write_project_profile_rejects_invalid_json() {
        let dir = temp_dir("write-invalid-profile");
        let res = write_project_profile(dir.to_string_lossy().into_owned(), "{".into());
        let _ = std::fs::remove_dir_all(&dir);

        assert!(res.is_err());
        assert!(res.unwrap_err().contains("invalido"));
    }

    #[test]
    fn write_project_profile_rejects_non_object_json() {
        let dir = temp_dir("write-array-profile");
        let res = write_project_profile(dir.to_string_lossy().into_owned(), "[]".into());
        let _ = std::fs::remove_dir_all(&dir);

        assert!(res.is_err());
        assert!(res.unwrap_err().contains("objeto JSON"));
    }

    #[test]
    fn scan_project_stack_collects_safe_signals() {
        let dir = temp_dir("stack");
        std::fs::create_dir_all(dir.join("src-tauri")).expect("create src-tauri");
        std::fs::write(
            dir.join("package.json"),
            r#"{"dependencies":{"react":"latest","@tauri-apps/api":"latest"}}"#,
        )
        .expect("write package");
        std::fs::write(dir.join("src-tauri").join("Cargo.toml"), "[package]").expect("write cargo");
        std::fs::write(dir.join(".env"), "SECRET=1").expect("write env");

        let res = scan_project_stack(dir.to_string_lossy().into_owned()).expect("scan stack");
        let _ = std::fs::remove_dir_all(&dir);

        assert!(res.files.contains(&"package.json".to_string()));
        assert!(res.files.contains(&"src-tauri/Cargo.toml".to_string()));
        assert!(!res.files.contains(&".env".to_string()));
        assert!(res.manifests.contains_key("package.json"));
    }

    #[test]
    fn scan_project_stack_ignores_oversized_manifests() {
        let dir = temp_dir("stack-oversized");
        let big = "x".repeat(256 * 1024 + 1);
        std::fs::write(dir.join("package.json"), big).expect("write big package");

        let res = scan_project_stack(dir.to_string_lossy().into_owned()).expect("scan stack");
        let _ = std::fs::remove_dir_all(&dir);

        assert!(res.files.contains(&"package.json".to_string()));
        assert!(!res.manifests.contains_key("package.json"));
    }
}
