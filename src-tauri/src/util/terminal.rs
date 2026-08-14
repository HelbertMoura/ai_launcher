use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;

use super::process::{command_exists, run_silent, CREATE_NO_WINDOW};

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

pub fn resolve_cli_path_win(cmd: &str, extra_paths: &[String]) -> Option<String> {
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

    for path in &where_results {
        if !path.to_lowercase().contains(r"\.local\bin\") {
            return Some(path.clone());
        }
    }
    if let Some(first) = where_results.first() {
        return Some(first.clone());
    }
    None
}

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
        _ => None,
    };
    if let Some(hint) = lnk_hint {
        if let Some(p) = find_exe_from_start_menu(hint) {
            return Some(p);
        }
    }
    None
}
