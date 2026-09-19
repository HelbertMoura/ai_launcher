use crate::errors::AppError;
use crate::safety::reject_shell_metacharacters;
#[cfg(not(windows))]
use crate::util::build_unix_session_script;
use crate::util::{
    command_exists, extract_version, find_tool_path, get_tool_definitions,
    read_exe_product_version, resolve_windows_cmd, run_silent, spawn_ok, user_home_dir_string,
    validate_directory, CheckResult, ToolInfo,
};
#[cfg(windows)]
use crate::util::{encode_powershell_command, find_windows_terminal};

#[tauri::command]
pub fn get_all_tools() -> Vec<ToolInfo> {
    get_tool_definitions()
}

#[tauri::command]
pub async fn check_tools() -> Vec<CheckResult> {
    let tools = get_tool_definitions();
    let mut tasks = Vec::with_capacity(tools.len());

    for tool in tools {
        tasks.push(tokio::task::spawn_blocking(move || {
            let cmd_in_path = command_exists(&tool.command);
            let path = find_tool_path(&tool.key);
            let has_binary = path.is_some();
            let installed = cmd_in_path || has_binary;

            // PERIGO: NÃO executar o binário direto via path (`run_silent(&p_str, --version)`)
            // para apps Electron (Antigravity, Cursor, Windsurf). Eles ABREM a janela quando
            // recebem flags desconhecidas — bug-016 (Antigravity auto-launch ao abrir Tools).
            //
            // Estratégia segura:
            // 1) Se o comando está no PATH (via launcher CLI: `code`, `cursor` etc), tenta
            //    --version pelo nome do comando (esses são launchers leves, não Electron).
            // 2) Senão, vai DIRETO para ProductVersion via PE metadata (não executa nada).
            let version_from_cmd = if cmd_in_path {
                let parts: Vec<&str> = tool.version_cmd.split_whitespace().collect();
                let (_, raw) = if parts.len() > 1 {
                    run_silent(&tool.command, &parts[1..])
                } else {
                    run_silent(&tool.command, &["--version"])
                };
                raw.as_deref().and_then(extract_version)
            } else {
                None
            };

            let version = version_from_cmd
                .or_else(|| path.as_deref().and_then(read_exe_product_version))
                .or_else(|| {
                    if installed {
                        Some("detectado".into())
                    } else {
                        None
                    }
                });

            CheckResult {
                key: tool.key.clone(),
                name: tool.name.clone(),
                installed,
                version,
                install_command: Some(tool.install_hint.clone()),
            }
        }));
    }

    let mut results = Vec::with_capacity(tasks.len());
    for task in tasks {
        if let Ok(res) = task.await {
            results.push(res);
        }
    }
    results
}

#[tauri::command]
pub fn install_tool(tool_key: String) -> Result<String, AppError> {
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
pub fn launch_tool(tool_key: String, directory: Option<String>) -> Result<String, AppError> {
    let tools = get_tool_definitions();
    let tool = tools
        .iter()
        .find(|t| t.key == tool_key)
        .ok_or_else(|| format!("Ferramenta não encontrada: {}", tool_key))?;

    let work_dir = match directory.as_deref() {
        Some(dir) if !dir.trim().is_empty() => validate_directory(dir)?,
        _ => user_home_dir_string(),
    };

    if let Some(path) = find_tool_path(&tool.key) {
        let mut cmd = std::process::Command::new(&path);
        cmd.current_dir(&work_dir);
        if spawn_ok(&mut cmd) {
            return Ok(format!("Iniciando: {}", tool.name));
        }
    }
    let cmd_resolved = resolve_windows_cmd(&tool.command);
    let mut cmd = std::process::Command::new(&cmd_resolved);
    cmd.arg(".");
    cmd.current_dir(&work_dir);
    if spawn_ok(&mut cmd) {
        return Ok(format!("Iniciando: {}", tool.name));
    }
    Err(format!(
        "{} não encontrado. Instale: {}",
        tool.name, tool.install_hint
    )
    .into())
}

#[tauri::command]
pub fn launch_custom_ide(
    launch_cmd: String,
    directory: Option<String>,
) -> Result<String, AppError> {
    if launch_cmd.trim().is_empty() {
        return Err("launch_cmd vazio".into());
    }
    let work_dir = validate_directory(directory.as_deref().unwrap_or(""))?;
    let resolved = launch_cmd.replace("<dir>", &work_dir);
    // SEC: `resolved` is interpolated verbatim into a PowerShell script (or a
    // POSIX shell script on macOS/Linux) and into the cmd.exe fallback. The
    // `<dir>` placeholder (which carries `<`/`>`) is substituted above, so any
    // remaining metacharacter is user-supplied. Paths with spaces keep using
    // the current quoting path unchanged.
    reject_shell_metacharacters(&resolved, "launch_cmd")?;

    #[cfg(windows)]
    {
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
            // SEC: same cmd.exe `^`/`%VAR%` gap as the launcher fallback — escape
            // before the line reaches cmd.exe.
            let escaped = crate::safety::escape_cmd_fallback(&resolved);
            std::process::Command::new("cmd")
                .args(["/K", &escaped])
                .current_dir(&work_dir)
                .spawn()
                .map_err(|e| format!("Erro ao iniciar: {}", e))?;
        }
    }

    #[cfg(not(windows))]
    {
        let script = build_unix_session_script(&work_dir, &[], None, &resolved);
        crate::util::spawn_unix_terminal_session(&script)
            .map_err(|e| format!("Erro ao iniciar: {}", e))?;
    }

    Ok(format!("Iniciando: {} em {}", resolved, work_dir))
}
