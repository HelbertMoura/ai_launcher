use serde::Serialize;
use std::process::Command;

#[cfg(unix)]
use std::os::unix::process::CommandExt as _;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;
pub const RUN_SILENT_TIMEOUT_SECS: u64 = 15;
pub const DEFAULT_INSTALL_TIMEOUT_SEC: u64 = 300;

#[derive(Debug, Serialize, Clone)]
pub struct ProgressEvent {
    pub key: String,
    pub phase: String,
    pub line: String,
}

/// Hides the console window of a spawned child on Windows; no-op on other
/// platforms (a GUI session has no console window to flash).
pub fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    #[cfg(not(windows))]
    let _ = cmd;
}

/// Spawns a fire-and-forget child with the platform window-hiding applied.
/// Returns `true` when the spawn succeeded.
pub fn spawn_ok(cmd: &mut Command) -> bool {
    apply_no_window(cmd);
    cmd.spawn().is_ok()
}

/// Maps npm-style commands to their Windows `.cmd` shims. Identity elsewhere:
/// on macOS/Linux the command name reaches the PATH lookup unchanged.
pub fn resolve_windows_cmd(cmd: &str) -> String {
    #[cfg(windows)]
    {
        match cmd {
            "npm" | "pnpm" | "yarn" | "pip" | "tauri" | "bun" | "code" | "cursor" | "windsurf" => {
                format!("{}.cmd", cmd)
            }
            _ => cmd.to_string(),
        }
    }
    #[cfg(not(windows))]
    {
        cmd.to_string()
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
    apply_no_window(&mut command);
    // Own process group on Unix so a timeout can kill the whole tree.
    #[cfg(unix)]
    command.process_group(0);

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
            let _ = kill_tree(pid);
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
    #[cfg(windows)]
    {
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
    #[cfg(not(windows))]
    {
        Command::new("which")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

/// Terminates a whole process tree by pid.
///
/// - Windows: `taskkill /F /T /PID` (unchanged behavior).
/// - Unix: `kill(-pgid, SIGKILL)` against the process group led by `pid`.
///   Spawn sites must put the child in its own group (`process_group(0)`) for
///   the group kill to reach the shell + CLI + descendants.
pub fn kill_tree(pid: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        let status = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("taskkill exit code {:?}", status.code()))
        }
    }
    #[cfg(not(windows))]
    {
        // SAFETY: `kill` is a plain syscall wrapper; a negative pid targets the
        // process group led by `pid`.
        let rc = unsafe { libc::kill(-(pid as libc::pid_t), libc::SIGKILL) };
        if rc == 0 {
            Ok(())
        } else {
            Err(format!(
                "kill do grupo do pid {pid} falhou: {}",
                std::io::Error::last_os_error()
            ))
        }
    }
}

/// OS-level identity of a process at a point in time: executable path plus
/// creation timestamp. Captured right after spawning an agent and persisted
/// in the race record, so `race_recover` re-reads the identity from the OS
/// before killing a pid — a pid reused by an unrelated process after a
/// reboot can never be killed by mistake.
#[derive(Debug, Serialize, Clone, PartialEq, Eq, serde::Deserialize)]
pub struct ProcessIdentity {
    pub exe: String,
    /// Windows: FILETIME (100 ns units since 1601-01-01).
    /// Unix (Linux /proc): process start time, nanoseconds since the epoch.
    pub creation_time: u64,
}

/// Reads the current identity of `pid` from the OS. Returns `None` when the
/// identity cannot be established (process gone, access denied, or a
/// platform without the needed introspection) — callers must treat `None`
/// as "not verifiable" and never kill.
#[cfg(windows)]
pub fn capture_process_identity(pid: u32) -> Option<ProcessIdentity> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    use windows_sys::Win32::Foundation::{CloseHandle, FILETIME};
    use windows_sys::Win32::System::Threading::{
        GetProcessTimes, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    // SAFETY: plain process-introspection syscalls; the handle is opened with
    // QUERY_LIMITED_INFORMATION only and always closed on every exit path.
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }

        let mut creation = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut exit = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut kernel = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut user = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        if GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user) == 0 {
            let _ = CloseHandle(handle);
            return None;
        }
        let creation_time =
            ((creation.dwHighDateTime as u64) << 32) | creation.dwLowDateTime as u64;

        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        if QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut len) == 0 {
            let _ = CloseHandle(handle);
            return None;
        }
        let _ = CloseHandle(handle);
        let exe = OsString::from_wide(&buf[..len as usize])
            .to_string_lossy()
            .into_owned();
        Some(ProcessIdentity { exe, creation_time })
    }
}

/// Non-Windows capture: Linux exposes `/proc/<pid>/exe` (readlink) and the
/// start time as the `/proc/<pid>` entry timestamp. Where `/proc` does not
/// exist (macOS), capture fails and recovery stays on the safe path — an
/// unverifiable process is never killed.
#[cfg(not(windows))]
pub fn capture_process_identity(pid: u32) -> Option<ProcessIdentity> {
    let exe = std::fs::read_link(format!("/proc/{pid}/exe")).ok()?;
    let creation_time = std::fs::metadata(format!("/proc/{pid}"))
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_nanos() as u64;
    Some(ProcessIdentity {
        exe: exe.to_string_lossy().into_owned(),
        creation_time,
    })
}

/// True only when `pid` currently runs the exact recorded process: same
/// executable AND same creation timestamp (exe paths are case-insensitive on
/// Windows). `false` — including when the identity cannot be re-read — means
/// "do not kill".
pub fn process_identity_matches(pid: u32, expected: &ProcessIdentity) -> bool {
    let Some(current) = capture_process_identity(pid) else {
        return false;
    };
    let same_exe = if cfg!(windows) {
        current.exe.eq_ignore_ascii_case(&expected.exe)
    } else {
        current.exe == expected.exe
    };
    same_exe && current.creation_time == expected.creation_time
}

#[cfg(windows)]
pub fn encode_powershell_command(script: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let mut bytes = Vec::with_capacity(script.len() * 2);
    for w in script.encode_utf16() {
        bytes.extend_from_slice(&w.to_le_bytes());
    }
    STANDARD.encode(&bytes)
}

pub fn user_home_dir_string() -> String {
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| "/".to_string())
    }
}

pub fn validate_directory(dir: &str) -> Result<String, String> {
    if dir.is_empty() {
        return Ok(user_home_dir_string());
    }
    // SEC-004: Reject UNC paths (\\server\share and //server/share)
    if dir.starts_with(r"\\") || dir.starts_with("//") {
        return Err(format!(
            "Caminhos de rede (UNC) não são permitidos: {}",
            dir
        ));
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
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    // Own process group on Unix so a timeout kill reaches the whole tree.
    #[cfg(unix)]
    cmd.process_group(0);
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
                // Terminate the whole tree (process group on Unix — the child
                // was spawned with process_group(0); taskkill semantics on
                // Windows are covered by the direct kill below matching the
                // legacy single-child behavior of stream_install).
                #[cfg(unix)]
                if let Some(pid) = child.id() {
                    let _ = kill_tree(pid);
                }
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
