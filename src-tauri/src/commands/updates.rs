use tauri::Emitter;

use crate::commands::cli::scan_cli_updates_blocking;
use crate::errors::AppError;
#[cfg(not(windows))]
use crate::util::find_terminal_emulator;
#[cfg(windows)]
use crate::util::find_windows_terminal;
use crate::util::{
    chrono_format_local_now, command_exists, compare_versions, detect_python, extract_version,
    fetch_github_latest, fetch_vscode_latest, find_tool_path, get_tool_definitions, http_agent,
    npm_latest, read_exe_product_version, run_silent, stream_install, CheckResult, UpdateInfo,
    UpdatesSummary, DEFAULT_INSTALL_TIMEOUT_SEC, OLLAMA_DOWNLOAD_URL,
};

/// Blocking scan of environment tool versions: up to 9 subprocess probes plus
/// npm registry requests. MUST run off the command thread — see
/// [`check_env_updates`].
fn scan_env_updates_blocking() -> Vec<UpdateInfo> {
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
pub async fn check_env_updates() -> Result<Vec<UpdateInfo>, AppError> {
    tokio::task::spawn_blocking(scan_env_updates_blocking)
        .await
        .map_err(|e| AppError::new(format!("background environment update scan failed: {e}")))
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
                v.as_deref()
                    .and_then(extract_version)
                    .or_else(|| path.as_deref().and_then(read_exe_product_version))
                    .or_else(|| Some("detectado".to_string()))
            } else if let Some(ref p) = path {
                read_exe_product_version(p).or_else(|| Some("detectado".to_string()))
            } else {
                Some("detectado".to_string())
            };
            let latest = match tool.key.as_str() {
                "vscode" => fetch_vscode_latest(),
                "cursor" => fetch_github_latest("getcursor/cursor"),
                "windsurf" => fetch_github_latest("codeium/windsurf"),
                "ollama" => fetch_github_latest("ollama/ollama"),
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
pub async fn check_all_updates(app: tauri::AppHandle) -> Result<UpdatesSummary, AppError> {
    let _ = app.emit("updates-progress", "start");

    let app_cli = app.clone();
    let app_env = app.clone();
    let app_tool = app.clone();
    let cli_task = tokio::task::spawn_blocking(move || {
        let r = scan_cli_updates_blocking();
        let _ = app_cli.emit("updates-progress", "clis-done");
        r
    });
    let env_task = tokio::task::spawn_blocking(move || {
        let r = scan_env_updates_blocking();
        let _ = app_env.emit("updates-progress", "env-done");
        r
    });
    let tool_task = tokio::task::spawn_blocking(move || {
        let r = check_tool_updates();
        let _ = app_tool.emit("updates-progress", "tools-done");
        r
    });

    let (cli_updates, env_updates, tool_updates) = tokio::try_join!(cli_task, env_task, tool_task)
        .map_err(|e| format!("Falha interna ao verificar updates: {}", e))?;

    let total = cli_updates.iter().filter(|u| u.has_update).count()
        + env_updates.iter().filter(|u| u.has_update).count()
        + tool_updates.iter().filter(|u| u.has_update).count();

    Ok(UpdatesSummary {
        cli_updates,
        env_updates,
        tool_updates,
        checked_at: chrono_format_local_now(),
        total_with_updates: total,
    })
}

#[tauri::command]
pub fn check_latest_release() -> Result<serde_json::Value, AppError> {
    let agent = http_agent();
    let url = "https://api.github.com/repos/HelbertMoura/ai_launcher/releases/latest";
    let resp = agent
        .get(url)
        .set(
            "User-Agent",
            &format!("ai-launcher/{}", env!("CARGO_PKG_VERSION")),
        )
        .call()
        .map_err(|e| format!("Falha na requisição: {e}"))?;
    let json: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
pub async fn check_environment() -> Vec<CheckResult> {
    let t_node = tokio::task::spawn_blocking(|| {
        let (npm_ok, npm_ver) = run_silent("npm", &["--version"]);
        let (_, node_ver) = run_silent("node", &["--version"]);
        CheckResult {
            key: "node".into(),
            name: "Node.js / npm".into(),
            installed: npm_ok,
            version: Some(format!(
                "Node {} / npm {}",
                node_ver.unwrap_or_else(|| "—".into()),
                npm_ver.unwrap_or_else(|| "—".into())
            )),
            install_command: Some("https://nodejs.org".into()),
        }
    });

    let t_py = tokio::task::spawn_blocking(|| {
        let (py_ok, py_ver) = detect_python();
        let (pip_ok, _) = run_silent("pip", &["--version"]);
        CheckResult {
            key: "python".into(),
            name: "Python / pip".into(),
            installed: py_ok || pip_ok,
            version: py_ver.map(|v| format!("Python {}", v)),
            install_command: Some("https://python.org".into()),
        }
    });

    let t_git = tokio::task::spawn_blocking(|| {
        let (git_ok, git_ver) = run_silent("git", &["--version"]);
        CheckResult {
            key: "git".into(),
            name: "Git".into(),
            installed: git_ok,
            version: git_ver,
            install_command: Some("https://git-scm.com".into()),
        }
    });

    let t_rust = tokio::task::spawn_blocking(|| {
        let (rust_ok, rust_ver) = run_silent("rustc", &["--version"]);
        CheckResult {
            key: "rust".into(),
            name: "Rust".into(),
            installed: rust_ok,
            version: rust_ver,
            install_command: Some("https://rustup.rs".into()),
        }
    });

    let t_cargo = tokio::task::spawn_blocking(|| {
        let (cargo_ok, cargo_ver) = run_silent("cargo", &["--version"]);
        if cargo_ok {
            Some(CheckResult {
                key: "cargo".into(),
                name: "Cargo".into(),
                installed: true,
                version: cargo_ver,
                install_command: Some("Instalado com Rust".into()),
            })
        } else {
            None
        }
    });

    let t_pnpm = tokio::task::spawn_blocking(|| {
        let (pnpm_ok, pnpm_ver) = run_silent("pnpm", &["--version"]);
        CheckResult {
            key: "pnpm".into(),
            name: "pnpm".into(),
            installed: pnpm_ok,
            version: pnpm_ver,
            install_command: Some("npm install -g pnpm".into()),
        }
    });

    let t_yarn = tokio::task::spawn_blocking(|| {
        let (yarn_ok, yarn_ver) = run_silent("yarn", &["--version"]);
        CheckResult {
            key: "yarn".into(),
            name: "yarn".into(),
            installed: yarn_ok,
            version: yarn_ver,
            install_command: Some("npm install -g yarn".into()),
        }
    });

    let t_bun = tokio::task::spawn_blocking(|| {
        let (bun_ok, bun_ver) = run_silent("bun", &["--version"]);
        CheckResult {
            key: "bun".into(),
            name: "Bun".into(),
            installed: bun_ok,
            version: bun_ver,
            install_command: Some("https://bun.sh".into()),
        }
    });

    // Terminal check: Windows Terminal on Windows; on macOS/Linux the
    // platform terminal emulator (Terminal.app is always present on macOS).
    let t_wt = tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            let wt_found = find_windows_terminal().is_some();
            CheckResult {
                key: "windows-terminal".into(),
                name: "Windows Terminal".into(),
                installed: wt_found,
                version: if wt_found {
                    Some("Disponível".into())
                } else {
                    None
                },
                install_command: Some("Microsoft Store → Windows Terminal".into()),
            }
        }
        #[cfg(not(windows))]
        {
            let term_found = find_terminal_emulator().is_some();
            CheckResult {
                key: "terminal".into(),
                name: "Terminal emulator".into(),
                installed: term_found,
                version: if term_found {
                    Some("Disponível".into())
                } else {
                    None
                },
                install_command: Some(
                    "Instale gnome-terminal, konsole, alacritty ou kitty (defina $TERMINAL \
                     para um emulador customizado)"
                        .into(),
                ),
            }
        }
    });

    let t_pwsh = tokio::task::spawn_blocking(|| {
        let (pwsh_ok, pwsh_ver) = run_silent("pwsh", &["--version"]);
        CheckResult {
            key: "powershell".into(),
            name: "PowerShell 7+".into(),
            installed: pwsh_ok,
            version: pwsh_ver,
            install_command: Some("https://github.com/PowerShell/PowerShell".into()),
        }
    });

    let t_gitlfs = tokio::task::spawn_blocking(|| {
        let (gitlfs_ok, gitlfs_ver) = run_silent("git", &["lfs", "version"]);
        CheckResult {
            key: "git-lfs".into(),
            name: "Git LFS".into(),
            installed: gitlfs_ok,
            version: gitlfs_ver,
            install_command: Some("https://git-lfs.github.com".into()),
        }
    });

    let t_docker = tokio::task::spawn_blocking(|| {
        let (docker_ok, docker_ver) = run_silent("docker", &["--version"]);
        CheckResult {
            key: "docker".into(),
            name: "Docker".into(),
            installed: docker_ok,
            version: docker_ver,
            install_command: Some("https://docker.com".into()),
        }
    });

    let t_vscode = tokio::task::spawn_blocking(|| {
        let (vscode_ok, vscode_ver) = run_silent("code", &["--version"]);
        CheckResult {
            key: "vscode".into(),
            name: "VS Code".into(),
            installed: vscode_ok,
            version: vscode_ver.map(|v| v.lines().next().unwrap_or("").to_string()),
            install_command: Some("https://code.visualstudio.com".into()),
        }
    });

    let t_tauri = tokio::task::spawn_blocking(|| {
        let (tauri_ok, _) = run_silent("npm", &["list", "-g", "@tauri-apps/cli", "--depth=0"]);
        let (_, tauri_ver) = run_silent("tauri", &["--version"]);
        CheckResult {
            key: "tauri-cli".into(),
            name: "Tauri CLI".into(),
            installed: tauri_ok,
            version: tauri_ver,
            install_command: Some("npm install -g @tauri-apps/cli".into()),
        }
    });

    let t_ollama = tokio::task::spawn_blocking(|| {
        let (ollama_ok, ollama_ver) = run_silent("ollama", &["--version"]);
        CheckResult {
            key: "ollama".into(),
            name: "Ollama (Local LLM)".into(),
            installed: ollama_ok,
            version: ollama_ver,
            install_command: Some(OLLAMA_DOWNLOAD_URL.into()),
        }
    });

    let (
        r_node,
        r_py,
        r_git,
        r_rust,
        r_cargo,
        r_pnpm,
        r_yarn,
        r_bun,
        r_wt,
        r_pwsh,
        r_gitlfs,
        r_docker,
        r_vscode,
        r_tauri,
        r_ollama,
    ) = tokio::join!(
        t_node, t_py, t_git, t_rust, t_cargo, t_pnpm, t_yarn, t_bun, t_wt, t_pwsh, t_gitlfs,
        t_docker, t_vscode, t_tauri, t_ollama
    );

    let mut results = vec![];
    if let Ok(r) = r_node {
        results.push(r);
    }
    if let Ok(r) = r_py {
        results.push(r);
    }
    if let Ok(r) = r_git {
        results.push(r);
    }
    if let Ok(r) = r_rust {
        results.push(r);
    }
    if let Ok(Some(r)) = r_cargo {
        results.push(r);
    }
    if let Ok(r) = r_pnpm {
        results.push(r);
    }
    if let Ok(r) = r_yarn {
        results.push(r);
    }
    if let Ok(r) = r_bun {
        results.push(r);
    }
    if let Ok(r) = r_wt {
        results.push(r);
    }
    if let Ok(r) = r_pwsh {
        results.push(r);
    }
    if let Ok(r) = r_gitlfs {
        results.push(r);
    }
    if let Ok(r) = r_docker {
        results.push(r);
    }
    if let Ok(r) = r_vscode {
        results.push(r);
    }
    if let Ok(r) = r_tauri {
        results.push(r);
    }
    if let Ok(r) = r_ollama {
        results.push(r);
    }

    results
}

#[tauri::command]
pub async fn install_prerequisite(app: tauri::AppHandle, key: String) -> Result<String, AppError> {
    let url_for = |u: &str| -> Result<String, AppError> {
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
        "ollama" => url_for(OLLAMA_DOWNLOAD_URL),
        "windows-terminal" | "wt" => {
            open::that("ms-windows-store://pdp/?productid=9N0DX20HK701")
                .or_else(|_| open::that("https://aka.ms/terminal"))
                .map_err(|e| e.to_string())?;
            Ok("Abrindo Microsoft Store".into())
        }
        #[cfg(not(windows))]
        "terminal" => Err(
            "Instale um emulador de terminal pelo gerenciador de pacotes do seu \
             sistema (gnome-terminal, konsole, alacritty ou kitty)."
                .into(),
        ),
        "vscode" => url_for("https://code.visualstudio.com/Download"),
        "git-lfs" => url_for("https://git-lfs.com/"),
        "powershell" => url_for("https://github.com/PowerShell/PowerShell/releases/latest"),
        "pnpm" => stream_install(
            app,
            "pnpm".into(),
            "npm".into(),
            vec!["install".into(), "-g".into(), "pnpm".into()],
            DEFAULT_INSTALL_TIMEOUT_SEC,
        )
        .await
        .map_err(AppError::from),
        "yarn" => stream_install(
            app,
            "yarn".into(),
            "npm".into(),
            vec!["install".into(), "-g".into(), "yarn".into()],
            DEFAULT_INSTALL_TIMEOUT_SEC,
        )
        .await
        .map_err(AppError::from),
        "tauri" | "tauri-cli" => stream_install(
            app,
            "tauri-cli".into(),
            "npm".into(),
            vec!["install".into(), "-g".into(), "@tauri-apps/cli".into()],
            DEFAULT_INSTALL_TIMEOUT_SEC,
        )
        .await
        .map_err(AppError::from),
        "cargo" => {
            open::that("https://rustup.rs/").map_err(|e| e.to_string())?;
            Ok("Abrindo rustup.rs (Cargo vem com Rust)".into())
        }
        _ => Err(format!("Pré-requisito desconhecido: {}", key).into()),
    }
}

#[tauri::command]
pub async fn update_prerequisite(app: tauri::AppHandle, key: String) -> Result<String, AppError> {
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
            DEFAULT_INSTALL_TIMEOUT_SEC,
        )
        .await
        .map_err(AppError::from);
    }
    let browser_urls: &[(&str, &str)] = &[
        ("node", "https://nodejs.org/"),
        ("git", "https://git-scm.com/downloads"),
        ("python", "https://www.python.org/downloads/"),
        ("rust", "https://rustup.rs/"),
        ("bun", "https://bun.sh"),
        ("docker", "https://www.docker.com/products/docker-desktop/"),
        ("ollama", OLLAMA_DOWNLOAD_URL),
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
