// Session engine: tracks active CLI sessions launched by the app.
//
// When a CLI is spawned directly (no Windows Terminal), we retain the child
// handle, register the session, and spawn a tokio task that awaits the child
// and emits a `session-ended` event when it exits. When the launch goes
// through `wt.exe` (Windows Terminal), the `wt` process exits immediately after
// opening the tab, so its handle does NOT measure the real session lifetime —
// in that case we mark the session as "detached" and emit `session-ended` with
// `status = "detached"` and no exit code, rather than leaving it "starting"
// forever (which would make the timeline lie).

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// How a session was launched, which determines whether we can measure it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LaunchKind {
    /// Spawned directly (pwsh/powershell/cmd). The child handle is meaningful.
    Tracked,
    /// Spawned through `wt.exe`, which exits immediately. Not measurable.
    Detached,
}

impl LaunchKind {
    fn as_str(self) -> &'static str {
        match self {
            LaunchKind::Tracked => "tracked",
            LaunchKind::Detached => "detached",
        }
    }
}

/// An active session tracked in the global registry.
#[derive(Debug, Clone)]
pub struct SessionEntry {
    pub session_id: String,
    pub cli_key: String,
    pub directory: String,
    /// RFC3339 timestamp of when the launch happened.
    pub started_at: String,
    pub kind: LaunchKind,
    /// OS process id of the tracked child (None for detached launches).
    pub pid: Option<u32>,
}

/// Serializable view of an active session, returned to the frontend.
#[derive(Debug, Serialize)]
pub struct ActiveSession {
    pub session_id: String,
    pub cli_key: String,
    pub directory: String,
    pub started_at: String,
    pub kind: String,
    pub pid: Option<u32>,
}

impl From<&SessionEntry> for ActiveSession {
    fn from(e: &SessionEntry) -> Self {
        ActiveSession {
            session_id: e.session_id.clone(),
            cli_key: e.cli_key.clone(),
            directory: e.directory.clone(),
            started_at: e.started_at.clone(),
            kind: e.kind.as_str().to_string(),
            pid: e.pid,
        }
    }
}

/// Payload emitted when a session ends.
#[derive(Debug, Clone, Serialize)]
pub struct SessionEndedEvent {
    pub session_id: String,
    /// One of: "completed", "failed", "detached".
    pub status: String,
    /// Process exit code when known (None for detached or signal-terminated).
    pub exit_code: Option<i32>,
    /// Wall-clock duration in seconds, when measurable.
    pub duration_secs: Option<u64>,
}

pub const SESSION_ENDED_EVENT: &str = "session-ended";

type Registry = Mutex<HashMap<String, SessionEntry>>;

fn registry() -> &'static Registry {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Insert a session into the registry. Returns the number of active sessions.
pub fn register_session(entry: SessionEntry) -> usize {
    let mut map = registry().lock().unwrap_or_else(|p| p.into_inner());
    map.insert(entry.session_id.clone(), entry);
    map.len()
}

/// Remove a session from the registry, returning it if present.
pub fn remove_session(session_id: &str) -> Option<SessionEntry> {
    let mut map = registry().lock().unwrap_or_else(|p| p.into_inner());
    map.remove(session_id)
}

/// Snapshot of all currently active sessions.
pub fn list_sessions() -> Vec<ActiveSession> {
    let map = registry().lock().unwrap_or_else(|p| p.into_inner());
    map.values().map(ActiveSession::from).collect()
}

/// Look up the pid of a tracked session, if it is registered.
pub fn session_pid(session_id: &str) -> Option<u32> {
    let map = registry().lock().unwrap_or_else(|p| p.into_inner());
    map.get(session_id).and_then(|e| e.pid)
}

/// Register a detached (wt.exe) session and immediately emit `session-ended`
/// with `status = "detached"`. Detached sessions are not measurable, so they
/// must not linger as "starting".
pub fn register_detached(app: &AppHandle, session_id: &str, cli_key: &str, directory: &str) {
    let entry = SessionEntry {
        session_id: session_id.to_string(),
        cli_key: cli_key.to_string(),
        directory: directory.to_string(),
        started_at: chrono::Local::now().to_rfc3339(),
        kind: LaunchKind::Detached,
        pid: None,
    };
    register_session(entry);
    // The session is "detached": we cannot observe its end. Emit immediately so
    // the frontend can stop showing "starting" and mark it detached instead.
    remove_session(session_id);
    let _ = app.emit(
        SESSION_ENDED_EVENT,
        SessionEndedEvent {
            session_id: session_id.to_string(),
            status: "detached".to_string(),
            exit_code: None,
            duration_secs: None,
        },
    );
}

/// Register a tracked session backed by a tokio child process and spawn a task
/// that awaits the child, then emits `session-ended` and de-registers it.
pub fn track_child(
    app: &AppHandle,
    session_id: String,
    cli_key: String,
    directory: String,
    mut child: tokio::process::Child,
) {
    let pid = child.id();
    let started_instant = std::time::Instant::now();
    let entry = SessionEntry {
        session_id: session_id.clone(),
        cli_key,
        directory,
        started_at: chrono::Local::now().to_rfc3339(),
        kind: LaunchKind::Tracked,
        pid,
    };
    register_session(entry);

    let app = app.clone();
    tokio::spawn(async move {
        let status = child.wait().await;
        let duration_secs = Some(started_instant.elapsed().as_secs());
        remove_session(&session_id);
        let event = match status {
            Ok(st) => {
                let code = st.code();
                let ok = st.success();
                SessionEndedEvent {
                    session_id: session_id.clone(),
                    status: if ok { "completed" } else { "failed" }.to_string(),
                    exit_code: code,
                    duration_secs,
                }
            }
            Err(_) => SessionEndedEvent {
                session_id: session_id.clone(),
                status: "failed".to_string(),
                exit_code: None,
                duration_secs,
            },
        };
        let _ = app.emit(SESSION_ENDED_EVENT, event);
    });
}

/// List active sessions (Tauri command).
#[tauri::command]
pub fn list_active_sessions() -> Vec<ActiveSession> {
    list_sessions()
}

/// Kill a tracked session by id. Detached sessions cannot be killed (their
/// process is gone). Returns Err with a user-facing message on failure.
#[tauri::command]
pub fn kill_session(session_id: String) -> Result<(), String> {
    let Some(pid) = session_pid(&session_id) else {
        return Err("Sessão não encontrada ou não rastreável".to_string());
    };
    kill_pid(pid).map_err(|e| format!("Falha ao encerrar sessão: {}", e))
}

/// Terminate a process tree by pid on Windows via `taskkill`.
#[cfg(target_os = "windows")]
fn kill_pid(pid: u32) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let status = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("taskkill exit code {:?}", status.code()))
    }
}

#[cfg(not(target_os = "windows"))]
fn kill_pid(pid: u32) -> Result<(), String> {
    use std::process::Command;
    let status = Command::new("kill")
        .arg(pid.to_string())
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("kill exit code {:?}", status.code()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entry(id: &str, kind: LaunchKind, pid: Option<u32>) -> SessionEntry {
        SessionEntry {
            session_id: id.to_string(),
            cli_key: "claude".to_string(),
            directory: "C:\\projects".to_string(),
            started_at: "2026-06-10T12:00:00-03:00".to_string(),
            kind,
            pid,
        }
    }

    // The registry is a process-wide singleton, so each test uses unique ids to
    // avoid cross-test interference and cleans up after itself.

    #[test]
    fn register_and_remove_roundtrip() {
        let id = "test-register-remove";
        register_session(make_entry(id, LaunchKind::Tracked, Some(1234)));
        assert!(list_sessions().iter().any(|s| s.session_id == id));
        let removed = remove_session(id);
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().session_id, id);
        assert!(!list_sessions().iter().any(|s| s.session_id == id));
    }

    #[test]
    fn remove_missing_returns_none() {
        assert!(remove_session("does-not-exist-xyz").is_none());
    }

    #[test]
    fn list_reflects_inserted_session() {
        let id = "test-list-reflect";
        register_session(make_entry(id, LaunchKind::Detached, None));
        let listed: Vec<_> = list_sessions()
            .into_iter()
            .filter(|s| s.session_id == id)
            .collect();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].kind, "detached");
        assert_eq!(listed[0].pid, None);
        remove_session(id);
    }

    #[test]
    fn session_pid_lookup() {
        let id = "test-pid-lookup";
        register_session(make_entry(id, LaunchKind::Tracked, Some(4321)));
        assert_eq!(session_pid(id), Some(4321));
        remove_session(id);
        assert_eq!(session_pid(id), None);
    }

    #[test]
    fn kind_serializes_to_expected_strings() {
        assert_eq!(LaunchKind::Tracked.as_str(), "tracked");
        assert_eq!(LaunchKind::Detached.as_str(), "detached");
    }

    #[test]
    fn active_session_view_maps_fields() {
        let entry = make_entry("view-test", LaunchKind::Tracked, Some(99));
        let view = ActiveSession::from(&entry);
        assert_eq!(view.session_id, "view-test");
        assert_eq!(view.cli_key, "claude");
        assert_eq!(view.kind, "tracked");
        assert_eq!(view.pid, Some(99));
    }
}
