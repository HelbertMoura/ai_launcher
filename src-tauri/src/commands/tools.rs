use std::os::windows::process::CommandExt;

use crate::util::{
    command_exists, encode_powershell_command, extract_version, find_tool_path,
    find_windows_terminal, get_tool_definitions, resolve_windows_cmd, run_silent,
    user_home_dir_string, validate_directory, CheckResult, ToolInfo, CREATE_NO_WINDOW,
};

#[tauri::command]
pub fn get_all_tools() -> Vec<ToolInfo> {
    get_tool_definitions()
}

#[tauri::command]
pub fn check_tools() -> Vec<CheckResult> {
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
                key: tool.key.clone(),
                name: tool.name.clone(),
                installed,
                version,
                install_command: Some(tool.install_hint.clone()),
            }
        })
        .collect()
}

#[tauri::command]
pub fn install_tool(tool_key: String) -> Result<String, String> {
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
pub fn launch_tool(tool_key: String) -> Result<String, String> {
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
pub fn launch_custom_ide(launch_cmd: String, directory: Option<String>) -> Result<String, String> {
    if launch_cmd.trim().is_empty() {
        return Err("launch_cmd vazio".to_string());
    }
    let work_dir = validate_directory(directory.as_deref().unwrap_or(""))?;
    let resolved = launch_cmd.replace("<dir>", &work_dir);

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
