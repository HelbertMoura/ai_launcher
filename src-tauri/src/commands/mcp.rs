//! MCP (Model Context Protocol) server manager.
//!
//! Reads and edits the per-CLI MCP server configuration files used by the AI
//! coding CLIs this launcher manages:
//!
//! - **Claude**  -> `~/.claude/.mcp.json`            (JSON, `{"mcpServers": {...}}`)
//! - **Codex**   -> `~/.codex/config.toml`           (TOML, `[mcp_servers.<name>]`)
//! - **Gemini**  -> `~/.gemini/config/mcp_config.json` (JSON, same shape as Claude)
//!
//! Codex is the odd one out: its file is a large shared TOML config holding much
//! more than MCP servers, so edits go through [`toml_edit`] to preserve comments,
//! ordering and unrelated tables. Claude/Gemini JSON edits go through `serde_json`
//! using a generic `Value` so we never clobber unknown fields (e.g. Gemini's
//! `$typeName` marker).
//!
//! ## Security
//!
//! Header values and env-var values are **never** returned to the frontend nor
//! logged: [`list_mcp_servers`] only exposes the *keys*. Backups are written
//! before every mutating write so a bad edit is always recoverable.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

// ============================================================
// TYPES
// ============================================================

/// Which managed CLI a server belongs to. Serialized lowercase to match the
/// frontend (`claude` / `codex` / `gemini`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpCli {
    Claude,
    Codex,
    Gemini,
}

impl McpCli {
    fn as_str(self) -> &'static str {
        match self {
            McpCli::Claude => "claude",
            McpCli::Codex => "codex",
            McpCli::Gemini => "gemini",
        }
    }

    /// Absolute path to this CLI's MCP config file, or `None` if the home dir
    /// can't be resolved.
    fn config_path(self) -> Option<PathBuf> {
        let home = dirs::home_dir()?;
        Some(match self {
            McpCli::Claude => home.join(".claude").join(".mcp.json"),
            McpCli::Codex => home.join(".codex").join("config.toml"),
            McpCli::Gemini => home.join(".gemini").join("config").join("mcp_config.json"),
        })
    }
}

/// Transport kind. `Stdio` = local process (`command`/`args`); `Http` = remote
/// URL endpoint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpTransport {
    Stdio,
    Http,
}

/// A unified MCP server descriptor returned to the frontend.
///
/// Secret-bearing fields are redacted: only `headers_keys` and `env_keys` are
/// exposed, never the values.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub cli: McpCli,
    pub transport: McpTransport,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    /// Only the *keys* of any HTTP headers — values are never exposed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub headers_keys: Vec<String>,
    /// Only the *keys* of any env vars — values are never exposed.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub env_keys: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// Input payload for add/update. Carries the full (secret-bearing) values so we
/// can write them to disk. Unlike [`McpServer`] this is never serialized back
/// out to the frontend.
#[derive(Debug, Clone, Deserialize)]
pub struct McpServerInput {
    pub name: String,
    pub transport: McpTransport,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Option<Vec<String>>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub headers: Option<BTreeMap<String, String>>,
    #[serde(default)]
    pub env: Option<BTreeMap<String, String>>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

/// Result of a [`mcp_health_check`].
#[derive(Debug, Clone, Serialize)]
pub struct McpHealth {
    pub ok: bool,
    pub detail: String,
}

// ============================================================
// VALIDATION
// ============================================================

/// Validates an MCP server name against `^[A-Za-z0-9_-]+$`.
///
/// This is the gate before a name is interpolated into a TOML table header
/// (`[mcp_servers.<name>]`) or used as a JSON object key, preventing injection
/// of TOML/path-traversal metacharacters.
fn is_valid_server_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn validate_name(name: &str) -> Result<(), String> {
    if is_valid_server_name(name) {
        Ok(())
    } else {
        Err(format!(
            "Nome de servidor MCP inválido: {:?} (use apenas A-Z a-z 0-9 _ -)",
            name
        ))
    }
}

/// Validates that an input payload is internally consistent for its transport.
fn validate_input(input: &McpServerInput) -> Result<(), String> {
    validate_name(&input.name)?;
    match input.transport {
        McpTransport::Stdio => {
            let cmd_ok = input
                .command
                .as_deref()
                .map(|c| !c.trim().is_empty())
                .unwrap_or(false);
            if !cmd_ok {
                return Err("Servidor stdio exige um campo 'command' não vazio".into());
            }
        }
        McpTransport::Http => {
            let url_ok = input
                .url
                .as_deref()
                .map(|u| !u.trim().is_empty())
                .unwrap_or(false);
            if !url_ok {
                return Err("Servidor http exige um campo 'url' não vazio".into());
            }
        }
    }
    Ok(())
}

// ============================================================
// BACKUP
// ============================================================

/// Writes `<path>.bak-<timestamp>` next to `path` before a mutating write.
///
/// A missing source file is not an error (nothing to back up). Backup failures
/// are surfaced so we never overwrite an unbacked file.
fn backup_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("config");
    let backup_name = format!("{}.bak-{}", file_name, ts);
    let backup_path = path.with_file_name(backup_name);
    std::fs::copy(path, &backup_path)
        .map(|_| ())
        .map_err(|e| format!("Falha ao criar backup de {}: {}", path.display(), e))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Falha ao criar diretório {}: {}", parent.display(), e))?;
    }
    Ok(())
}

// ============================================================
// JSON (Claude / Gemini)
// ============================================================

/// Parses a JSON `{"mcpServers": {...}}` document into [`McpServer`] descriptors.
///
/// Tolerant of a missing/empty file (returns `Ok(vec![])`) and of unknown
/// per-server fields (ignored). Header/env *values* are dropped; only keys kept.
fn parse_json_servers(contents: &str, cli: McpCli) -> Result<Vec<McpServer>, String> {
    if contents.trim().is_empty() {
        return Ok(vec![]);
    }
    let root: serde_json::Value =
        serde_json::from_str(contents).map_err(|e| format!("JSON inválido: {}", e))?;
    let Some(map) = root.get("mcpServers").and_then(|v| v.as_object()) else {
        return Ok(vec![]);
    };

    let mut servers = Vec::with_capacity(map.len());
    for (name, val) in map {
        servers.push(json_value_to_server(name, val, cli));
    }
    servers.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(servers)
}

fn json_value_to_server(name: &str, val: &serde_json::Value, cli: McpCli) -> McpServer {
    let type_field = val.get("type").and_then(|v| v.as_str());
    let url = val
        .get("url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Treat as HTTP when an explicit type says so OR a url is present and there
    // is no command.
    let has_command = val.get("command").and_then(|v| v.as_str()).is_some();
    let is_http = matches!(
        type_field,
        Some("http") | Some("sse") | Some("streamable-http")
    ) || (url.is_some() && !has_command);

    let transport = if is_http {
        McpTransport::Http
    } else {
        McpTransport::Stdio
    };

    let command = val
        .get("command")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let args = val.get("args").and_then(|v| v.as_array()).map(|arr| {
        arr.iter()
            .filter_map(|a| a.as_str().map(|s| s.to_string()))
            .collect()
    });
    let headers_keys = object_keys(val.get("headers"));
    let env_keys = object_keys(val.get("env"));
    // `enabled` defaults to true; honor an explicit `false` / `disabled: true`.
    let enabled = match val.get("enabled").and_then(|v| v.as_bool()) {
        Some(b) => b,
        None => !val
            .get("disabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    };

    McpServer {
        name: name.to_string(),
        cli,
        transport,
        command,
        args,
        url,
        headers_keys,
        env_keys,
        enabled,
    }
}

fn object_keys(val: Option<&serde_json::Value>) -> Vec<String> {
    val.and_then(|v| v.as_object())
        .map(|o| o.keys().cloned().collect())
        .unwrap_or_default()
}

/// Builds the JSON object for a single server from an input payload.
fn input_to_json_value(input: &McpServerInput) -> serde_json::Value {
    use serde_json::{Map, Value};
    let mut obj = Map::new();

    match input.transport {
        McpTransport::Stdio => {
            if let Some(cmd) = &input.command {
                obj.insert("command".into(), Value::String(cmd.clone()));
            }
            if let Some(args) = &input.args {
                obj.insert(
                    "args".into(),
                    Value::Array(args.iter().map(|a| Value::String(a.clone())).collect()),
                );
            }
            if let Some(env) = &input.env {
                if !env.is_empty() {
                    let m: Map<String, Value> = env
                        .iter()
                        .map(|(k, v)| (k.clone(), Value::String(v.clone())))
                        .collect();
                    obj.insert("env".into(), Value::Object(m));
                }
            }
        }
        McpTransport::Http => {
            obj.insert("type".into(), Value::String("http".into()));
            if let Some(url) = &input.url {
                obj.insert("url".into(), Value::String(url.clone()));
            }
            if let Some(headers) = &input.headers {
                if !headers.is_empty() {
                    let m: Map<String, Value> = headers
                        .iter()
                        .map(|(k, v)| (k.clone(), Value::String(v.clone())))
                        .collect();
                    obj.insert("headers".into(), Value::Object(m));
                }
            }
        }
    }

    if !input.enabled {
        obj.insert("enabled".into(), Value::Bool(false));
    }
    Value::Object(obj)
}

/// Reads (or initializes) the JSON doc, applies a mutation to the `mcpServers`
/// object, backs up, and writes it back pretty-printed.
fn edit_json_file<F>(path: &Path, mutate: F) -> Result<(), String>
where
    F: FnOnce(&mut serde_json::Map<String, serde_json::Value>) -> Result<(), String>,
{
    use serde_json::{Map, Value};

    let mut root: Value = if path.exists() {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| format!("Falha ao ler {}: {}", path.display(), e))?;
        if contents.trim().is_empty() {
            Value::Object(Map::new())
        } else {
            serde_json::from_str(&contents).map_err(|e| format!("JSON inválido: {}", e))?
        }
    } else {
        Value::Object(Map::new())
    };

    if !root.is_object() {
        return Err("Documento JSON raiz não é um objeto".into());
    }
    let root_obj = root.as_object_mut().expect("checked is_object above");
    let servers = root_obj
        .entry("mcpServers")
        .or_insert_with(|| Value::Object(Map::new()));
    let servers_obj = servers
        .as_object_mut()
        .ok_or("Campo 'mcpServers' não é um objeto")?;

    mutate(servers_obj)?;

    backup_file(path)?;
    ensure_parent_dir(path)?;
    let pretty = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("Falha ao serializar JSON: {}", e))?;
    std::fs::write(path, pretty).map_err(|e| format!("Falha ao escrever {}: {}", path.display(), e))
}

// ============================================================
// TOML (Codex) — format-preserving via toml_edit
// ============================================================

/// Parses Codex `config.toml` and extracts `[mcp_servers.<name>]` tables.
fn parse_codex_servers(contents: &str) -> Result<Vec<McpServer>, String> {
    use toml_edit::DocumentMut;
    if contents.trim().is_empty() {
        return Ok(vec![]);
    }
    let doc: DocumentMut = contents
        .parse()
        .map_err(|e| format!("TOML inválido: {}", e))?;

    let Some(servers_item) = doc.get("mcp_servers") else {
        return Ok(vec![]);
    };
    let Some(servers_tbl) = servers_item.as_table() else {
        return Ok(vec![]);
    };

    let mut out = Vec::new();
    for (name, item) in servers_tbl.iter() {
        let Some(tbl) = item.as_table() else {
            continue;
        };
        out.push(codex_table_to_server(name, tbl));
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

fn codex_table_to_server(name: &str, tbl: &toml_edit::Table) -> McpServer {
    let command = tbl
        .get("command")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let url = tbl
        .get("url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let args = tbl.get("args").and_then(|v| v.as_array()).map(|arr| {
        arr.iter()
            .filter_map(|a| a.as_str().map(|s| s.to_string()))
            .collect()
    });
    let env_keys = tbl
        .get("env")
        .and_then(|v| v.as_table())
        .map(|t| t.iter().map(|(k, _)| k.to_string()).collect())
        .unwrap_or_default();

    let transport = if command.is_some() {
        McpTransport::Stdio
    } else if url.is_some() {
        McpTransport::Http
    } else {
        McpTransport::Stdio
    };

    let enabled = tbl.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);

    McpServer {
        name: name.to_string(),
        cli: McpCli::Codex,
        transport,
        command,
        args,
        url,
        headers_keys: vec![],
        env_keys,
        enabled,
    }
}

/// Builds a `toml_edit::Table` for a single Codex MCP server from an input.
fn input_to_codex_table(input: &McpServerInput) -> toml_edit::Table {
    use toml_edit::{value, Array, Table};
    let mut tbl = Table::new();

    match input.transport {
        McpTransport::Stdio => {
            if let Some(cmd) = &input.command {
                tbl.insert("command", value(cmd.clone()));
            }
            if let Some(args) = &input.args {
                let mut arr = Array::new();
                for a in args {
                    arr.push(a.clone());
                }
                tbl.insert("args", value(arr));
            }
            if let Some(env) = &input.env {
                if !env.is_empty() {
                    let mut env_tbl = Table::new();
                    // Render as a sub-table so it appears as [mcp_servers.<name>.env].
                    env_tbl.set_implicit(false);
                    for (k, v) in env {
                        env_tbl.insert(k, value(v.clone()));
                    }
                    tbl.insert("env", toml_edit::Item::Table(env_tbl));
                }
            }
        }
        McpTransport::Http => {
            if let Some(url) = &input.url {
                tbl.insert("url", value(url.clone()));
            }
        }
    }

    if !input.enabled {
        tbl.insert("enabled", value(false));
    }
    tbl
}

/// Reads (or initializes) the Codex TOML doc, applies a mutation to the
/// `mcp_servers` table, backs up, and writes it back preserving formatting.
fn edit_codex_file<F>(path: &Path, mutate: F) -> Result<(), String>
where
    F: FnOnce(&mut toml_edit::Table) -> Result<(), String>,
{
    use toml_edit::{DocumentMut, Item, Table};

    let mut doc: DocumentMut = if path.exists() {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| format!("Falha ao ler {}: {}", path.display(), e))?;
        contents
            .parse()
            .map_err(|e| format!("TOML inválido: {}", e))?
    } else {
        DocumentMut::new()
    };

    // Ensure mcp_servers exists as a (non-implicit) table.
    if doc.get("mcp_servers").and_then(|i| i.as_table()).is_none() {
        let mut t = Table::new();
        t.set_implicit(true);
        doc.insert("mcp_servers", Item::Table(t));
    }
    let servers_tbl = doc
        .get_mut("mcp_servers")
        .and_then(|i| i.as_table_mut())
        .ok_or("Campo 'mcp_servers' não é uma tabela")?;

    mutate(servers_tbl)?;

    backup_file(path)?;
    ensure_parent_dir(path)?;
    std::fs::write(path, doc.to_string())
        .map_err(|e| format!("Falha ao escrever {}: {}", path.display(), e))
}

// ============================================================
// READ HELPERS
// ============================================================

fn read_cli_servers(cli: McpCli) -> Result<Vec<McpServer>, String> {
    let Some(path) = cli.config_path() else {
        return Ok(vec![]);
    };
    if !path.exists() {
        return Ok(vec![]);
    }
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Falha ao ler {}: {}", path.display(), e))?;
    match cli {
        McpCli::Claude | McpCli::Gemini => parse_json_servers(&contents, cli),
        McpCli::Codex => parse_codex_servers(&contents),
    }
}

// ============================================================
// TAURI COMMANDS
// ============================================================

/// Lists all MCP servers across Claude, Codex and Gemini.
///
/// A missing or malformed file for one CLI does not fail the whole call: that
/// CLI simply contributes no servers. Secret values are never returned.
#[tauri::command]
pub fn list_mcp_servers() -> Result<Vec<McpServer>, String> {
    let mut all = Vec::new();
    for cli in [McpCli::Claude, McpCli::Codex, McpCli::Gemini] {
        match read_cli_servers(cli) {
            Ok(mut servers) => all.append(&mut servers),
            Err(e) => {
                crate::util::log_event(
                    "mcp",
                    &format!("falha ao ler servers de {}: {}", cli.as_str(), e),
                );
            }
        }
    }
    Ok(all)
}

/// Adds a new MCP server to the given CLI's config file.
///
/// Fails if a server with the same name already exists (use
/// [`update_mcp_server`] to modify). A backup is written before the edit.
#[tauri::command]
pub fn add_mcp_server(cli: McpCli, server: McpServerInput) -> Result<(), String> {
    validate_input(&server)?;
    let path = cli
        .config_path()
        .ok_or("Não foi possível resolver o diretório home")?;
    let name = server.name.clone();

    match cli {
        McpCli::Claude | McpCli::Gemini => edit_json_file(&path, |servers| {
            if servers.contains_key(&name) {
                return Err(format!("Servidor MCP '{}' já existe", name));
            }
            servers.insert(name.clone(), input_to_json_value(&server));
            Ok(())
        }),
        McpCli::Codex => edit_codex_file(&path, |servers| {
            if servers.contains_key(&name) {
                return Err(format!("Servidor MCP '{}' já existe", name));
            }
            servers.insert(&name, toml_edit::Item::Table(input_to_codex_table(&server)));
            Ok(())
        }),
    }?;

    crate::util::log_event("mcp", &format!("add {} server '{}'", cli.as_str(), name));
    Ok(())
}

/// Updates an existing MCP server in the given CLI's config file.
///
/// Replaces the table/object keyed by `name` with the new payload. If the new
/// payload carries a different `name`, the entry is renamed (old key removed).
/// A backup is written before the edit.
#[tauri::command]
pub fn update_mcp_server(cli: McpCli, name: String, server: McpServerInput) -> Result<(), String> {
    validate_name(&name)?;
    validate_input(&server)?;
    let path = cli
        .config_path()
        .ok_or("Não foi possível resolver o diretório home")?;
    let new_name = server.name.clone();

    match cli {
        McpCli::Claude | McpCli::Gemini => edit_json_file(&path, |servers| {
            if !servers.contains_key(&name) {
                return Err(format!("Servidor MCP '{}' não encontrado", name));
            }
            servers.remove(&name);
            servers.insert(new_name.clone(), input_to_json_value(&server));
            Ok(())
        }),
        McpCli::Codex => edit_codex_file(&path, |servers| {
            if !servers.contains_key(&name) {
                return Err(format!("Servidor MCP '{}' não encontrado", name));
            }
            servers.remove(&name);
            servers.insert(
                &new_name,
                toml_edit::Item::Table(input_to_codex_table(&server)),
            );
            Ok(())
        }),
    }?;

    crate::util::log_event(
        "mcp",
        &format!(
            "update {} server '{}' -> '{}'",
            cli.as_str(),
            name,
            new_name
        ),
    );
    Ok(())
}

/// Removes an MCP server from the given CLI's config file.
///
/// A backup is written before the edit. Removing a non-existent server is an
/// error so the caller knows the operation was a no-op.
#[tauri::command]
pub fn remove_mcp_server(cli: McpCli, name: String) -> Result<(), String> {
    validate_name(&name)?;
    let path = cli
        .config_path()
        .ok_or("Não foi possível resolver o diretório home")?;

    match cli {
        McpCli::Claude | McpCli::Gemini => edit_json_file(&path, |servers| {
            if servers.remove(&name).is_none() {
                return Err(format!("Servidor MCP '{}' não encontrado", name));
            }
            Ok(())
        }),
        McpCli::Codex => edit_codex_file(&path, |servers| {
            if servers.remove(&name).is_none() {
                return Err(format!("Servidor MCP '{}' não encontrado", name));
            }
            Ok(())
        }),
    }?;

    crate::util::log_event("mcp", &format!("remove {} server '{}'", cli.as_str(), name));
    Ok(())
}

/// Lightweight health check for an MCP server.
///
/// - **stdio**: checks that `command` resolves on `PATH` (reuses
///   [`crate::util::command_exists`]).
/// - **http**: no network request is made in this version — returns `ok: true`
///   with a "reachable: unknown" note. (A real probe is deferred to a later
///   iteration to avoid leaking auth headers over the network here.)
#[tauri::command]
pub fn mcp_health_check(server: McpServerInput) -> Result<McpHealth, String> {
    match server.transport {
        McpTransport::Stdio => {
            let Some(cmd) = server.command.as_deref().filter(|c| !c.trim().is_empty()) else {
                return Ok(McpHealth {
                    ok: false,
                    detail: "Servidor stdio sem 'command'".into(),
                });
            };
            if crate::util::command_exists(cmd) {
                Ok(McpHealth {
                    ok: true,
                    detail: format!("Comando '{}' encontrado no PATH", cmd),
                })
            } else {
                Ok(McpHealth {
                    ok: false,
                    detail: format!("Comando '{}' não encontrado no PATH", cmd),
                })
            }
        }
        McpTransport::Http => {
            let url = server
                .url
                .as_deref()
                .filter(|u| !u.trim().is_empty())
                .unwrap_or("(sem url)");
            Ok(McpHealth {
                ok: true,
                detail: format!("Endpoint HTTP {} (alcançabilidade: desconhecida)", url),
            })
        }
    }
}

// ============================================================
// TESTS
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn input_stdio(name: &str) -> McpServerInput {
        let mut env = BTreeMap::new();
        env.insert("API_KEY".to_string(), "secret-value".to_string());
        McpServerInput {
            name: name.to_string(),
            transport: McpTransport::Stdio,
            command: Some("npx".into()),
            args: Some(vec!["-y".into(), "some-mcp@latest".into()]),
            url: None,
            headers: None,
            env: Some(env),
            enabled: true,
        }
    }

    fn input_http(name: &str) -> McpServerInput {
        let mut headers = BTreeMap::new();
        headers.insert("Authorization".to_string(), "Bearer xyz".to_string());
        McpServerInput {
            name: name.to_string(),
            transport: McpTransport::Http,
            command: None,
            args: None,
            url: Some("https://example.com/mcp".into()),
            headers: Some(headers),
            env: None,
            enabled: true,
        }
    }

    // ---- name validation ----

    #[test]
    fn valid_names_accepted() {
        for ok in &["shadcn", "context7", "node_repl", "my-server", "a1_b2-c3"] {
            assert!(is_valid_server_name(ok), "should accept {}", ok);
        }
    }

    #[test]
    fn invalid_names_rejected() {
        for bad in &[
            "",
            "has space",
            "dot.name",
            "semi;colon",
            "../traversal",
            "a\"b",
        ] {
            assert!(!is_valid_server_name(bad), "should reject {:?}", bad);
        }
    }

    // ---- Claude JSON parse: stdio + http ----

    #[test]
    fn parses_claude_stdio_and_http() {
        let json = r#"{
          "mcpServers": {
            "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] },
            "remote": { "type": "http", "url": "https://api.x.com/mcp",
                        "headers": { "Authorization": "Bearer s3cr3t" } }
          }
        }"#;
        let servers = parse_json_servers(json, McpCli::Claude).unwrap();
        assert_eq!(servers.len(), 2);

        let remote = servers.iter().find(|s| s.name == "remote").unwrap();
        assert_eq!(remote.transport, McpTransport::Http);
        assert_eq!(remote.url.as_deref(), Some("https://api.x.com/mcp"));
        // Secret value must NOT leak — only the header key.
        assert_eq!(remote.headers_keys, vec!["Authorization".to_string()]);

        let shadcn = servers.iter().find(|s| s.name == "shadcn").unwrap();
        assert_eq!(shadcn.transport, McpTransport::Stdio);
        assert_eq!(shadcn.command.as_deref(), Some("npx"));
        assert_eq!(
            shadcn.args.as_ref().unwrap(),
            &vec!["shadcn@latest".to_string(), "mcp".to_string()]
        );
    }

    #[test]
    fn json_url_without_type_is_http() {
        let json = r#"{ "mcpServers": { "r": { "url": "https://x/mcp" } } }"#;
        let servers = parse_json_servers(json, McpCli::Gemini).unwrap();
        assert_eq!(servers[0].transport, McpTransport::Http);
    }

    #[test]
    fn empty_or_missing_json_is_empty_list() {
        assert!(parse_json_servers("", McpCli::Claude).unwrap().is_empty());
        assert!(parse_json_servers("{}", McpCli::Claude).unwrap().is_empty());
        assert!(parse_json_servers(r#"{"other":1}"#, McpCli::Claude)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn gemini_extra_fields_do_not_leak_env_values() {
        let json = r#"{
          "mcpServers": {
            "mem": {
              "$typeName": "exa.cascade_plugins_pb.CascadePluginCommandTemplate",
              "command": "python3", "args": ["-m", "x"],
              "env": { "MEMPALACE_PALACE_PATH": "C:\\secret\\path" }
            }
          }
        }"#;
        let servers = parse_json_servers(json, McpCli::Gemini).unwrap();
        assert_eq!(servers.len(), 1);
        assert_eq!(
            servers[0].env_keys,
            vec!["MEMPALACE_PALACE_PATH".to_string()]
        );
        // No field on McpServer carries the value; serialization proves it.
        let serialized = serde_json::to_string(&servers[0]).unwrap();
        assert!(!serialized.contains("C:"), "env value must not be exposed");
    }

    // ---- Codex TOML parse ----

    #[test]
    fn parses_codex_toml() {
        let toml = r#"
# top-level comment
model = "gpt-5"

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp@2.1.7"]

[mcp_servers.context7.env]
CONTEXT7_API_KEY = "${CONTEXT7_API_KEY}"

[mcp_servers.fetch]
command = "uvx"
args = ["mcp-server-fetch"]
"#;
        let servers = parse_codex_servers(toml).unwrap();
        assert_eq!(servers.len(), 2);

        let ctx = servers.iter().find(|s| s.name == "context7").unwrap();
        assert_eq!(ctx.cli, McpCli::Codex);
        assert_eq!(ctx.transport, McpTransport::Stdio);
        assert_eq!(ctx.command.as_deref(), Some("npx"));
        // env value never exposed — only key.
        assert_eq!(ctx.env_keys, vec!["CONTEXT7_API_KEY".to_string()]);
    }

    #[test]
    fn empty_codex_is_empty_list() {
        assert!(parse_codex_servers("").unwrap().is_empty());
        assert!(parse_codex_servers("model = \"x\"\n").unwrap().is_empty());
    }

    // ---- JSON round-trip: add preserves other servers + unknown fields ----

    #[test]
    fn json_add_preserves_other_servers_and_unknown_fields() {
        let dir = std::env::temp_dir().join(format!("mcp-test-json-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(".mcp.json");
        let initial = r#"{
          "globalSetting": true,
          "mcpServers": {
            "existing": { "command": "node", "args": ["server.js"],
                          "customField": "keep-me" }
          }
        }"#;
        std::fs::write(&path, initial).unwrap();

        edit_json_file(&path, |servers| {
            servers.insert("newone".into(), input_to_json_value(&input_http("newone")));
            Ok(())
        })
        .unwrap();

        let written = std::fs::read_to_string(&path).unwrap();
        let root: serde_json::Value = serde_json::from_str(&written).unwrap();
        // Unknown top-level + unknown per-server field preserved.
        assert_eq!(root["globalSetting"], serde_json::json!(true));
        assert_eq!(root["mcpServers"]["existing"]["customField"], "keep-me");
        // New server present and parseable.
        let servers = parse_json_servers(&written, McpCli::Claude).unwrap();
        assert_eq!(servers.len(), 2);
        let new = servers.iter().find(|s| s.name == "newone").unwrap();
        assert_eq!(new.transport, McpTransport::Http);

        std::fs::remove_dir_all(&dir).ok();
    }

    // ---- TOML round-trip: add preserves other servers + comments ----

    #[test]
    fn codex_add_preserves_other_servers_and_comments() {
        let dir = std::env::temp_dir().join(format!("mcp-test-toml-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("config.toml");
        let initial = r#"# my codex config
model = "gpt-5"

[mcp_servers.fetch]
command = "uvx"
args = ["mcp-server-fetch"]
"#;
        std::fs::write(&path, initial).unwrap();

        edit_codex_file(&path, |servers| {
            servers.insert(
                "added",
                toml_edit::Item::Table(input_to_codex_table(&input_stdio("added"))),
            );
            Ok(())
        })
        .unwrap();

        let written = std::fs::read_to_string(&path).unwrap();
        // Comment + unrelated key preserved.
        assert!(written.contains("# my codex config"));
        assert!(written.contains("model = \"gpt-5\""));
        // Both servers parse; env sub-table written.
        let servers = parse_codex_servers(&written).unwrap();
        assert_eq!(servers.len(), 2);
        let added = servers.iter().find(|s| s.name == "added").unwrap();
        assert_eq!(added.env_keys, vec!["API_KEY".to_string()]);
        // Backup file created.
        let backups: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("config.toml.bak-")
            })
            .collect();
        assert_eq!(backups.len(), 1, "exactly one backup should be created");

        std::fs::remove_dir_all(&dir).ok();
    }

    // ---- remove ----

    #[test]
    fn codex_remove_errors_when_absent() {
        let dir = std::env::temp_dir().join(format!("mcp-test-rm-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("config.toml");
        std::fs::write(&path, "[mcp_servers.keep]\ncommand = \"x\"\n").unwrap();

        let res = edit_codex_file(&path, |servers| {
            if servers.remove("ghost").is_none() {
                return Err("não encontrado".into());
            }
            Ok(())
        });
        assert!(res.is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    // ---- input validation ----

    #[test]
    fn validate_rejects_stdio_without_command() {
        let mut inp = input_stdio("x");
        inp.command = None;
        assert!(validate_input(&inp).is_err());
    }

    #[test]
    fn validate_rejects_http_without_url() {
        let mut inp = input_http("x");
        inp.url = None;
        assert!(validate_input(&inp).is_err());
    }

    #[test]
    fn validate_rejects_bad_name() {
        let mut inp = input_stdio("bad name");
        inp.name = "bad name".into();
        assert!(validate_input(&inp).is_err());
    }
}
