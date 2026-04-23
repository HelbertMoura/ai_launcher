use tauri::Emitter;

use crate::commands::cli::check_cli_updates;
use crate::util::{
    chrono_format_local_now, command_exists, compare_versions, detect_python, extract_version,
    fetch_github_latest, fetch_vscode_latest, find_tool_path, find_windows_terminal, get_tool_definitions,
    http_agent, npm_latest, run_silent, stream_install, CheckResult, UpdateInfo, UpdatesSummary,
};

#[tauri::command]
pub fn check_env_updates() -> Vec<UpdateInfo> {
    let items: Vec<(&str, &str, Option<&str>, &str)> = vec![
        ("Node.js", "node", None, "node"),
        ("npm", "npm", Some("npm"), "npm"),
        ("Git", "git", None, "git"),
        ("Python", "python", None, "python"),
        ("Rust", "rustc", None, "rust"),
        ("pnpm", "pnpm", Some("pnpm"), "pnpm"),
        ("yarn", "yarn", Some("yarn"), "yarn"),
        ("Bun", "bun", None, "bun"),
        ("Tauri CLI", "tauri", Some("@tauri-apps/cli"), "tauri"),
    ];
    items
        .into_iter()
        .filter(|(_, cmd, _, _)| command_exists(cmd))
        .map(|(name, cmd, pkg, key)| {
            let (_, current_raw) = run_silent(cmd, &["--version"]);
            let current = current_raw.as_ref().and_then(|v| extract_version(v));
            let latest = pkg.and_then(npm_latest);
            let has_update = match (&current, &latest) {
                (Some(c), Some(l)) => compare_versions(c, l),
                _ => false,
            };
            let no_api = latest.is_none();
            UpdateInfo {
                cli: name.to_string(),
                current,
                latest,
                has_update,
                method: if pkg.is_some() {
                    "npm".into()
                } else {
                    "browser".into()
                },
                no_api,
                key: Some(key.to_string()),
            }
        })
        .collect()
}

#[tauri::command]
pub fn check_tool_updates() -> Vec<UpdateInfo> {
    get_tool_definitions()
        .iter()
        .filter_map(|tool| {
            let cmd_in_path = command_exists(&tool.command);
            let path = find_tool_path(&tool.key);
            let has_binary = path.is_some();
            if !cmd_in_path && !has_binary {
                return None;
            }
            let current = if cmd_in_path {
                let (_, v) = run_silent(&tool.command, &["--version"]);
                v.and_then(|s| extract_version(&s))
                    .or_else(|| Some("detectado".to_string()))
            } else {
                Some("detectado".to_string())
            };
            let latest = match tool.key.as_str() {
                "vscode" => fetch_vscode_latest(),
                "cursor" => fetch_github_latest("getcursor/cursor"),
                "windsurf" => fetch_github_latest("codeium/windsurf"),
                _ => None,
            };
            let has_update = match (&current, &latest) {
                (Some(c), Some(l)) if c != "detectado" => compare_versions(c, l),
                _ => false,
            };
            let no_api = latest.is_none();
            Some(UpdateInfo {
                cli: tool.name.clone(),
                current,
                latest,
                has_update,
                method: "browser".into(),
                no_api,
                key: Some(tool.key.clone()),
            })
        })
        .collect()
}

#[tauri::command]
pub async fn check_all_updates(app: tauri::AppHandle) -> Result<UpdatesSummary, String> {
    let _ = app.emit("updates-progress", "start");

    let app_cli = app.clone();
    let app_env = app.clone();
    let app_tool = app.clone();
    let cli_task = tokio::task::spawn_blocking(move || {
        let r = check_cli_updates();
        let _ = app_cli.emit("updates-progress", "clis-done");
        r
    });
    let env_task = tokio::task::spawn_blocking(move || {
        let r = check_env_updates();
        let _ = app_env.emit("updates-progress", "env-done");
        r
    });
    let tool_task = tokio::task::spawn_blocking(move || {
        let r = check_tool_updates();
        let _ = app_tool.emit("updates-progress", "tools-done");
        r
    });

    let (cli_updates, env_updates, tool_updates) =
        tokio::try_join!(cli_task, env_task, tool_task)
            .map_err(|e| format!("Falha interna ao verificar updates: {}", e))?;

    let total = cli_updates.iter().filter(|u| u.has_update).count()
        + env_updates.iter().filter(|u| u.has_update).count();

    Ok(UpdatesSummary {
        cli_updates,
        env_updates,
        tool_updates,
        checked_at: chrono_format_local_now(),
        total_with_updates: total,
    })
}

#[tauri::command]
pub fn check_latest_release() -> Result<serde_json::Value, String> {
    let agent = http_agent();
    let url = "https://api.github.com/repos/HelbertMoura/ai_launcher/releases/latest";
    let resp = agent
        .get(url)
        .set(
            "User-Agent",
            &format!("ai-launcher/{}", env!("CARGO_PKG_VERSION")),
        )
        .call()
        .map_err(|e| format!("fetch error: {e}"))?;
    let json: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
pub fn check_environment() -> Vec<CheckResult> {
    let mut results = vec![];

    let (npm_ok, npm_ver) = run_silent("npm", &["--version"]);
    let (_, node_ver) = run_silent("node", &["--version"]);
    results.push(CheckResult {
        name: "Node.js / npm".into(),
        installed: npm_ok,
        version: Some(format!(
            "Node {} / npm {}",
            node_ver.unwrap_or_else(|| "—".into()),
            npm_ver.unwrap_or_else(|| "—".into())
        )),
        install_command: Some("https://nodejs.org".into()),
    });

    let (py_ok, py_ver) = detect_python();
    let (pip_ok, _) = run_silent("pip", &["--version"]);
    results.push(CheckResult {
        name: "Python / pip".into(),
        installed: py_ok || pip_ok,
        version: py_ver.map(|v| format!("Python {}", v)),
        install_command: Some("https://python.org".into()),
    });

    let (git_ok, git_ver) = run_silent("git", &["--version"]);
    results.push(CheckResult {
        name: "Git".into(),
        installed: git_ok,
        version: git_ver,
        install_command: Some("https://git-scm.com".into()),
    });

    let (rust_ok, rust_ver) = run_silent("rustc", &["--version"]);
    results.push(CheckResult {
        name: "Rust".into(),
        installed: rust_ok,
        version: rust_ver,
        install_command: Some("https://rustup.rs".into()),
    });

    let (cargo_ok, cargo_ver) = run_silent("cargo", &["--version"]);
    if cargo_ok {
        results.push(CheckResult {
            name: "Cargo".into(),
            installed: true,
            version: cargo_ver,
            install_command: Some("Instalado com Rust".into()),
        });
    }

    let (pnpm_ok, pnpm_ver) = run_silent("pnpm", &["--version"]);
    results.push(CheckResult {
        name: "pnpm".into(),
        installed: pnpm_ok,
        version: pnpm_ver,
        install_command: Some("npm install -g pnpm".into()),
    });

    let (yarn_ok, yarn_ver) = run_silent("yarn", &["--version"]);
    results.push(CheckResult {
        name: "yarn".into(),
        installed: yarn_ok,
        version: yarn_ver,
        install_command: Some("npm install -g yarn".into()),
    });

    let (bun_ok, bun_ver) = run_silent("bun", &["--version"]);
    results.push(CheckResult {
        name: "Bun".into(),
        installed: bun_ok,
        version: bun_ver,
        install_command: Some("https://bun.sh".into()),
    });

    let wt_found = find_windows_terminal().is_some();
    results.push(CheckResult {
        name: "Windows Terminal".into(),
        installed: wt_found,
        version: if wt_found {
            Some("Disponível".into())
        } else {
            None
        },
        install_command: Some("Microsoft Store → Windows Terminal".into()),
    });

    let (pwsh_ok, pwsh_ver) = run_silent("pwsh", &["--version"]);
    results.push(CheckResult {
        name: "PowerShell 7+".into(),
        installed: pwsh_ok,
        version: pwsh_ver,
        install_command: Some("https://github.com/PowerShell/PowerShell".into()),
    });

    let (gitlfs_ok, gitlfs_ver) = run_silent("git", &["lfs", "version"]);
    results.push(CheckResult {
        name: "Git LFS".into(),
        installed: gitlfs_ok,
        version: gitlfs_ver,
        install_command: Some("https://git-lfs.github.com".into()),
    });

    let (docker_ok, docker_ver) = run_silent("docker", &["--version"]);
    results.push(CheckResult {
        name: "Docker".into(),
        installed: docker_ok,
        version: docker_ver,
        install_command: Some("https://docker.com".into()),
    });

    let (vscode_ok, vscode_ver) = run_silent("code", &["--version"]);
    results.push(CheckResult {
        name: "VS Code".into(),
        installed: vscode_ok,
        version: vscode_ver.map(|v| v.lines().next().unwrap_or("").to_string()),
        install_command: Some("https://code.visualstudio.com".into()),
    });

    let (tauri_ok, _) = run_silent("npm", &["list", "-g", "@tauri-apps/cli", "--depth=0"]);
    let (_, tauri_ver) = run_silent("tauri", &["--version"]);
    results.push(CheckResult {
        name: "Tauri CLI".into(),
        installed: tauri_ok,
        version: tauri_ver,
        install_command: Some("npm install -g @tauri-apps/cli".into()),
    });

    results
}

#[tauri::command]
pub async fn install_prerequisite(
    app: tauri::AppHandle,
    key: String,
) -> Result<String, String> {
    let url_for = |u: &str| -> Result<String, String> {
        open::that(u).map_err(|e| e.to_string())?;
        Ok(format!("Abrindo {}", u))
    };

    match key.as_str() {
        "node" => url_for("https://nodejs.org/"),
        "git" => url_for("https://git-scm.com/downloads"),
        "python" => url_for("https://www.python.org/downloads/"),
        "rust" => url_for("https://rustup.rs/"),
        "bun" => url_for("https://bun.sh"),
        "docker" => url_for("https://www.docker.com/products/docker-desktop/"),
        "windows-terminal" | "wt" => {
            open::that("ms-windows-store://pdp/?productid=9N0DX20HK701")
                .or_else(|_| open::that("https://aka.ms/terminal"))
                .map_err(|e| e.to_string())?;
            Ok("Abrindo Microsoft Store".into())
        }
        "vscode" => url_for("https://code.visualstudio.com/Download"),
        "git-lfs" => url_for("https://git-lfs.com/"),
        "powershell" => url_for("https://github.com/PowerShell/PowerShell/releases/latest"),
        "pnpm" => {
            stream_install(
                app,
                "pnpm".into(),
                "npm".into(),
                vec!["install".into(), "-g".into(), "pnpm".into()],
            )
            .await
        }
        "yarn" => {
            stream_install(
                app,
                "yarn".into(),
                "npm".into(),
                vec!["install".into(), "-g".into(), "yarn".into()],
            )
            .await
        }
        "tauri" => {
            stream_install(
                app,
                "tauri".into(),
                "npm".into(),
                vec!["install".into(), "-g".into(), "@tauri-apps/cli".into()],
            )
            .await
        }
        _ => Err(format!("Pré-requisito desconhecido: {}", key)),
    }
}

#[tauri::command]
pub async fn update_prerequisite(
    app: tauri::AppHandle,
    key: String,
) -> Result<String, String> {
    let npm_map: &[(&str, &str)] = &[
        ("npm", "npm"),
        ("pnpm", "pnpm"),
        ("yarn", "yarn"),
        ("tauri", "@tauri-apps/cli"),
    ];
    if let Some((_, pkg)) = npm_map.iter().find(|(k, _)| *k == key.as_str()) {
        return stream_install(
            app,
            key.clone(),
            "npm".into(),
            vec!["install".into(), "-g".into(), format!("{}@latest", pkg)],
        )
        .await;
    }
    let browser_urls: &[(&str, &str)] = &[
        ("node", "https://nodejs.org/"),
        ("git", "https://git-scm.com/downloads"),
        ("python", "https://www.python.org/downloads/"),
        ("rust", "https://rustup.rs/"),
        ("bun", "https://bun.sh"),
        ("docker", "https://www.docker.com/products/docker-desktop/"),
        (
            "windows-terminal",
            "ms-windows-store://pdp/?productid=9N0DX20HK701",
        ),
        ("git-lfs", "https://git-lfs.com/"),
        (
            "powershell",
            "https://github.com/PowerShell/PowerShell/releases/latest",
        ),
        ("vscode", "https://code.visualstudio.com/Download"),
    ];
    if let Some((_, url)) = browser_urls.iter().find(|(k, _)| *k == key.as_str()) {
        open::that(*url).map_err(|e| e.to_string())?;
        return Ok(format!("Abrindo página de atualização ({})", url));
    }
    let _ = key;
    Err("Pré-requisito desconhecido".into())
}
