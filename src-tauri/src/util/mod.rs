// Modularized utility helpers for AI Launcher.
// Submodules: definitions, process, terminal, versions, tray_cfg.

pub mod definitions;
pub mod process;
pub mod terminal;
pub mod tray_cfg;
pub mod versions;

pub use definitions::*;
pub use process::*;
pub use terminal::*;
pub use tray_cfg::*;
pub use versions::*;

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    use std::collections::HashMap;

    // Safety helpers live canonically in `crate::safety` (the copies that used
    // to sit in `util::process` were dead code and were removed). These tests
    // exercise the canonical implementations.
    #[cfg(windows)]
    use crate::safety::append_env_assignments;
    use crate::safety::{is_valid_env_key, sanitize_args};

    #[test]
    fn extract_version_simple() {
        assert_eq!(extract_version("1.2.3"), Some("1.2.3".into()));
        assert_eq!(extract_version("v2.0.1"), Some("2.0.1".into()));
    }

    #[test]
    fn extract_version_last_wins() {
        let out = "node v22.13.0\nclaude 0.8.2";
        assert_eq!(extract_version(out), Some("0.8.2".into()));
    }

    #[test]
    fn extract_version_strips_ansi() {
        let out = "\x1b[32mclaude\x1b[0m version \x1b[1m1.5.7\x1b[0m";
        assert_eq!(extract_version(out), Some("1.5.7".into()));
    }

    #[test]
    fn extract_version_with_prerelease() {
        assert_eq!(
            extract_version("gemini 2.0.0-beta.3"),
            Some("2.0.0-beta.3".into())
        );
    }

    #[test]
    fn extract_version_none_when_no_digits() {
        assert_eq!(extract_version("hello world"), None);
    }

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
        for bad in &[
            "a; rm", "a && b", "a | b", "a > file", "a < file", "a`c`", "a$x",
        ] {
            assert!(sanitize_args(bad).is_err(), "should reject: {}", bad);
        }
    }

    #[test]
    fn sanitize_args_neutralizes_newline_injection() {
        let payload = "--flag\nInvoke-Expression evil";
        let result = sanitize_args(payload);
        assert!(result.is_err(), "arg with newline must be rejected");
        for bad in &["a\rb", "a(b", "a)b", "a{b", "a}b", "a\nb"] {
            assert!(sanitize_args(bad).is_err(), "should reject: {:?}", bad);
        }
    }

    #[test]
    fn is_valid_env_key_accepts_valid_names() {
        for ok in &["FOO", "_bar", "ANTHROPIC_API_KEY", "a1_2", "_"] {
            assert!(is_valid_env_key(ok), "should accept: {}", ok);
        }
    }

    #[test]
    fn is_valid_env_key_rejects_invalid_names() {
        for bad in &[
            "",
            "1abc",
            "FOO-BAR",
            "FOO BAR",
            "FOO=BAR",
            "FOO'; evil",
            "FOO\nBAR",
            "$env",
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
    fn compare_versions_basic() {
        assert!(compare_versions("1.0.0", "1.0.1"));
        assert!(compare_versions("1.0.0", "2.0.0"));
        assert!(!compare_versions("1.0.0", "1.0.0"));
        assert!(!compare_versions("2.0.0", "1.0.0"));
    }

    #[test]
    fn compare_versions_accepts_v_prefix_on_either_side() {
        assert!(compare_versions("v1.0.0", "v1.0.1"));
        assert!(compare_versions("1.4.2", "v1.5.0"));
        assert!(!compare_versions("v2.0.0", "1.9.9"));
    }

    #[test]
    fn compare_versions_treats_prerelease_build_by_numeric_parts() {
        // The comparator is NOT semver-aware: only the numeric dot-separated
        // prefix is compared, so a prerelease suffix becomes extra parts.
        // "1.2.3-beta.1" parses as [1,2,3,1] and thus compares as newer than
        // plain "1.2.3" — this documents the shipped behavior used by the
        // updates scan (updates.rs) so a future semver fix is deliberate.
        assert!(!compare_versions("1.2.3-beta.1", "1.2.3"));
        assert!(compare_versions("1.2.3", "1.3.0-beta.2"));
        assert!(!compare_versions("1.2.3-beta.1", "1.2.3-beta.1"));
    }

    #[test]
    fn compare_versions_pads_missing_parts_with_zero() {
        assert!(compare_versions("1.2", "1.2.1"));
        assert!(!compare_versions("1.2", "1.2.0"));
        assert!(!compare_versions("1.2.0.0", "1.2"));
    }

    #[test]
    fn compare_versions_falls_back_to_string_inequality_without_digits() {
        assert!(compare_versions("detectado", "1.0.0"));
        assert!(!compare_versions("abc", "abc"));
    }

    #[test]
    fn extract_version_keeps_build_metadata() {
        assert_eq!(
            extract_version("tool 2.1.0+build.7 ready"),
            Some("2.1.0+build.7".into())
        );
    }

    #[test]
    fn extract_version_falls_back_to_major_minor() {
        assert_eq!(extract_version("v3.11"), Some("3.11".into()));
    }

    #[test]
    fn read_exe_product_version_returns_none_for_missing_file() {
        let p = std::path::Path::new(r"C:\__nonexistent__\fake.exe");
        assert_eq!(read_exe_product_version(p), None);
    }

    #[test]
    fn resolve_cli_path_uses_extra_paths_when_file_exists() {
        use std::io::Write;
        let tmp = std::env::temp_dir().join("ai-launcher-test-agy");
        let _ = std::fs::create_dir_all(&tmp);
        let exe = tmp.join("fake-agy.exe");
        let mut f = std::fs::File::create(&exe).expect("criar fake exe");
        let _ = f.write_all(b"fake");
        let extras = vec![exe.to_string_lossy().to_string()];
        let resolved = resolve_cli_path("nonexistent-cmd-xyz-aabbcc", &extras);
        assert_eq!(resolved.as_deref(), Some(exe.to_string_lossy().as_ref()));
        let _ = std::fs::remove_file(&exe);
    }

    #[test]
    fn cli_definitions_have_no_gemini() {
        let defs = get_cli_definitions();
        assert!(
            !defs.iter().any(|c| c.key == "gemini"),
            "Gemini CLI foi descontinuado e não deve estar em get_cli_definitions"
        );
    }

    #[test]
    fn antigravity_cli_uses_agy_command() {
        let defs = get_cli_definitions();
        let ag = defs
            .iter()
            .find(|c| c.key == "antigravity")
            .expect("antigravity deve estar em get_cli_definitions");
        assert_eq!(ag.command, "agy", "binário real do Antigravity CLI é 'agy'");
        assert_eq!(ag.install_method, "script");
        assert!(
            ag.extra_paths
                .iter()
                .any(|p| p.contains(r"\agy\bin\agy.exe")),
            "extra_paths deve incluir %LOCALAPPDATA%\\agy\\bin\\agy.exe"
        );
        assert!(
            ag.update_manifest_url
                .as_deref()
                .map(|u| u.contains("manifests/windows_amd64.json"))
                .unwrap_or(false),
            "update_manifest_url deve apontar para o manifesto Google"
        );
    }

    #[test]
    fn claude_cli_uses_official_script_and_extra_paths() {
        let defs = get_cli_definitions();
        let claude = defs
            .iter()
            .find(|c| c.key == "claude")
            .expect("claude deve estar em get_cli_definitions");
        assert_eq!(claude.command, "claude");
        assert_eq!(claude.install_method, "script");
        assert!(
            claude
                .extra_paths
                .iter()
                .any(|p| p.contains(r"\.local\bin\claude.exe")),
            "extra_paths deve incluir %USERPROFILE%\\.local\\bin\\claude.exe"
        );
        assert!(
            claude.install_cmd.contains("install.ps1"),
            "install_cmd deve usar install.ps1 oficial"
        );
    }

    #[test]
    fn includes_new_agents() {
        let defs = get_cli_definitions();
        for key in ["aider", "goose", "cline", "roocode"] {
            assert!(
                defs.iter().any(|c| c.key == key),
                "deve incluir o novo agente: {key}"
            );
        }
    }

    #[test]
    fn cli_info_has_extra_paths_and_manifest_url() {
        let cli = CliInfo {
            key: "x".into(),
            name: "X".into(),
            command: "x".into(),
            flag: None,
            install_cmd: "".into(),
            version_cmd: "".into(),
            npm_pkg: None,
            pip_pkg: None,
            install_method: "script".into(),
            install_url: None,
            extra_paths: vec!["%LOCALAPPDATA%\\x\\x.exe".into()],
            update_manifest_url: Some("https://example.com/m.json".into()),
        };
        assert_eq!(cli.extra_paths.len(), 1);
        assert!(cli.update_manifest_url.is_some());
    }

    #[test]
    fn builtin_providers_list_six_entries() {
        let providers = get_builtin_providers();
        assert_eq!(providers.len(), 6, "got: {providers:?}");
    }

    #[test]
    fn builtin_providers_have_unique_stable_ids() {
        let providers = get_builtin_providers();
        let mut seen = std::collections::HashSet::new();
        for p in providers {
            assert!(seen.insert(p.id), "duplicate builtin provider id: {}", p.id);
            assert!(!p.id.is_empty(), "empty id is not allowed");
            assert!(
                p.id.chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
                "id must be ascii lowercase / digits / underscore: {}",
                p.id
            );
        }
    }

    #[test]
    fn builtin_providers_have_non_empty_display_names() {
        for p in get_builtin_providers() {
            assert!(!p.display_name.is_empty(), "empty name: {}", p.id);
            assert!(p.display_name.chars().count() >= 3);
        }
    }

    #[test]
    fn validate_directory_rejects_unc_backslash() {
        let result = validate_directory(r"\\server\share");
        assert!(result.is_err(), "UNC path must be rejected: {result:?}");
        let err = result.unwrap_err();
        assert!(
            err.contains("UNC") || err.contains("rede") || err.contains("rede (UNC)"),
            "error must mention UNC/network, got: {err}"
        );
    }

    #[test]
    fn validate_directory_rejects_unc_forward_slash() {
        let result = validate_directory("//server/share");
        assert!(result.is_err(), "UNC forward-slash path must be rejected");
    }

    #[test]
    fn validate_directory_rejects_unc_with_subpath() {
        let result = validate_directory(r"\\evil.local\C$\Windows\System32");
        assert!(result.is_err(), "UNC with subpath must be rejected");
    }

    #[test]
    fn validate_directory_accepts_local_existing_dir() {
        let tmp = std::env::temp_dir();
        let result = validate_directory(&tmp.to_string_lossy());
        assert!(result.is_ok(), "local temp dir should validate: {result:?}");
    }

    #[test]
    fn ollama_tool_definition_exists() {
        let tools = get_tool_definitions();
        assert!(
            tools.iter().any(|t| t.key == "ollama"),
            "Ollama deve constar em get_tool_definitions"
        );
    }
}
