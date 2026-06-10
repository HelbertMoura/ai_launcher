use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use crate::util::crash_dir;

// The entire usage aggregator stays here — it's only called from read_usage_stats.
//
// Real on-disk formats (the legacy ~/.claude/usage.jsonl etc. never existed):
//   Claude — ~/.claude/projects/**/*.jsonl, one event per line. We care about
//            lines where top-level `type == "assistant"`. Token counts live in
//            `message.usage` (with a top-level `usage` fallback); model in
//            `message.model`; ISO timestamp in top-level `timestamp`. Entries are
//            AGGREGATED per (date, model) per file — never one entry per line.
//   Codex  — ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl. We care about lines
//            where the (possibly nested) type is `token_count`. Its
//            `total_token_usage` is CUMULATIVE, so only the LAST token_count of
//            each file is kept. Model comes from `turn_context`/`session_meta`
//            payloads; date from the rollout-YYYY-MM-DD file name (timestamp
//            fallback).
//   Gemini — removed entirely: the CLI was dropped in v15.2.0.

#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageEntry {
    pub cli: String,
    /// Logical provider behind the CLI ("anthropic" for Claude, "openai" for
    /// Codex). The frontend (T2) groups budgets by this and falls back to `cli`
    /// when absent. `#[serde(default)]` keeps the field optional on the wire.
    #[serde(default)]
    pub provider: Option<String>,
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

// ============================================================
// PRICING
// ============================================================
//
// TODO(v16): move this table to a remote, versioned price manifest (same
// mechanism as CLI update_manifest_url) so prices can be refreshed without a
// rebuild. Hardcoded for now; values are USD per 1M tokens (input, output).
fn price_per_mtoken(cli: &str, model: Option<&str>) -> (f64, f64) {
    match (cli, model.unwrap_or("")) {
        ("claude", m) if m.contains("opus") => (15.0, 75.0),
        ("claude", m) if m.contains("sonnet") => (3.0, 15.0),
        ("claude", m) if m.contains("haiku") => (0.80, 4.0),
        ("claude", _) => (3.0, 15.0),
        ("codex", _) => (2.5, 10.0),
        _ => (1.0, 4.0),
    }
}

fn provider_for_cli(cli: &str) -> Option<String> {
    match cli {
        "claude" => Some("anthropic".to_string()),
        "codex" => Some("openai".to_string()),
        _ => None,
    }
}

// ============================================================
// CACHE (keyed by path + mtime)
// ============================================================
//
// Parsing ~1000 Claude JSONL files on every Costs-tab open is wasteful, so each
// file's parsed entries are memoised under (path, mtime). A file is re-parsed
// only when its mtime changes. `force` clears the whole cache up front.
type CacheKey = (PathBuf, u64);
type UsageCache = HashMap<CacheKey, Vec<UsageEntry>>;

fn usage_cache() -> &'static Mutex<UsageCache> {
    static CACHE: OnceLock<Mutex<UsageCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn mtime_secs(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Parse `path` through the mtime cache. On a hit the cached entries are cloned;
/// on a miss `parse` runs and its result is stored. A poisoned mutex degrades
/// gracefully to an uncached parse rather than panicking.
fn cached_parse<F>(path: &Path, parse: F) -> Vec<UsageEntry>
where
    F: FnOnce(&Path) -> Vec<UsageEntry>,
{
    let key = (path.to_path_buf(), mtime_secs(path));
    if let Ok(cache) = usage_cache().lock() {
        if let Some(hit) = cache.get(&key) {
            return hit.clone();
        }
    }
    let parsed = parse(path);
    if let Ok(mut cache) = usage_cache().lock() {
        cache.insert(key, parsed.clone());
    }
    parsed
}

// ============================================================
// FILESYSTEM WALK (manual recursion — no walkdir dependency)
// ============================================================

/// Collect every `*.jsonl` file under `root`, recursing into subdirectories.
/// Symlinks/unreadable dirs are skipped silently rather than aborting the walk.
fn collect_jsonl(root: &Path, out: &mut Vec<PathBuf>) {
    let read_dir = match std::fs::read_dir(root) {
        Ok(rd) => rd,
        Err(_) => return,
    };
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl(&path, out);
        } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            out.push(path);
        }
    }
}

// ============================================================
// CLAUDE PARSER
// ============================================================

fn json_u64(v: &serde_json::Value, key: &str) -> u64 {
    v.get(key).and_then(|x| x.as_u64()).unwrap_or(0)
}

/// Parse a single Claude project JSONL file, aggregating tokens per (date,
/// model). The directory name holding the file is used as the project label.
fn parse_claude_file(path: &Path) -> Vec<UsageEntry> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let project = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .map(String::from);

    // (date, model) -> (tokens_in, tokens_out)
    let mut agg: HashMap<(String, Option<String>), (u64, u64)> = HashMap::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if v.get("type").and_then(|t| t.as_str()) != Some("assistant") {
            continue;
        }
        // usage lives in message.usage; tolerate a top-level usage fallback.
        let usage = v
            .get("message")
            .and_then(|m| m.get("usage"))
            .or_else(|| v.get("usage"));
        let usage = match usage {
            Some(u) => u,
            None => continue,
        };
        let tokens_in = json_u64(usage, "input_tokens")
            + json_u64(usage, "cache_creation_input_tokens")
            + json_u64(usage, "cache_read_input_tokens");
        let tokens_out = json_u64(usage, "output_tokens");
        if tokens_in == 0 && tokens_out == 0 {
            continue;
        }
        let model = v
            .get("message")
            .and_then(|m| m.get("model"))
            .or_else(|| v.get("model"))
            .and_then(|x| x.as_str())
            .map(String::from);
        let ts = v.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");
        let date = ts.get(..10).unwrap_or("").to_string();

        let slot = agg.entry((date, model)).or_insert((0, 0));
        slot.0 += tokens_in;
        slot.1 += tokens_out;
    }

    agg.into_iter()
        .map(|((date, model), (tokens_in, tokens_out))| {
            let (pin, pout) = price_per_mtoken("claude", model.as_deref());
            let cost =
                (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;
            UsageEntry {
                cli: "claude".to_string(),
                provider: provider_for_cli("claude"),
                date,
                tokens_in,
                tokens_out,
                cost_estimate_usd: cost,
                model,
                project: project.clone(),
            }
        })
        .collect()
}

fn read_claude_usage(entries: &mut Vec<UsageEntry>, warnings: &mut Vec<String>) {
    let root = match dirs::home_dir() {
        Some(h) => h.join(".claude").join("projects"),
        None => {
            warnings.push("HOME dir desconhecido".to_string());
            return;
        }
    };
    if !root.exists() {
        return;
    }
    let mut files = Vec::new();
    collect_jsonl(&root, &mut files);
    for file in &files {
        entries.extend(cached_parse(file, parse_claude_file));
    }
}

// ============================================================
// CODEX PARSER
// ============================================================

/// Locate `total_token_usage` for a Codex `token_count` value, tolerating the
/// nesting variations seen in the wild: `payload.info.total_token_usage`,
/// `payload.total_token_usage`, or top-level `total_token_usage`.
fn codex_total_usage(v: &serde_json::Value) -> Option<&serde_json::Value> {
    v.pointer("/payload/info/total_token_usage")
        .or_else(|| v.pointer("/payload/total_token_usage"))
        .or_else(|| v.get("total_token_usage"))
}

/// Extract the (possibly nested) event type for a Codex rollout line.
fn codex_line_type(v: &serde_json::Value) -> Option<&str> {
    v.pointer("/payload/type")
        .or_else(|| v.get("type"))
        .and_then(|t| t.as_str())
}

/// Parse a single Codex rollout file. `total_token_usage` is cumulative, so only
/// the LAST `token_count` line is kept. Model/cwd come from the most recent
/// turn_context/session_meta payload; date from the `rollout-YYYY-MM-DD` file
/// name with a timestamp fallback.
fn parse_codex_file(path: &Path) -> Vec<UsageEntry> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let date_from_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .and_then(|n| n.strip_prefix("rollout-"))
        .and_then(|rest| rest.get(..10))
        .filter(|d| d.len() == 10 && d.as_bytes()[4] == b'-')
        .map(String::from);

    let mut model: Option<String> = None;
    let mut cwd: Option<String> = None;
    let mut last_usage: Option<serde_json::Value> = None;
    let mut last_ts: Option<String> = None;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        // Track latest model / cwd from any payload that carries them.
        if let Some(m) = v
            .pointer("/payload/model")
            .or_else(|| v.get("model"))
            .and_then(|x| x.as_str())
        {
            model = Some(m.to_string());
        }
        if let Some(c) = v
            .pointer("/payload/cwd")
            .or_else(|| v.get("cwd"))
            .and_then(|x| x.as_str())
        {
            cwd = Some(c.to_string());
        }
        if codex_line_type(&v) == Some("token_count") {
            if let Some(usage) = codex_total_usage(&v) {
                last_usage = Some(usage.clone());
                last_ts = v
                    .get("timestamp")
                    .and_then(|x| x.as_str())
                    .map(String::from);
            }
        }
    }

    let usage = match last_usage {
        Some(u) => u,
        None => return Vec::new(),
    };
    // total = input + cached + output + reasoning; the cached/reasoning fields
    // may be absent on older rollouts, so each defaults to 0.
    let tokens_in = json_u64(&usage, "input_tokens") + json_u64(&usage, "cached_input_tokens");
    let tokens_out =
        json_u64(&usage, "output_tokens") + json_u64(&usage, "reasoning_output_tokens");
    if tokens_in == 0 && tokens_out == 0 {
        return Vec::new();
    }

    let date = date_from_name
        .or_else(|| {
            last_ts
                .as_deref()
                .and_then(|t| t.get(..10))
                .map(String::from)
        })
        .unwrap_or_default();
    let (pin, pout) = price_per_mtoken("codex", model.as_deref());
    let cost = (tokens_in as f64) * pin / 1_000_000.0 + (tokens_out as f64) * pout / 1_000_000.0;

    vec![UsageEntry {
        cli: "codex".to_string(),
        provider: provider_for_cli("codex"),
        date,
        tokens_in,
        tokens_out,
        cost_estimate_usd: cost,
        model,
        project: cwd,
    }]
}

fn read_codex_usage(entries: &mut Vec<UsageEntry>, _warnings: &mut [String]) {
    let root = match dirs::home_dir() {
        Some(h) => h.join(".codex").join("sessions"),
        None => return,
    };
    if !root.exists() {
        return;
    }
    let mut files = Vec::new();
    collect_jsonl(&root, &mut files);
    for file in &files {
        entries.extend(cached_parse(file, parse_codex_file));
    }
}

// ============================================================
// AGGREGATION
// ============================================================

#[tauri::command]
pub fn read_usage_stats(force: Option<bool>) -> Result<UsageReport, String> {
    if force.unwrap_or(false) {
        if let Ok(mut cache) = usage_cache().lock() {
            cache.clear();
        }
    }

    let mut entries: Vec<UsageEntry> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    read_claude_usage(&mut entries, &mut warnings);
    read_codex_usage(&mut entries, &mut warnings);

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
// TESTS
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Write `content` to a uniquely-named JSONL file under the OS temp dir and
    /// return its path. Caller deletes it.
    fn temp_jsonl(name: &str, content: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        let unique = format!(
            "ai_launcher_test_{}_{}_{}.jsonl",
            name,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        path.push(unique);
        let mut f = std::fs::File::create(&path).expect("create temp file");
        f.write_all(content.as_bytes()).expect("write temp file");
        path
    }

    #[test]
    fn claude_parses_assistant_line_and_sums_cache_tokens() {
        // input(6) + cache_creation(78556) + cache_read(10) = 78572 in; 99 out.
        let line = r#"{"type":"assistant","timestamp":"2026-05-19T20:47:30.116Z","message":{"model":"claude-opus-4-7","role":"assistant","usage":{"input_tokens":6,"cache_creation_input_tokens":78556,"cache_read_input_tokens":10,"output_tokens":99}}}"#;
        let path = temp_jsonl("claude_one", line);
        let entries = parse_claude_file(&path);
        let _ = std::fs::remove_file(&path);

        assert_eq!(entries.len(), 1, "one (date,model) bucket expected");
        let e = &entries[0];
        assert_eq!(e.cli, "claude");
        assert_eq!(e.provider.as_deref(), Some("anthropic"));
        assert_eq!(e.date, "2026-05-19");
        assert_eq!(e.model.as_deref(), Some("claude-opus-4-7"));
        assert_eq!(e.tokens_in, 78_572);
        assert_eq!(e.tokens_out, 99);
        assert!(e.cost_estimate_usd > 0.0);
    }

    #[test]
    fn claude_aggregates_per_date_model_not_per_line() {
        // Two assistant lines, same date+model => a single aggregated entry.
        let content = concat!(
            r#"{"type":"assistant","timestamp":"2026-05-19T01:00:00.000Z","message":{"model":"claude-sonnet-4-5","usage":{"input_tokens":100,"output_tokens":10}}}"#,
            "\n",
            r#"{"type":"assistant","timestamp":"2026-05-19T02:00:00.000Z","message":{"model":"claude-sonnet-4-5","usage":{"input_tokens":200,"output_tokens":20}}}"#,
        );
        let path = temp_jsonl("claude_agg", content);
        let entries = parse_claude_file(&path);
        let _ = std::fs::remove_file(&path);

        assert_eq!(entries.len(), 1, "same (date,model) must aggregate");
        assert_eq!(entries[0].tokens_in, 300);
        assert_eq!(entries[0].tokens_out, 30);
    }

    #[test]
    fn claude_ignores_lines_without_usage_or_wrong_type() {
        let content = concat!(
            // user line — wrong type, must be skipped
            r#"{"type":"user","timestamp":"2026-05-19T01:00:00.000Z","message":{"role":"user"}}"#,
            "\n",
            // assistant with no usage block — skipped
            r#"{"type":"assistant","timestamp":"2026-05-19T01:00:00.000Z","message":{"model":"claude-opus-4-7"}}"#,
            "\n",
            // assistant with zero tokens — skipped
            r#"{"type":"assistant","timestamp":"2026-05-19T01:00:00.000Z","message":{"model":"claude-opus-4-7","usage":{"input_tokens":0,"output_tokens":0}}}"#,
            "\n",
            // garbage line — skipped
            "not json at all",
        );
        let path = temp_jsonl("claude_skip", content);
        let entries = parse_claude_file(&path);
        let _ = std::fs::remove_file(&path);
        assert!(entries.is_empty(), "no valid usage => no entries");
    }

    #[test]
    fn codex_keeps_only_last_cumulative_token_count() {
        // total_token_usage is cumulative: two token_count lines, only the LAST
        // (the larger cumulative total) must be reflected — never the sum.
        let content = concat!(
            r#"{"timestamp":"2025-11-04T13:39:22.608Z","type":"turn_context","payload":{"cwd":"e:\\InteliMON","model":"gpt-5-codex"}}"#,
            "\n",
            r#"{"timestamp":"2025-11-04T13:40:00.000Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":100,"cached_input_tokens":50,"output_tokens":10,"reasoning_output_tokens":5,"total_tokens":165}}}}"#,
            "\n",
            r#"{"timestamp":"2025-11-04T13:41:00.000Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":1000,"cached_input_tokens":500,"output_tokens":100,"reasoning_output_tokens":50,"total_tokens":1650}}}}"#,
        );
        // Real file name drives the date.
        let mut path = std::env::temp_dir();
        path.push(format!(
            "rollout-2025-11-04T10-39-17-{}.jsonl",
            std::process::id()
        ));
        std::fs::write(&path, content).expect("write codex temp");
        let entries = parse_codex_file(&path);
        let _ = std::fs::remove_file(&path);

        assert_eq!(entries.len(), 1, "one cumulative entry per file");
        let e = &entries[0];
        assert_eq!(e.cli, "codex");
        assert_eq!(e.provider.as_deref(), Some("openai"));
        assert_eq!(e.model.as_deref(), Some("gpt-5-codex"));
        assert_eq!(e.date, "2025-11-04", "date from rollout file name");
        // LAST cumulative only: 1000 + 500 = 1500 in; 100 + 50 = 150 out.
        assert_eq!(e.tokens_in, 1500);
        assert_eq!(e.tokens_out, 150);
        assert_eq!(e.project.as_deref(), Some("e:\\InteliMON"));
    }

    #[test]
    fn codex_handles_payload_level_total_usage_nesting() {
        // Some rollouts nest total_token_usage directly under payload.
        let content = r#"{"timestamp":"2025-12-01T08:00:00.000Z","payload":{"type":"token_count","total_token_usage":{"input_tokens":7,"output_tokens":3}}}"#;
        let mut path = std::env::temp_dir();
        path.push(format!(
            "rollout-2025-12-01T08-00-00-alt-{}.jsonl",
            std::process::id()
        ));
        std::fs::write(&path, content).expect("write codex temp");
        let entries = parse_codex_file(&path);
        let _ = std::fs::remove_file(&path);

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].tokens_in, 7);
        assert_eq!(entries[0].tokens_out, 3);
        assert_eq!(entries[0].date, "2025-12-01");
    }

    #[test]
    fn codex_file_without_token_count_yields_nothing() {
        let content = r#"{"timestamp":"2025-11-04T13:39:22.608Z","type":"turn_context","payload":{"cwd":"e:\\x","model":"gpt-5-codex"}}"#;
        let mut path = std::env::temp_dir();
        path.push(format!(
            "rollout-2025-11-04T00-00-00-empty-{}.jsonl",
            std::process::id()
        ));
        std::fs::write(&path, content).expect("write codex temp");
        let entries = parse_codex_file(&path);
        let _ = std::fs::remove_file(&path);
        assert!(entries.is_empty());
    }

    #[test]
    fn pricing_excludes_gemini() {
        // Gemini was removed; an unknown cli must hit the generic fallback, not a
        // gemini-specific branch.
        assert_eq!(price_per_mtoken("gemini", Some("pro")), (1.0, 4.0));
        assert_eq!(price_per_mtoken("claude", Some("opus")), (15.0, 75.0));
        assert_eq!(price_per_mtoken("codex", None), (2.5, 10.0));
    }
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
    let mut req = agent.post(&url).set("Content-Type", "application/json");
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
