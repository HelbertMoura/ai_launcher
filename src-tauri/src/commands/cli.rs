use std::collections::HashMap;

use serde::Serialize;

use crate::util::{
    check_cli_installed, compare_versions, encode_powershell_command, find_windows_terminal,
    get_cli_definitions, get_installed_version, log_event, npm_latest, resolve_cli_path_win,
    sanitize_args, stream_install, validate_directory, CheckResult, CliInfo,
    DEFAULT_INSTALL_TIMEOUT_SEC,
};

/// Result returned by all launch commands.
#[derive(Debug, Serialize)]
pub struct LaunchResult {
    /// Unique session identifier (UUID v4).
    pub session_id: String,
    /// Human-readable message (e.g. "Iniciando: claude em C:\\projects").
    pub message: String,
}

#[tauri::command]
pub fn get_all_clis() -> Vec<CliInfo> {
    get_cli_definitions()
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
                )
                .await
            }
            "pip" => {
                let pkg = pip_pkg.ok_or("Pacote pip ausente")?;
                stream_install(app, key_for_work, "pip".into(), vec!["install".into(), pkg]).await
            }
            "script" => {
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

    let resolved_cmd = resolve_cli_path_win(&cli.command).unwrap_or_else(|| cli.command.clone());

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

    Ok(LaunchResult {
        session_id,
        message: format!("Iniciando: {} em {}", cmd_line, work_dir),
    })
}

#[tauri::command]
pub fn launch_custom_cli(
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

    Ok(LaunchResult {
        session_id,
        message: format!("Iniciando: {} em {}", cmd_line, work_dir),
    })
}

#[tauri::command]
pub fn launch_multi_clis(
    cli_keys: Vec<String>,
    directory: String,
    args: String,
    no_perms: bool,
    env_vars: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let mut count = 0usize;
    for cli_key in cli_keys {
        if launch_cli(
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
