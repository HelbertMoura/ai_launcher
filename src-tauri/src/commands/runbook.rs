// Runbook step execution (B3).
//
// A runbook step may carry a shell command that the user wants to run as part
// of a sequence (install / configure / launch / check). This module exposes a
// single Tauri command, `run_runbook_step`, that executes one command in a
// PowerShell child process with a bounded timeout and returns a structured
// result (exit code + captured stdout/stderr, ANSI-stripped).
//
// Security: the command string is sanitized with the same `sanitize_args`
// gate used by the launcher (rejects shell metacharacters), and the working
// directory is validated with `validate_directory`. We never interpolate the
// command into a larger PowerShell statement — it is passed as a single
// argument to `-Command`, and shell metacharacters are already rejected.

use std::os::windows::process::CommandExt;
use std::path::{Component, Path};
use std::process::Command;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::util::{
    command_exists, is_valid_env_key, sanitize_args, strip_ansi, validate_directory,
    CREATE_NO_WINDOW,
};

/// Default timeout for a single runbook step, in seconds.
pub const DEFAULT_STEP_TIMEOUT_SECS: u64 = 120;
/// Upper bound to keep a misconfigured step from blocking forever.
pub const MAX_STEP_TIMEOUT_SECS: u64 = 1800;

/// Structured result of running one runbook step.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct StepResult {
    /// True when the process exited with code 0.
    pub ok: bool,
    /// Process exit code when known (None when terminated by signal/timeout).
    pub exit_code: Option<i32>,
    /// Captured stdout (ANSI-stripped, length-capped).
    pub stdout: String,
    /// Captured stderr (ANSI-stripped, length-capped).
    pub stderr: String,
    /// True when the step was killed because it exceeded the timeout.
    pub timed_out: bool,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct RunbookConditionInput {
    #[serde(rename = "type")]
    pub condition_type: String,
    pub value: Option<String>,
    #[serde(default)]
    pub negate: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ConditionResult {
    pub ok: bool,
    pub message: String,
}

/// Maximum bytes of stdout/stderr surfaced to the UI (per stream).
const MAX_OUTPUT_CHARS: usize = 20_000;

fn cap_output(raw: &[u8]) -> String {
    let text = String::from_utf8_lossy(raw);
    let clean = strip_ansi(&text);
    if clean.chars().count() > MAX_OUTPUT_CHARS {
        let truncated: String = clean.chars().take(MAX_OUTPUT_CHARS).collect();
        format!("{}\n… (output truncated)", truncated)
    } else {
        clean
    }
}

/// Build a [`StepResult`] from a finished process output.
///
/// Extracted so it can be unit-tested without spawning a real process.
fn result_from_output(output: &std::process::Output) -> StepResult {
    StepResult {
        ok: output.status.success(),
        exit_code: output.status.code(),
        stdout: cap_output(&output.stdout),
        stderr: cap_output(&output.stderr),
        timed_out: false,
    }
}

/// Clamp a caller-supplied timeout into the allowed range, falling back to the
/// default when none is provided.
fn resolve_timeout(timeout_secs: Option<u64>) -> u64 {
    match timeout_secs {
        Some(0) | None => DEFAULT_STEP_TIMEOUT_SECS,
        Some(t) => t.min(MAX_STEP_TIMEOUT_SECS),
    }
}

fn safe_relative_path(value: &str) -> Result<&Path, String> {
    let path = Path::new(value.trim());
    if value.trim().is_empty() {
        return Err("Condição precisa de um caminho".into());
    }
    if path.is_absolute() {
        return Err("Condição aceita apenas caminho relativo".into());
    }
    for component in path.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                return Err("Caminho da condição não pode sair do workspace".into());
            }
        }
    }
    Ok(path)
}

fn apply_negation(ok: bool, negate: bool) -> bool {
    if negate {
        !ok
    } else {
        ok
    }
}

#[tauri::command]
pub fn evaluate_runbook_condition(
    condition: RunbookConditionInput,
    cwd: Option<String>,
) -> Result<ConditionResult, String> {
    let kind = condition.condition_type.as_str();
    let raw_value = condition.value.as_deref().unwrap_or("").trim();
    let ok = match kind {
        "always" => true,
        "fileExists" => {
            let root = validate_directory(cwd.as_deref().unwrap_or(""))?;
            let relative = safe_relative_path(raw_value)?;
            Path::new(&root).join(relative).exists()
        }
        "commandExists" => {
            if raw_value.is_empty() {
                return Err("Condição precisa de um comando".into());
            }
            if raw_value.chars().any(char::is_whitespace) {
                return Err("Condição commandExists aceita apenas o nome do comando".into());
            }
            command_exists(raw_value)
        }
        "envExists" => {
            if !is_valid_env_key(raw_value) {
                return Err("Nome de variável de ambiente inválido".into());
            }
            std::env::var_os(raw_value).is_some()
        }
        "previousSucceeded" => {
            return Err("previousSucceeded é avaliado pelo runner".into());
        }
        other => return Err(format!("Tipo de condição desconhecido: {}", other)),
    };
    let final_ok = apply_negation(ok, condition.negate);
    Ok(ConditionResult {
        ok: final_ok,
        message: if final_ok {
            "condition passed".into()
        } else {
            "condition skipped step".into()
        },
    })
}

/// Execute a single runbook step command in PowerShell with a timeout.
///
/// - `command`: the shell command to run (sanitized; metacharacters rejected).
/// - `cwd`: optional working directory (validated; empty/None -> user home).
/// - `timeout_secs`: optional per-step timeout (clamped to `MAX_STEP_TIMEOUT_SECS`).
#[tauri::command]
pub fn run_runbook_step(
    command: String,
    cwd: Option<String>,
    timeout_secs: Option<u64>,
) -> Result<StepResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Comando vazio: nada para executar".to_string());
    }
    // Reject shell metacharacters (; & | ` $ > < newline parens braces).
    let safe_command = sanitize_args(trimmed)?;
    // Validate cwd; empty/None resolves to the user's home directory.
    let dir = validate_directory(cwd.as_deref().unwrap_or(""))?;
    let timeout = resolve_timeout(timeout_secs);

    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &safe_command]);
    cmd.current_dir(&dir);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    cmd.creation_flags(CREATE_NO_WINDOW);

    let child = cmd
        .spawn()
        .map_err(|e| format!("Falha ao iniciar o comando: {}", e))?;
    let pid = child.id();

    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });

    match rx.recv_timeout(Duration::from_secs(timeout)) {
        Ok(Ok(output)) => Ok(result_from_output(&output)),
        Ok(Err(e)) => Err(format!("Erro ao aguardar o processo: {}", e)),
        Err(_) => {
            // Timed out: terminate the process tree.
            let mut kill = Command::new("taskkill");
            kill.args(["/F", "/T", "/PID", &pid.to_string()]);
            kill.creation_flags(CREATE_NO_WINDOW);
            let _ = kill.output();
            Ok(StepResult {
                ok: false,
                exit_code: None,
                stdout: String::new(),
                stderr: format!("Comando excedeu o tempo limite de {}s", timeout),
                timed_out: true,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_timeout_defaults_when_absent_or_zero() {
        assert_eq!(resolve_timeout(None), DEFAULT_STEP_TIMEOUT_SECS);
        assert_eq!(resolve_timeout(Some(0)), DEFAULT_STEP_TIMEOUT_SECS);
    }

    #[test]
    fn resolve_timeout_clamps_to_max() {
        assert_eq!(resolve_timeout(Some(60)), 60);
        assert_eq!(
            resolve_timeout(Some(MAX_STEP_TIMEOUT_SECS + 10)),
            MAX_STEP_TIMEOUT_SECS
        );
    }

    #[test]
    fn cap_output_strips_ansi() {
        let raw = b"\x1b[32mhello\x1b[0m world";
        assert_eq!(cap_output(raw), "hello world");
    }

    #[test]
    fn cap_output_truncates_long_streams() {
        let big = "x".repeat(MAX_OUTPUT_CHARS + 500);
        let out = cap_output(big.as_bytes());
        assert!(out.contains("output truncated"));
        assert!(out.chars().count() < MAX_OUTPUT_CHARS + 500);
    }

    #[test]
    fn empty_command_is_rejected() {
        let res = run_runbook_step("   ".to_string(), None, None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("vazio"));
    }

    #[test]
    fn command_with_metacharacters_is_rejected() {
        // `sanitize_args` rejects shell metacharacters before any process spawns.
        let res = run_runbook_step("echo hi; rm -rf /".to_string(), None, None);
        assert!(res.is_err());
    }

    #[test]
    fn nonexistent_cwd_is_rejected() {
        let res = run_runbook_step(
            "echo hi".to_string(),
            Some(r"C:\__definitely_missing_dir_xyz__".to_string()),
            None,
        );
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("não existe"));
    }

    #[test]
    fn file_condition_rejects_parent_traversal() {
        let condition = RunbookConditionInput {
            condition_type: "fileExists".into(),
            value: Some("../secret.txt".into()),
            negate: false,
        };
        let res = evaluate_runbook_condition(condition, None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("workspace"));
    }

    #[test]
    fn env_condition_validates_key() {
        let condition = RunbookConditionInput {
            condition_type: "envExists".into(),
            value: Some("BAD-NAME".into()),
            negate: false,
        };
        let res = evaluate_runbook_condition(condition, None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("inválido"));
    }

    #[test]
    fn command_condition_rejects_args() {
        let condition = RunbookConditionInput {
            condition_type: "commandExists".into(),
            value: Some("node --version".into()),
            negate: false,
        };
        let res = evaluate_runbook_condition(condition, None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("nome do comando"));
    }

    #[test]
    fn always_condition_can_be_negated() {
        let condition = RunbookConditionInput {
            condition_type: "always".into(),
            value: None,
            negate: true,
        };
        let res = evaluate_runbook_condition(condition, None).expect("condition");
        assert!(!res.ok);
    }
}
