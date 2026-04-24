use serde::Serialize;
use std::path::PathBuf;

use crate::util::crash_dir;

// The entire usage aggregator stays here — it's only called from read_usage_stats.

#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageEntry {
    pub cli: String,
    pub date: String,
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub cost_estimate_usd: f64,
    pub model: Option<String>,
    pub project: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageReport {
    pub entries: Vec<UsageEntry>,
    pub total_tokens_in: u64,
    pub total_tokens_out: u64,
    pub total_cost_usd: f64,
    pub by_cli: std::collections::BTreeMap<String, CliUsageSummary>,
    pub top_projects: Vec<ProjectUsage>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CliUsageSummary {
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub cost_usd: f64,
    pub entries: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProjectUsage {
    pub project: String,
    pub cost_usd: f64,
    pub tokens: u64,
}

fn price_per_mtoken(cli: &str, model: Option<&str>) -> (f64, f64) {
    match (cli, model.unwrap_or("")) {
        ("claude", m) if m.contains("opus") => (15.0, 75.0),
        ("claude", m) if m.contains("sonnet") => (3.0, 15.0),
        ("claude", m) if m.contains("haiku") => (0.80, 4.0),
        ("claude", _) => (3.0, 15.0),
        ("codex", _) => (2.5, 10.0),
        ("gemini", m) if m.contains("pro") => (1.25, 5.0),
        ("gemini", _) => (0.075, 0.30),
        _ => (1.0, 4.0),
    }
}

fn read_claude_usage(entries: &mut Vec<UsageEntry>, warnings: &mut Vec<String>) {
    let path = match dirs::home_dir() {
        Some(h) => h.join(".claude").join("usage.jsonl"),
        None => {
            warnings.push("HOME dir desconhecido".to_string());
            return;
        }
    };
    if !path.exists() {
        return;
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            warnings.push(format!("claude usage.jsonl: {}", e));
            return;
        }
    };
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let tokens_in = v.get("input_tokens").and_then(|x| x.as_u64()).unwrap_or(0);
        let tokens_out = v.get("output_tokens").and_then(|x| x.as_u64()).unwrap_or(0);
        if tokens_in == 0 && tokens_out == 0 {
            continue;
        }
        let model = v.get("model").and_then(|x| x.as_str()).map(String::from);
        let ts = v.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");
        let date = ts.get(..10).unwrap_or("").to_string();
        let cwd = v.get("cwd").and_then(|x| x.as_str()).map(String::from);
        let (pin, pout) = price_per_mtoken("claude", model.as_deref());
        let cost =
            (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;
        entries.push(UsageEntry {
            cli: "claude".to_string(),
            date,
            tokens_in,
            tokens_out,
            cost_estimate_usd: cost,
            model,
            project: cwd,
        });
    }
}

fn read_codex_usage(entries: &mut Vec<UsageEntry>, warnings: &mut Vec<String>) {
    let path = match dirs::home_dir() {
        Some(h) => h.join(".codex").join("usage.jsonl"),
        None => return,
    };
    if !path.exists() {
        return;
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            warnings.push(format!("codex usage.jsonl: {}", e));
            return;
        }
    };
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let tokens_in = v
            .get("prompt_tokens")
            .or_else(|| v.get("input_tokens"))
            .and_then(|x| x.as_u64())
            .unwrap_or(0);
        let tokens_out = v
            .get("completion_tokens")
            .or_else(|| v.get("output_tokens"))
            .and_then(|x| x.as_u64())
            .unwrap_or(0);
        if tokens_in == 0 && tokens_out == 0 {
            continue;
        }
        let model = v.get("model").and_then(|x| x.as_str()).map(String::from);
        let ts = v
            .get("timestamp")
            .or_else(|| v.get("date"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let date = ts.get(..10).unwrap_or("").to_string();
        let cwd = v.get("cwd").and_then(|x| x.as_str()).map(String::from);
        let (pin, pout) = price_per_mtoken("codex", model.as_deref());
        let cost =
            (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;
        entries.push(UsageEntry {
            cli: "codex".to_string(),
            date,
            tokens_in,
            tokens_out,
            cost_estimate_usd: cost,
            model,
            project: cwd,
        });
    }
}

fn read_gemini_usage(entries: &mut Vec<UsageEntry>, warnings: &mut Vec<String>) {
    let base = match dirs::home_dir() {
        Some(h) => h.join(".gemini").join("telemetry"),
        None => return,
    };
    if !base.exists() {
        return;
    }
    let read_dir = match std::fs::read_dir(&base) {
        Ok(rd) => rd,
        Err(e) => {
            warnings.push(format!("gemini telemetry: {}", e));
            return;
        }
    };
    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let v: serde_json::Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let tokens_in = v
                .get("input_tokens")
                .or_else(|| v.get("prompt_token_count"))
                .and_then(|x| x.as_u64())
                .unwrap_or(0);
            let tokens_out = v
                .get("output_tokens")
                .or_else(|| v.get("candidates_token_count"))
                .and_then(|x| x.as_u64())
                .unwrap_or(0);
            if tokens_in == 0 && tokens_out == 0 {
                continue;
            }
            let model = v.get("model").and_then(|x| x.as_str()).map(String::from);
            let ts = v.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");
            let date = ts.get(..10).unwrap_or("").to_string();
            let cwd = v.get("cwd").and_then(|x| x.as_str()).map(String::from);
            let (pin, pout) = price_per_mtoken("gemini", model.as_deref());
            let cost =
                (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;
            entries.push(UsageEntry {
                cli: "gemini".to_string(),
                date,
                tokens_in,
                tokens_out,
                cost_estimate_usd: cost,
                model,
                project: cwd,
            });
        }
    }
}

#[tauri::command]
pub fn read_usage_stats() -> Result<UsageReport, String> {
    let mut entries: Vec<UsageEntry> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    read_claude_usage(&mut entries, &mut warnings);
    read_codex_usage(&mut entries, &mut warnings);
    read_gemini_usage(&mut entries, &mut warnings);

    let mut total_in: u64 = 0;
    let mut total_out: u64 = 0;
    let mut total_cost: f64 = 0.0;
    let mut by_cli: std::collections::BTreeMap<String, CliUsageSummary> =
        std::collections::BTreeMap::new();
    let mut project_agg: std::collections::HashMap<String, (f64, u64)> =
        std::collections::HashMap::new();

    for e in &entries {
        total_in += e.tokens_in;
        total_out += e.tokens_out;
        total_cost += e.cost_estimate_usd;
        let s = by_cli.entry(e.cli.clone()).or_insert(CliUsageSummary {
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0.0,
            entries: 0,
        });
        s.tokens_in += e.tokens_in;
        s.tokens_out += e.tokens_out;
        s.cost_usd += e.cost_estimate_usd;
        s.entries += 1;
        if let Some(p) = &e.project {
            if !p.is_empty() {
                let v = project_agg.entry(p.clone()).or_insert((0.0, 0));
                v.0 += e.cost_estimate_usd;
                v.1 += e.tokens_in + e.tokens_out;
            }
        }
    }
    let mut top_projects: Vec<ProjectUsage> = project_agg
        .into_iter()
        .map(|(project, (cost, tokens))| ProjectUsage {
            project,
            cost_usd: cost,
            tokens,
        })
        .collect();
    top_projects.sort_by(|a, b| {
        b.cost_usd
            .partial_cmp(&a.cost_usd)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    top_projects.truncate(5);

    Ok(UsageReport {
        entries,
        total_tokens_in: total_in,
        total_tokens_out: total_out,
        total_cost_usd: total_cost,
        by_cli,
        top_projects,
        warnings,
    })
}

// ============================================================
// RESET / PROVIDER TEST / CRASH
// ============================================================

#[tauri::command]
pub fn reset_all_config() -> Result<String, String> {
    if let Some(dir) = dirs::config_dir() {
        let log_path = dir.join("ai-launcher").join("install.log");
        if log_path.exists() {
            let _ = std::fs::remove_file(&log_path);
        }
    }
    Ok("Configurações resetadas".into())
}

#[tauri::command]
pub fn reset_claude_state() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("HOME não encontrado")?;
    let path = home.join(".claude.json");
    if !path.exists() {
        return Ok("Nada a limpar — ~/.claude.json não existe.".to_string());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Falha ao ler {}: {}", path.display(), e))?;
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("JSON inválido em {}: {}", path.display(), e))?;

    let mut removed = Vec::new();
    if let Some(obj) = json.as_object_mut() {
        for key in ["customApiKeyResponses", "oauthAccount", "model"] {
            if obj.remove(key).is_some() {
                removed.push(key.to_string());
            }
        }
    }

    let backup = path.with_extension("json.bak");
    let _ = std::fs::copy(&path, &backup);

    let serialized =
        serde_json::to_string_pretty(&json).map_err(|e| format!("Falha ao serializar: {}", e))?;
    std::fs::write(&path, serialized)
        .map_err(|e| format!("Falha ao escrever {}: {}", path.display(), e))?;

    if removed.is_empty() {
        Ok("Nada a limpar — nenhum campo conflitante encontrado.".to_string())
    } else {
        Ok(format!(
            "Limpou: {}. Backup em {}.",
            removed.join(", "),
            backup.display()
        ))
    }
}

#[derive(Serialize)]
pub struct ProviderTestResult {
    ok: bool,
    #[serde(rename = "statusCode")]
    status_code: Option<u16>,
    #[serde(rename = "latencyMs")]
    latency_ms: u64,
    #[serde(rename = "modelEcho")]
    model_echo: Option<String>,
    message: String,
}

#[tauri::command]
pub fn test_provider_connection(
    base_url: String,
    api_key: String,
    model: String,
    protocol: Option<String>,
) -> Result<ProviderTestResult, String> {
    if base_url.trim().is_empty() {
        return Ok(ProviderTestResult {
            ok: false,
            status_code: None,
            latency_ms: 0,
            model_echo: None,
            message: "Sem baseUrl — perfil oficial depende da config local do Claude Code."
                .to_string(),
        });
    }
    if api_key.trim().is_empty() {
        return Ok(ProviderTestResult {
            ok: false,
            status_code: None,
            latency_ms: 0,
            model_echo: None,
            message: "Sem apiKey — preencha antes de testar.".to_string(),
        });
    }
    let proto = protocol.as_deref().unwrap_or("anthropic_messages");
    let (url, body, auth_style) = match proto {
        "openai_chat" => {
            let u = format!("{}/chat/completions", base_url.trim_end_matches('/'));
            let b = serde_json::json!({
                "model": model,
                "max_tokens": 1,
                "messages": [{ "role": "user", "content": "ping" }],
            });
            (u, b, "bearer")
        }
        "openai_responses" => {
            let u = format!("{}/responses", base_url.trim_end_matches('/'));
            let b = serde_json::json!({
                "model": model,
                "input": "ping",
                "max_output_tokens": 1,
            });
            (u, b, "bearer")
        }
        _ => {
            // anthropic_messages (default)
            let u = format!("{}/v1/messages", base_url.trim_end_matches('/'));
            let b = serde_json::json!({
                "model": model,
                "max_tokens": 1,
                "messages": [{ "role": "user", "content": "ping" }],
            });
            (u, b, "anthropic")
        }
    };

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent(concat!("ai-launcher-pro/", env!("CARGO_PKG_VERSION")))
        .build();

    let t0 = std::time::Instant::now();
    let mut req = agent
        .post(&url)
        .set("Content-Type", "application/json");
    if auth_style == "anthropic" {
        req = req
            .set("x-api-key", &api_key)
            .set("Authorization", &format!("Bearer {}", api_key))
            .set("anthropic-version", "2023-06-01");
    } else {
        // openai_chat / openai_responses — Bearer token only
        req = req.set("Authorization", &format!("Bearer {}", api_key));
    }
    let resp = req.send_json(body);
    let latency_ms = t0.elapsed().as_millis() as u64;

    match resp {
        Ok(r) => {
            let status = r.status();
            let text = r.into_string().unwrap_or_default();
            let model_echo = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|j| j.get("model").and_then(|m| m.as_str().map(String::from)));
            Ok(ProviderTestResult {
                ok: true,
                status_code: Some(status),
                latency_ms,
                message: format!(
                    "Conectou em {}ms{}",
                    latency_ms,
                    model_echo
                        .as_ref()
                        .map(|m| format!(" · modelo {}", m))
                        .unwrap_or_default()
                ),
                model_echo,
            })
        }
        Err(ureq::Error::Status(code, resp)) => {
            let text = resp.into_string().unwrap_or_default();
            let hint = match code {
                401 | 403 => "Authentication failed — invalid API key or no access to this model.",
                404 => match proto {
                    "openai_chat" => "Endpoint /chat/completions not found — verify baseUrl is the API root (e.g. https://openrouter.ai/api/v1).",
                    "openai_responses" => "Endpoint /responses not found — verify baseUrl and protocol.",
                    _ => "Endpoint /v1/messages not found — verify baseUrl.",
                },
                429 => "Rate-limited, but the endpoint is reachable.",
                _ => "Provider returned an error.",
            };
            let snippet = if text.is_empty() {
                String::new()
            } else {
                format!(" · {}", text.chars().take(160).collect::<String>())
            };
            Ok(ProviderTestResult {
                ok: false,
                status_code: Some(code),
                latency_ms,
                model_echo: None,
                message: format!("HTTP {} — {}{}", code, hint, snippet),
            })
        }
        Err(ureq::Error::Transport(t)) => Ok(ProviderTestResult {
            ok: false,
            status_code: None,
            latency_ms,
            model_echo: None,
            message: format!(
                "Falha de rede: {}. Verifique conexão, firewall ou baseUrl.",
                t
            ),
        }),
    }
}

#[tauri::command]
pub fn save_crash_log(stack: String, context: String) -> Result<String, String> {
    let dir = crash_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("falha ao criar diretório de crash: {e}"))?;
    let ts = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let safe_ctx: String = context
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let file = dir.join(format!("{}-{}.log", safe_ctx, ts));
    let payload = format!("context={}\ntimestamp={}\n\n{}\n", context, ts, stack);
    std::fs::write(&file, payload).map_err(|e| format!("falha ao escrever log: {e}"))?;
    Ok(file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_crash_log(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let canonical = p
        .canonicalize()
        .map_err(|e| format!("caminho inválido: {e}"))?;
    let base = crash_dir();
    let base_canonical = base
        .canonicalize()
        .map_err(|e| format!("diretório de crash inválido: {e}"))?;
    if !canonical.starts_with(&base_canonical) {
        return Err("caminho fora do diretório de crashes".to_string());
    }
    std::fs::read_to_string(&canonical).map_err(|e| format!("falha ao ler log: {e}"))
}
