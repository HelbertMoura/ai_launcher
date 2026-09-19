use std::path::PathBuf;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use super::process::command_exists;
#[cfg(windows)]
use super::process::run_silent;
#[cfg(windows)]
use super::process::CREATE_NO_WINDOW;

// ============================================================
// PATH / FILE RESOLUTION (platform split at the function level)
// ============================================================

/// Expands Windows `%VAR%` references used by the shared CLI/tool definitions.
/// On macOS/Linux none of those variables exist, so the input is returned
/// unchanged (callers treat non-existent paths as "not found").
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

#[cfg(windows)]
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

// ============================================================
// TERMINAL EMULATOR — macOS / Linux
// ============================================================
//
// The assembly helpers below are deliberately platform-NEUTRAL (pure string
// logic) so they are unit-tested on every platform, including Windows where
// the only consumers are the tests; hence `allow(dead_code)` on this section.

/// Candidate terminal emulators for Linux (and other Unix), most specific
/// first: the user's `$TERMINAL`, the Debian alternative, then well-known
/// emulators. `$TERMINAL` is treated as a bare program name.
#[allow(dead_code)]
pub fn unix_terminal_emulator_candidates() -> Vec<String> {
    let mut candidates = Vec::new();
    if let Ok(custom) = std::env::var("TERMINAL") {
        let custom = custom.trim();
        if !custom.is_empty() {
            candidates.push(custom.to_string());
        }
    }
    for name in [
        "x-terminal-emulator",
        "gnome-terminal",
        "konsole",
        "alacritty",
        "kitty",
    ] {
        candidates.push(name.to_string());
    }
    candidates
}

/// Pure selection over mockable availability — keeps the discovery logic
/// testable on every platform.
#[allow(dead_code)]
pub fn pick_first_available(
    candidates: &[String],
    is_available: impl Fn(&str) -> bool,
) -> Option<String> {
    candidates
        .iter()
        .find(|candidate| is_available(candidate))
        .cloned()
}

#[cfg(not(windows))]
pub fn find_terminal_emulator() -> Option<String> {
    pick_first_available(&unix_terminal_emulator_candidates(), command_exists)
}

/// Pure assembly of the emulator command line that runs a POSIX shell script.
/// The script carries its own `cd`, so no working-directory flags are needed.
/// Flag styles: `gnome-terminal` wants `--`, `kitty` takes none, everything
/// else (konsole, alacritty, x-terminal-emulator, `$TERMINAL`) uses `-e`.
#[allow(dead_code)]
pub fn emulator_spawn_cmd(emulator: &str, script: &str) -> TerminalSpawn {
    let separator: &[&str] = match emulator {
        "gnome-terminal" => &["--"],
        "kitty" => &[],
        _ => &["-e"],
    };
    let mut args: Vec<String> = separator.iter().map(|s| s.to_string()).collect();
    args.push("bash".to_string());
    args.push("-c".to_string());
    args.push(script.to_string());
    TerminalSpawn {
        program: emulator.to_string(),
        args,
    }
}

#[derive(Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub struct TerminalSpawn {
    pub program: String,
    pub args: Vec<String>,
}

/// Pure assembly of the AppleScript that runs a shell script inside macOS
/// Terminal.app. Backslashes and double quotes are escaped for the AppleScript
/// string literal; single quotes survive untouched (the script itself uses
/// POSIX single-quote escaping via [`sh_quote`]).
#[allow(dead_code)]
pub fn macos_terminal_applescript(shell_script: &str) -> String {
    let escaped = shell_script.replace('\\', "\\\\").replace('"', "\\\"");
    format!("tell application \"Terminal\"\nactivate\ndo script \"{escaped}\"\nend tell")
}

/// POSIX single-quote wrapper: `'` becomes `'\''`, so any value lands in the
/// shell as a literal (same discipline as the PowerShell single-quote path).
#[allow(dead_code)]
pub fn sh_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Provider-owned variable names dropped from the inherited environment when a
/// session asks for hygiene — mirrors the Windows `Remove-Item Env:ANTHROPIC_*`
/// block in `cli.rs`. Prefix matches first, then exact names.
pub const PROVIDER_ENV_PREFIXES: &[&str] = &["ANTHROPIC_", "CLAUDE_CODE_"];
pub const PROVIDER_ENV_EXACT: &[&str] = &["API_TIMEOUT_MS"];

/// Collects the provider-managed variable names actually present in the current
/// process environment, so the launch script can unset them by explicit name
/// (see [`posix_unset_lines`]).
#[allow(dead_code)]
pub fn provider_env_keys_to_unset() -> Vec<String> {
    std::env::vars()
        .map(|(key, _)| key)
        .filter(|key| {
            PROVIDER_ENV_EXACT.iter().any(|exact| exact == key)
                || PROVIDER_ENV_PREFIXES
                    .iter()
                    .any(|prefix| key.starts_with(prefix))
        })
        .collect()
}

/// Builds a POSIX-safe `unset` line from explicit variable names. Shell
/// indirection like `unset ${!ANTHROPIC_*}` is bash-only — zsh (the macOS
/// Terminal.app default login shell) fails with "bad substitution" — so the
/// matching names are enumerated at runtime and emitted literally. Keys failing
/// [`crate::safety::is_valid_env_key`] are dropped; valid keys are deduplicated
/// and sorted (deterministic output). Returns an empty string when nothing
/// remains to unset.
#[allow(dead_code)]
pub fn posix_unset_lines(keys: impl IntoIterator<Item = String>) -> String {
    let mut names: Vec<String> = keys
        .into_iter()
        .filter(|key| crate::safety::is_valid_env_key(key))
        .collect();
    names.sort();
    names.dedup();
    if names.is_empty() {
        String::new()
    } else {
        format!("unset {}\n", names.join(" "))
    }
}

/// Builds the POSIX launch script for a Unix session:
/// `cd` into the (validated) working directory, optionally drop inherited
/// provider variables by explicit name (the same hygiene as the Windows
/// PowerShell script — POSIX shells have no portable wildcard unset), export
/// the sanitized env assignments, then run the CLI line.
/// Pure — unit-tested on all platforms.
#[allow(dead_code)]
pub fn build_unix_session_script(
    work_dir: &str,
    provider_env_keys: &[String],
    env_vars: Option<&std::collections::HashMap<String, String>>,
    cli_line: &str,
) -> String {
    let mut script = String::new();
    script.push_str(&format!("cd {}\n", sh_quote(work_dir)));
    script.push_str(&posix_unset_lines(provider_env_keys.iter().cloned()));
    if let Some(vars) = env_vars {
        for (key, value) in vars {
            if crate::safety::is_valid_env_key(key) {
                script.push_str(&format!("export {}={}\n", key, sh_quote(value)));
            }
        }
    }
    script.push_str(cli_line);
    script.push('\n');
    script
}

/// Spawns a CLI session inside the platform terminal emulator (Unix).
///
/// macOS: Terminal.app via `osascript` (always present). Linux: the first
/// candidate emulator whose spawn succeeds; `$TERMINAL` is honored first.
/// Emulators detach like `wt.exe` does on Windows, so the session is
/// registered as "detached" by the caller.
#[cfg(unix)]
pub fn spawn_unix_terminal_session(script: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let apple_script = macos_terminal_applescript(script);
        return Command::new("osascript")
            .args(["-e", &apple_script])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Falha ao abrir o Terminal do macOS: {e}"));
    }
    #[cfg(not(target_os = "macos"))]
    {
        for candidate in unix_terminal_emulator_candidates() {
            if !command_exists(&candidate) {
                continue;
            }
            let spawn = emulator_spawn_cmd(&candidate, script);
            if Command::new(&spawn.program)
                .args(&spawn.args)
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        }
        Err(
            "Nenhum emulador de terminal disponível. Defina a variável $TERMINAL ou \
             instale gnome-terminal, konsole, alacritty ou kitty."
                .to_string(),
        )
    }
}

// ============================================================
// WINDOWS-ONLY DISCOVERY (Start Menu shortcuts, npm stub heal)
// ============================================================

#[cfg(windows)]
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

/// Heals the broken Windows npm stub of Claude Code. Windows-only quirk of the
/// npm `.cmd` shim layout; nothing to do on macOS/Linux.
#[cfg(windows)]
pub fn heal_claude_npm_stub_if_needed() {
    let prefixes = [r"%APPDATA%\npm", r"%LOCALAPPDATA%\npm"];
    for prefix in prefixes {
        let base = expand_env(prefix);
        let claude_bin = std::path::Path::new(&base)
            .join("node_modules")
            .join("@anthropic-ai")
            .join("claude-code")
            .join("bin")
            .join("claude.exe");

        if claude_bin.exists() {
            let is_stub = match std::fs::metadata(&claude_bin) {
                Ok(meta) => meta.len() < 4096,
                Err(_) => false,
            };
            if is_stub {
                let install_script = std::path::Path::new(&base)
                    .join("node_modules")
                    .join("@anthropic-ai")
                    .join("claude-code")
                    .join("install.cjs");
                if install_script.exists() {
                    let _ = run_silent("node", &[install_script.to_string_lossy().as_ref()]);
                }
                let still_stub = match std::fs::metadata(&claude_bin) {
                    Ok(meta) => meta.len() < 4096,
                    Err(_) => true,
                };
                if still_stub {
                    for cand in [
                        expand_env(r"%USERPROFILE%\.local\bin\claude.exe"),
                        expand_env(r"%LOCALAPPDATA%\Programs\claude\bin\claude.exe"),
                    ] {
                        let cand_path = std::path::Path::new(&cand);
                        if cand_path.exists() {
                            if let Ok(meta) = std::fs::metadata(cand_path) {
                                if meta.len() > 4096 {
                                    let _ = std::fs::copy(cand_path, &claude_bin);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// No-op outside Windows: the npm-stub breakage this heals does not exist on
/// macOS/Linux (callers run it unconditionally on every CLI scan).
#[cfg(not(windows))]
pub fn heal_claude_npm_stub_if_needed() {}

/// Resolves a CLI command to an executable path on the current platform.
///
/// Windows keeps the v21 lookup (extra_paths with `%VAR%`, npm prefixes,
/// `where`). macOS/Linux check the usual install locations (`~/.claude/local`,
/// `~/.local/bin`), tolerate the shared Windows-flavored `extra_paths`
/// (`%USERPROFILE%` → home, `\` → `/`, `.exe` stripped) and fall back to
/// `which`.
pub fn resolve_cli_path(cmd: &str, extra_paths: &[String]) -> Option<String> {
    #[cfg(windows)]
    {
        if cmd == "claude" {
            heal_claude_npm_stub_if_needed();
        }
        for raw in extra_paths {
            let expanded = expand_env(raw);
            if std::path::Path::new(&expanded).exists() {
                return Some(expanded);
            }
        }
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

        if let Some(first) = where_results.first() {
            return Some(first.clone());
        }
        None
    }
    #[cfg(not(windows))]
    {
        if cmd == "claude" {
            if let Some(home) = dirs::home_dir() {
                let local = home.join(".claude").join("local").join("claude");
                if local.exists() {
                    return Some(local.to_string_lossy().into_owned());
                }
            }
        }
        if let Some(home) = dirs::home_dir() {
            let bin = home.join(".local").join("bin").join(cmd);
            if bin.exists() {
                return Some(bin.to_string_lossy().into_owned());
            }
            for raw in extra_paths {
                let expanded = raw
                    .replace("%USERPROFILE%", &home.to_string_lossy())
                    .replace('\\', "/");
                // Definitions carry Windows-style `.exe` names; prefer the
                // stripped Unix binary, but keep the original as fallback.
                let stripped = expanded.strip_suffix(".exe").unwrap_or(&expanded);
                if std::path::Path::new(stripped).exists() {
                    return Some(stripped.to_string());
                }
                if std::path::Path::new(&expanded).exists() {
                    return Some(expanded);
                }
            }
        }
        if command_exists(cmd) {
            return Some(cmd.to_string());
        }
        None
    }
}

#[cfg(windows)]
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
        "antigravity" => vec![
            (
                expand_env(r"%LOCALAPPDATA%\Programs\Antigravity"),
                vec!["Antigravity.exe"],
            ),
            (
                expand_env(r"%LOCALAPPDATA%\Programs\AntGravity"),
                vec!["AntGravity.exe"],
            ),
        ],
        "ollama" => vec![
            (
                expand_env(r"%LOCALAPPDATA%\Programs\Ollama"),
                vec!["ollama app.exe", "ollama.exe"],
            ),
            (
                expand_env(r"%PROGRAMFILES%\Ollama"),
                vec!["ollama app.exe", "ollama.exe"],
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
        "antigravity" => Some("antigravity"),
        "ollama" => Some("ollama"),
        _ => None,
    };
    if let Some(hint) = lnk_hint {
        if let Some(p) = find_exe_from_start_menu(hint) {
            return Some(p);
        }
    }
    None
}

/// GUI install layouts are Windows-specific; on macOS/Linux tools are resolved
/// from PATH (see [`resolve_cli_path`]) or reported as "não detectado".
#[cfg(not(windows))]
pub fn find_tool_path(_tool_key: &str) -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sh_quote_wraps_and_escapes_single_quotes() {
        assert_eq!(sh_quote("abc"), "'abc'");
        assert_eq!(sh_quote("it's"), "'it'\\''s'");
        assert_eq!(sh_quote(""), "''");
        assert_eq!(sh_quote("a b/c"), "'a b/c'");
    }

    #[test]
    fn unix_session_script_puts_cd_env_and_cli_in_order() {
        let mut env = std::collections::HashMap::new();
        env.insert("VALID_KEY".to_string(), "value with space".to_string());
        env.insert("1nvalid".to_string(), "dropped".to_string());
        env.insert("WITH_QUOTE".to_string(), "it's".to_string());

        let script =
            build_unix_session_script("/home/dev/proj", &[], Some(&env), "claude --model x");

        let lines: Vec<&str> = script.lines().collect();
        assert_eq!(lines[0], "cd '/home/dev/proj'");
        assert_eq!(
            lines.last(),
            Some(&"claude --model x"),
            "CLI line must be the last one"
        );
        // HashMap order is not deterministic; the export lines are checked as a
        // set between the fixed cd/unset header and the CLI line.
        let exports: std::collections::HashSet<&str> =
            lines[1..lines.len() - 1].iter().copied().collect();
        assert_eq!(
            exports,
            std::collections::HashSet::from([
                "export VALID_KEY='value with space'",
                "export WITH_QUOTE='it'\\''s'",
            ]),
            "invalid env keys must be dropped and values single-quoted"
        );
    }

    #[test]
    fn unix_session_script_cleans_provider_env_by_explicit_name() {
        let keys = vec![
            "ANTHROPIC_API_KEY".to_string(),
            "API_TIMEOUT_MS".to_string(),
            "CLAUDE_CODE_SKIP_BEDROCK_CHECK".to_string(),
        ];
        let script = build_unix_session_script("/tmp", &keys, None, "claude");
        let lines: Vec<&str> = script.lines().collect();
        assert_eq!(lines[0], "cd '/tmp'");
        assert_eq!(
            lines[1], "unset ANTHROPIC_API_KEY API_TIMEOUT_MS CLAUDE_CODE_SKIP_BEDROCK_CHECK",
            "provider hygiene must emit an explicit POSIX-safe unset line (no bash indirection)"
        );
        assert_eq!(lines[2], "claude");
    }

    #[test]
    fn unix_session_script_without_env_only_has_cd_and_cli() {
        let script = build_unix_session_script("/tmp", &[], None, "codex");
        let lines: Vec<&str> = script.lines().collect();
        assert_eq!(lines, vec!["cd '/tmp'", "codex"]);
    }

    #[test]
    fn posix_unset_lines_filters_sorts_and_dedups() {
        let out = posix_unset_lines([
            "ANTHROPIC_BASE_URL".to_string(),
            "1nvalid".to_string(),
            "ANTHROPIC_API_KEY".to_string(),
            "ANTHROPIC_BASE_URL".to_string(),
        ]);
        assert_eq!(
            out, "unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL\n",
            "invalid keys dropped, valid keys sorted and deduplicated"
        );
        assert_eq!(posix_unset_lines(Vec::new()), "", "empty input -> no line");
        assert_eq!(
            posix_unset_lines(["1nvalid".to_string()]),
            "",
            "only-invalid input -> no line"
        );
    }

    #[test]
    fn provider_env_collector_only_returns_provider_names() {
        // No env mutation here (parallel tests): every returned key must match
        // the documented prefix/exact filters, whatever the ambient environment.
        for key in provider_env_keys_to_unset() {
            let matches = PROVIDER_ENV_EXACT.iter().any(|exact| exact == &key)
                || PROVIDER_ENV_PREFIXES
                    .iter()
                    .any(|prefix| key.starts_with(prefix));
            assert!(matches, "collector returned a non-provider key: {key}");
        }
    }

    #[test]
    fn emulator_cmd_matches_known_flag_styles() {
        let script = "cd '/x'\nclaude\n";
        let gnome = emulator_spawn_cmd("gnome-terminal", script);
        assert_eq!(gnome.program, "gnome-terminal");
        assert_eq!(gnome.args, vec!["--", "bash", "-c", script]);
        let kitty = emulator_spawn_cmd("kitty", script);
        assert_eq!(kitty.args, vec!["bash", "-c", script]);
        let konsole = emulator_spawn_cmd("konsole", script);
        assert_eq!(konsole.args, vec!["-e", "bash", "-c", script]);
        let custom = emulator_spawn_cmd("my-term", script);
        assert_eq!(custom.args, vec!["-e", "bash", "-c", script]);
    }

    #[test]
    fn apple_script_escapes_double_quotes_and_backslashes() {
        let out = macos_terminal_applescript("cd '/x'\nclaude \"y\"");
        assert!(out.starts_with("tell application \"Terminal\""));
        assert!(out.contains("do script \"cd '/x'\nclaude \\\"y\\\"\""));
        assert!(out.ends_with("end tell"));
    }

    #[test]
    fn pick_first_available_returns_first_match() {
        let candidates = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        let picked = pick_first_available(&candidates, |c| c == "b");
        assert_eq!(picked.as_deref(), Some("b"));
        assert_eq!(pick_first_available(&candidates, |_| false), None);
    }

    #[test]
    fn unix_terminal_candidates_start_with_user_terminal() {
        // Without $TERMINAL set in the test environment the first candidate is
        // the Debian alternative; the well-known list must follow.
        let candidates = unix_terminal_emulator_candidates();
        assert!(candidates.contains(&"gnome-terminal".to_string()));
        assert!(candidates.contains(&"konsole".to_string()));
        assert!(candidates.contains(&"alacritty".to_string()));
        assert!(candidates.contains(&"kitty".to_string()));
        assert!(candidates.contains(&"x-terminal-emulator".to_string()));
        if let Some(first) = candidates.first() {
            if std::env::var("TERMINAL").is_err() {
                assert_eq!(first, "x-terminal-emulator");
            }
        }
    }
}
