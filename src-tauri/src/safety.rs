//! Safety helpers for command-line argument, env-key and PowerShell-script
//! interpolation. Every function here is a defense-in-depth layer that sits
//! between user input and `Command::new` / PowerShell `-Command` — keep them
//! small, well-tested and free of external I/O.
//!
//! Extracted from `util.rs` as part of REF-001 (split `util.rs`). The
//! behavioural contract is identical; only the location changed. See
//! `.wolf/audit-2026-08-10.md` for the rationale.

#[cfg(windows)]
use std::collections::HashMap;

use crate::util::log_event;

/// The shell-metacharacter deny-list shared by every token gate in this
/// module. Covers the three Windows shell dispatchers (cmd, PowerShell, pwsh)
/// and the obvious Unix surface (bash, sh) even though the production runtime
/// is Windows-only.
pub const SHELL_METACHARACTERS: &[char] = &[
    ';', '&', '|', '`', '$', '>', '<', '\n', '\r', '(', ')', '{', '}',
];

/// Rejects shell metacharacters in a single argv-style argument string.
///
/// The list is intentionally a deny-list (not allow-list) so the function
/// stays useful for arbitrary tool CLIs that accept `--long-flag=value`
/// style arguments.
pub fn sanitize_args(args: &str) -> Result<String, String> {
    if args.chars().any(|c| SHELL_METACHARACTERS.contains(&c)) {
        return Err(
            "Argumentos contêm caracteres proibidos (; & | ` $ > < newline ( ) { })".into(),
        );
    }
    Ok(args.trim().to_string())
}

/// Rejects `value` when it contains any metacharacter from the shared
/// deny-list used by [`sanitize_args`].
///
/// Used to gate raw, user-supplied tokens that get interpolated verbatim into
/// a shell script (e.g. a command name with no space, which PowerShell would
/// split into two commands). `what` names the rejected field in the error.
pub fn reject_shell_metacharacters(value: &str, what: &str) -> Result<(), String> {
    if value.chars().any(|c| SHELL_METACHARACTERS.contains(&c)) {
        return Err(format!(
            "{} contains forbidden characters: ; & | ` $ > < newline ( ) {{ }} — value: {:?}",
            what, value
        ));
    }
    Ok(())
}

/// Escapes the two metacharacters cmd.exe itself interprets (`^` escape char,
/// `%VAR%` env expansion) in a command line destined for a `cmd /K ...`
/// fallback spawn.
///
/// This is the last-resort layer below the PowerShell spawn chain: argument
/// content is already gated by [`sanitize_args`], but `^` and `%` are not on
/// that deny-list and would still be interpreted by cmd.exe.
#[cfg(windows)]
pub fn escape_cmd_fallback(line: &str) -> String {
    line.replace('^', "^^").replace('%', "^%")
}

/// Validates an environment variable name against `^[A-Za-z_][A-Za-z0-9_]*$`.
///
/// Used before interpolating the raw key into a PowerShell `$env:KEY = '...'`
/// assignment, preventing injection via crafted variable names.
pub fn is_valid_env_key(key: &str) -> bool {
    let mut chars = key.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Appends `$env:KEY = 'VALUE'` lines to a PowerShell script for each valid env var.
///
/// Keys failing [`is_valid_env_key`] are skipped and logged. Values have single
/// quotes escaped (`'` -> `''`) so they remain inside the single-quoted literal.
/// Shared by `launch_cli` and `launch_custom_cli`.
#[cfg(windows)]
pub fn append_env_assignments(script: &mut String, vars: &HashMap<String, String>) {
    for (k, v) in vars {
        if !is_valid_env_key(k) {
            log_event("launch", &format!("skipping invalid env var name: {:?}", k));
            continue;
        }
        let esc = v.replace('\'', "''");
        script.push_str(&format!("$env:{} = '{}'\n", k, esc));
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

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
        for bad in [
            "; rm -rf /",
            "arg && other",
            "arg | pipe",
            "arg > file",
            "arg < file",
            "arg $(other)",
            "arg `other`",
            "arg ${other}",
        ] {
            assert!(sanitize_args(bad).is_err(), "should reject: {}", bad);
        }
    }

    #[test]
    fn sanitize_args_neutralizes_newline_injection() {
        let payload = "arg\n--evil-flag";
        let result = sanitize_args(payload);
        assert!(result.is_err(), "newline in arg must be rejected");

        for bad in ["\r\n", "\nfoo", "foo\r"] {
            assert!(sanitize_args(bad).is_err(), "should reject: {:?}", bad);
        }
    }

    #[test]
    fn is_valid_env_key_accepts_valid_names() {
        for ok in [
            "PATH",
            "ANTHROPIC_API_KEY",
            "_PRIVATE",
            "X",
            "FOO_BAR_123",
            "a",
            "_",
        ] {
            assert!(is_valid_env_key(ok), "should accept: {}", ok);
        }
    }

    #[test]
    fn is_valid_env_key_rejects_invalid_names() {
        for bad in [
            "", "1FOO", "FOO BAR", "FOO;BAR", "FOO$BAR", "FOO-BAR", "FOO.BAR", "-FOO", "=FOO",
            "FOO=BAR",
        ] {
            assert!(!is_valid_env_key(bad), "should reject: {:?}", bad);
        }
    }

    #[test]
    #[cfg(windows)]
    fn append_env_assignments_skips_invalid_keys_and_escapes_quotes() {
        let mut script = String::new();
        let mut vars = HashMap::new();
        vars.insert("VALID".to_string(), "ok".to_string());
        vars.insert("1INVALID".to_string(), "x".to_string());
        vars.insert("HAS SPACE".to_string(), "x".to_string());
        vars.insert("WITH_QUOTE".to_string(), "it's".to_string());

        append_env_assignments(&mut script, &vars);

        assert!(script.contains("$env:VALID = 'ok'"), "got: {script}");
        assert!(
            script.contains("$env:WITH_QUOTE = 'it''s'"),
            "single quote must be doubled: {script}"
        );
        assert!(!script.contains("1INVALID"), "got: {script}");
        assert!(!script.contains("HAS SPACE"), "got: {script}");
    }

    #[test]
    fn reject_shell_metacharacters_blocks_injection_tokens() {
        for bad in [
            "a;b", "a&b", "a|b", "a`b", "a$b", "a>b", "a<b", "a\nb", "a\rb", "a(b", "a)b", "a{b",
            "a}b",
        ] {
            assert!(
                reject_shell_metacharacters(bad, "command").is_err(),
                "should reject: {:?}",
                bad
            );
        }
    }

    #[test]
    fn reject_shell_metacharacters_allows_legitimate_tokens() {
        let resolved = "zed <dir> --wait".replace("<dir>", r"C:\proj");
        for ok in [
            "claude",
            "agy",
            "code --wait",
            r"C:\Program Files\Zed\zed.exe",
            resolved.as_str(),
        ] {
            assert!(
                reject_shell_metacharacters(ok, "command").is_ok(),
                "should accept: {:?}",
                ok
            );
        }
    }

    #[test]
    #[cfg(windows)]
    fn escape_cmd_fallback_leaves_plain_text_untouched() {
        assert_eq!(escape_cmd_fallback("claude --verbose"), "claude --verbose");
        assert_eq!(
            escape_cmd_fallback(r#""C:\Program Files\App\x.exe" --flag=1"#),
            r#""C:\Program Files\App\x.exe" --flag=1"#
        );
    }

    #[test]
    #[cfg(windows)]
    fn escape_cmd_fallback_doubles_carets() {
        assert_eq!(escape_cmd_fallback("a^b"), "a^^b");
        assert_eq!(escape_cmd_fallback("^^"), "^^^^");
    }

    #[test]
    #[cfg(windows)]
    fn escape_cmd_fallback_escapes_percent_expansion() {
        assert_eq!(escape_cmd_fallback("%PATH%"), "^%PATH^%");
        assert_eq!(escape_cmd_fallback("100%"), "100^%");
    }

    #[test]
    #[cfg(windows)]
    fn escape_cmd_fallback_combines_caret_and_percent() {
        assert_eq!(escape_cmd_fallback("x^%y%"), "x^^^%y^%");
    }
}
