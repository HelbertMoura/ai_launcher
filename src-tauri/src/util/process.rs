use serde::Serialize;
use std::os::windows::process::CommandExt;
use std::process::Command;

pub const CREATE_NO_WINDOW: u32 = 0x08000000;
pub const RUN_SILENT_TIMEOUT_SECS: u64 = 15;
pub const DEFAULT_INSTALL_TIMEOUT_SEC: u64 = 300;

#[derive(Debug, Serialize, Clone)]
pub struct ProgressEvent {
    pub key: String,
    pub phase: String,
    pub line: String,
}

pub fn resolve_windows_cmd(cmd: &str) -> String {
    match cmd {
        "npm" | "pnpm" | "yarn" | "pip" | "tauri" | "bun" | "code" | "cursor" | "windsurf" => {
            format!("{}.cmd", cmd)
        }
        _ => cmd.to_string(),
    }
}

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

    #[cfg(windows)]
    {
        let mut path = std::env::var("PATH").unwrap_or_default();
        if let Ok(appdata) = std::env::var("APPDATA") {
            path = format!("{};{}\\npm", path, appdata);
        }
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            path = format!("{};{}\\npm", path, localappdata);
        }
        command.env("PATH", path);
    }

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

pub fn encode_powershell_command(script: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let mut bytes = Vec::with_capacity(script.len() * 2);
    for w in script.encode_utf16() {
        bytes.extend_from_slice(&w.to_le_bytes());
    }
    STANDARD.encode(&bytes)
}

pub fn user_home_dir_string() -> String {
    std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
}

pub fn validate_directory(dir: &str) -> Result<String, String> {
    if dir.is_empty() {
        return Ok(user_home_dir_string());
    }
    // SEC-004: Reject UNC paths (\\server\share and //server/share)
    if dir.starts_with(r"\\") || dir.starts_with("//") {
        return Err(format!("Caminhos de rede (UNC) não são permitidos: {}", dir));
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
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub async fn stream_install(
    app: tauri::AppHandle,
    key: String,
    program: String,
    args: Vec<String>,
    timeout_sec: u64,
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
    cmd.kill_on_drop(true);

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

    let status =
        match tokio::time::timeout(std::time::Duration::from_secs(timeout_sec), child.wait()).await
        {
            Ok(res) => res.map_err(|e| format!("Erro aguardando processo: {}", e))?,
            Err(_) => {
                let _ = child.kill().await;
                let _ = app.emit(
                    "install-progress",
                    ProgressEvent {
                        key: key.clone(),
                        phase: "error".into(),
                        line: format!("Comando excedeu o tempo limite de {}s", timeout_sec),
                    },
                );
                append_install_log(&key, false, -1);
                return Err(format!(
                    "Comando excedeu o tempo limite de {}s",
                    timeout_sec
                ));
            }
        };

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
