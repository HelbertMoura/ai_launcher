// Race Mode backend (v23.2a): run up to 3 AI CLIs in parallel over the same
// project, each in its own git worktree, then diff and adopt the best result.
//
// Guardrails (design doc `out/v23-racemode-design.md` v2, gate-approved):
// - Worktrees live under `%LOCALAPPDATA%/ai-launcher/races/<race-id>/<agent>/`
//   — never inside the user's repository, so they are invisible to the main
//   `git status` and never picked up by the user's tooling.
// - Branch names are always `race/<uuid>/<allowlisted-agent-key>`: user text
//   never reaches `git worktree -b`, killing branch-name injection.
// - `base_sha` is frozen at start; every diff is `base_sha...race-branch`
//   (three-dot), so a default branch that moves mid-race never contaminates
//   the diff and any default branch name (`main`, `master`, …) works.
// - The main tree must be clean at start AND is re-validated at adopt time.
// - `apply` runs `git apply --3way --check` first and only applies when the
//   check passes; a conflict yields a per-file report with the tree untouched.
// - Agents are spawned as direct child processes (no shell): every token is a
//   separate argv entry, the prompt is always the last positional argument.
//   Cancellation reuses the shared `crate::util::kill_tree`.
// - Submodule/LFS detection and the worktree-dependency caveat are surfaced
//   as warnings on the handle at start.
//
// Crash recovery state lives in `commands/race_state.rs` (`races.json`,
// atomic writes); the boot-time wiring is wave 23.2d.

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Instant;

use serde::{Deserialize, Serialize};

use crate::errors::AppError;
use crate::util::{
    apply_no_window, capture_process_identity, command_exists, get_cli_definitions, log_event,
    process_identity_matches, resolve_cli_path, validate_directory, ProcessIdentity,
};

use super::race_state::{
    get_race, load_state, races_root, scan_orphans, update_race, upsert_race, AgentRecord,
    RaceRecord,
};

/// Maximum number of agents in a single race.
pub const MAX_AGENTS: usize = 3;
/// Hard cap for the unified patch returned by `race_diff` (2 MB).
pub const MAX_PATCH_BYTES: usize = 2 * 1024 * 1024;
/// Sanity cap for the task prompt length.
pub const MAX_PROMPT_CHARS: usize = 32_000;
/// Default retention window before a finished race can be cleaned up.
pub const DEFAULT_KEEP_DAYS: u32 = 7;

const LOG_TAIL_LINES: usize = 40;
const MAX_LOG_CHARS: usize = 4_000;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/// Receipt of a started race; also the opaque handle for every other command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaceHandle {
    pub race_id: String,
    pub directory: String,
    /// HEAD SHA frozen at start.
    pub base_sha: String,
    /// Allowlisted agent keys participating in the race.
    pub agents: Vec<String>,
    /// Branches created: `race/<race-id>/<agent>`.
    pub branches: Vec<String>,
    /// Worktree paths (outside the user's repository).
    pub worktrees: Vec<String>,
    /// Limitation banners (submodules/LFS/dependencies) captured at start.
    pub warnings: Vec<String>,
    /// RFC3339 timestamp of the race start.
    pub started_at: String,
}

/// Per-agent poll view.
#[derive(Debug, Clone, Serialize)]
pub struct AgentRuntimeStatus {
    pub agent: String,
    /// "running" | "completed" | "failed" | "killed" | "unknown".
    pub status: String,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub duration_secs: Option<u64>,
    /// Tail of the agent's log file.
    pub last_log_lines: Vec<String>,
}

/// Lightweight poll snapshot for the race panel.
#[derive(Debug, Clone, Serialize)]
pub struct RaceSnapshot {
    pub race_id: String,
    pub directory: String,
    /// "running" | "completed" | "failed" | "cancelled" | "adopted" | "cleaned".
    pub status: String,
    pub base_sha: String,
    pub started_at: String,
    pub warnings: Vec<String>,
    pub agents: Vec<AgentRuntimeStatus>,
}

/// One changed file in the diff (`None` adds/dels = binary file).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RaceFileStat {
    pub path: String,
    pub adds: Option<u64>,
    pub dels: Option<u64>,
}

/// Result of `race_diff`: file stats plus the capped unified patch.
#[derive(Debug, Clone, Serialize)]
pub struct DiffReport {
    pub agent: String,
    pub files: Vec<RaceFileStat>,
    pub total_adds: u64,
    pub total_dels: u64,
    pub patch: String,
    /// True when the patch hit [`MAX_PATCH_BYTES`] and was truncated.
    pub truncated: bool,
}

/// Adoption strategy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AdoptMode {
    /// Default safe mode: create an adoption branch at the race tip; the user
    /// merges when ready. The working tree is never touched.
    Branch,
    /// Apply the race patch into the main tree (atomic, pre-checked).
    Apply,
}

/// One file that could not be applied.
#[derive(Debug, Clone, Serialize)]
pub struct AdoptConflict {
    pub path: String,
    pub reason: String,
}

/// Result of `race_adopt`.
#[derive(Debug, Clone, Serialize)]
pub struct AdoptReport {
    /// "branch" | "apply".
    pub mode: String,
    pub ok: bool,
    /// Adoption branch name (branch mode only).
    pub branch: Option<String>,
    /// Per-file conflicts (apply mode, when blocked).
    pub conflicts: Vec<AdoptConflict>,
    pub message: String,
}

/// Result of `race_cleanup`.
#[derive(Debug, Clone, Serialize)]
pub struct RaceCleanupReport {
    pub race_id: String,
    pub removed_worktrees: Vec<String>,
    pub removed_branches: Vec<String>,
    /// Whether the race-scoped worktree metadata prune ran.
    pub pruned: bool,
    /// Present when the retention window has not elapsed yet.
    pub skipped_reason: Option<String>,
    /// Per-agent reasons why a persisted process was NOT killed during
    /// recovery (identity unverifiable, reused pid, or no signature).
    /// Disk cleanup always proceeds regardless of these entries.
    #[serde(default)]
    pub unverified_processes: Vec<String>,
}

/// One orphaned race found by the boot-time scan primitive.
#[derive(Debug, Clone, Serialize)]
pub struct OrphanRace {
    pub race_id: String,
    pub directory: String,
    pub started_at: String,
    pub agents: Vec<String>,
    pub worktree_root: String,
    /// Frozen base SHA + per-agent branches/worktrees from the persisted
    /// record, so the UI can rebuild a valid handle for `race_recover`.
    pub base_sha: String,
    pub branches: Vec<String>,
    pub worktrees: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrphanScanReport {
    pub orphans: Vec<OrphanRace>,
}

/// One terminal race record surfaced by the graveyard section ("Corridas
/// anteriores"). `worktrees_present` tells the UI whether a restore can
/// reopen the live cockpit (worktrees on disk) or only the read-only,
/// archived record view.
#[derive(Debug, Clone, Serialize)]
pub struct RaceHistoryEntry {
    pub race_id: String,
    pub directory: String,
    pub base_sha: String,
    /// "completed" | "failed" | "cancelled" | "adopted" | "cleaned".
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub agents: Vec<String>,
    pub branches: Vec<String>,
    pub worktrees: Vec<String>,
    pub worktrees_present: bool,
}

// ---------------------------------------------------------------------------
// In-memory runtime registry (this process only; state survives in race_state)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct AgentProc {
    pid: u32,
    started_at: Instant,
    finished: bool,
    exit_code: Option<i32>,
    log_path: PathBuf,
}

#[derive(Debug, Default)]
struct RaceRuntime {
    cancelled: bool,
    agents: HashMap<String, AgentProc>,
}

fn runtimes() -> &'static Mutex<HashMap<String, RaceRuntime>> {
    static RUNTIMES: OnceLock<Mutex<HashMap<String, RaceRuntime>>> = OnceLock::new();
    RUNTIMES.get_or_init(|| Mutex::new(HashMap::new()))
}

// ---------------------------------------------------------------------------
// Validation helpers (allowlist gates)
// ---------------------------------------------------------------------------

/// Race ids are internally generated UUIDs; anything else is rejected before
/// it can reach a path or a branch name.
fn validate_race_id(race_id: &str) -> Result<String, String> {
    let id = race_id.trim();
    if id.is_empty()
        || id.len() > 64
        || !id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
    {
        return Err("Identificador de corrida inválido".to_string());
    }
    Ok(id.to_string())
}

/// Allowlist gate: every agent string must match a CLI definition key.
/// Rejects unknown agents, duplicates and races over [`MAX_AGENTS`].
fn validate_agents(agents: &[String]) -> Result<Vec<String>, String> {
    if agents.is_empty() {
        return Err("Selecione ao menos um agente para a corrida".to_string());
    }
    if agents.len() > MAX_AGENTS {
        return Err(format!(
            "A corrida aceita no máximo {} agentes (recebidos: {})",
            MAX_AGENTS,
            agents.len()
        ));
    }
    let allowlist: Vec<String> = get_cli_definitions()
        .iter()
        .map(|c| c.key.clone())
        .collect();
    let mut resolved = Vec::with_capacity(agents.len());
    for raw in agents {
        let key = raw.trim().to_ascii_lowercase();
        if !allowlist.contains(&key) {
            return Err(format!(
                "Agente não suportado: {}. Disponíveis: {}",
                raw.trim(),
                allowlist.join(", ")
            ));
        }
        if resolved.contains(&key) {
            return Err(format!("Agente duplicado na corrida: {}", key));
        }
        resolved.push(key);
    }
    Ok(resolved)
}

/// Gate for commands that receive an `agent` argument: the agent must be one
/// of the participants recorded for THIS race (never a free-form string that
/// could reach a path).
fn validate_race_agent(record: &RaceRecord, agent: &str) -> Result<String, String> {
    let key = agent.trim().to_ascii_lowercase();
    if record.agents.iter().any(|a| a.agent == key) {
        return Ok(key);
    }
    let participants: Vec<&str> = record.agents.iter().map(|a| a.agent.as_str()).collect();
    Err(format!(
        "O agente '{}' não participa desta corrida. Participantes: {}",
        agent.trim(),
        participants.join(", ")
    ))
}

/// Branch names derive from the internal UUID and the allowlisted key only.
fn branch_name(race_id: &str, agent: &str) -> String {
    format!("race/{}/{}", race_id, agent)
}

fn race_dir(root: &Path, race_id: &str) -> PathBuf {
    root.join(race_id)
}

fn agent_worktree(root: &Path, race_id: &str, agent: &str) -> PathBuf {
    race_dir(root, race_id).join(agent)
}

fn agent_log_path(root: &Path, race_id: &str, agent: &str) -> PathBuf {
    race_dir(root, race_id).join(format!("{}.log", agent))
}

/// Race-scoped replacement for the global `git worktree prune` (re-gate
/// condition): stale metadata directories under the user's
/// `<repo>/.git/worktrees/` are removed ONLY when their recorded `gitdir`
/// points into this race's directory (`<races-root>/<race-id>/...`). The
/// user's own orphaned worktrees are never reaped. Returns whether the
/// scoped sweep ran to completion.
fn prune_race_worktree_metadata(main_repo: &Path, root: &Path, race_id: &str) -> bool {
    let git_dir = main_repo.join(".git");
    // `.git` can be a plain file when the repository itself is a linked
    // worktree; the shared metadata then lives elsewhere and a scoped sweep
    // would be guesswork — skip instead of risking the user's entries.
    if !git_dir.is_dir() {
        return false;
    }
    let metadata_root = git_dir.join("worktrees");
    let Ok(entries) = fs::read_dir(&metadata_root) else {
        // No metadata directory at all: nothing to prune, sweep trivially done.
        return !metadata_root.exists();
    };
    let race_dir = race_dir(root, race_id);
    let mut swept = true;
    for entry in entries.filter_map(Result::ok) {
        let Ok(gitdir_text) = fs::read_to_string(entry.path().join("gitdir")) else {
            continue;
        };
        // `gitdir` records the path of the worktree's `.git` file. Git 2.46+
        // (useRelativePaths) may write it RELATIVE to this metadata
        // directory, so resolution happens in [`gitdir_points_into_race`].
        let scoped = gitdir_points_into_race(&gitdir_text, &entry.path(), &race_dir);
        if scoped && !remove_dir_all_settled(&entry.path()) {
            swept = false;
        }
    }
    swept
}

/// Removes a directory and WAITS for the name to actually disappear. On
/// Windows `RemoveDirectoryW` can return success while the name stays
/// briefly visible ("delete pending") as long as any handle — antivirus,
/// indexer, a just-exited git subprocess — lingers. The `git branch -D`
/// right after this sweep depends on the stale metadata being GONE, so a
/// fire-and-forget removal made the cleanup intermittently partial; the
/// retry loop makes the contract ("the entry is out of there") real.
/// Exhausted retries are reported as a failed sweep, never masked.
fn remove_dir_all_settled(path: &Path) -> bool {
    for _ in 0..5 {
        if !path.exists() {
            return true;
        }
        let _ = fs::remove_dir_all(path);
        if !path.exists() {
            return true;
        }
        thread::sleep(std::time::Duration::from_millis(40));
    }
    !path.exists()
}

/// Reports whether the content of a worktree metadata `gitdir` file points
/// into `race_dir`. The resolution is pure so the relative/absolute and
/// separator/case matrix can be tested without depending on the installed
/// git version:
///
/// - relative content (git 2.46+ `useRelativePaths`) is resolved against
///   `metadata_dir`, the directory that contains the `gitdir` file;
/// - separators (`/` or platform) and `.`/`..` are normalized per
///   component — never by string prefix, so `race-11` never matches
///   `race-1`;
/// - the comparison is case-insensitive on Windows (case-insensitive
///   filesystem) and exact elsewhere.
fn gitdir_points_into_race(
    gitdir_file_content: &str,
    metadata_dir: &Path,
    race_dir: &Path,
) -> bool {
    let content = gitdir_file_content.trim();
    if content.is_empty() {
        return false;
    }
    let raw = PathBuf::from(content);
    let joined = if raw.is_absolute() {
        raw
    } else {
        metadata_dir.join(raw)
    };
    let target = normalized_path_components(&joined);
    let scope = normalized_path_components(race_dir);
    if scope.is_empty() || target.len() < scope.len() {
        return false;
    }
    target
        .iter()
        .zip(scope.iter())
        .all(|(target, scope)| target == scope)
}

/// Component-wise path normalization: `.` dropped, `..` popped (popping
/// past the root is a no-op), separators unified by the `components` parser
/// and — on Windows only — lowercased, since the filesystem is
/// case-insensitive there. Prefix/RootDir collapse into a single canonical
/// anchor token so absolute and relative spellings of the same path always
/// normalize to the same component list. The anchor carries the REAL
/// drive/share (`C:` vs `D:`, UNC) so worktrees on different volumes can
/// never normalize to the same scope.
fn normalized_path_components(path: &Path) -> Vec<String> {
    const BARE_ROOT_ANCHOR: &str = "\u{0}root\u{0}";
    let lowercase = cfg!(windows);
    let mut out: Vec<String> = Vec::new();
    let mut anchored = false;
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::Prefix(prefix) => {
                if !anchored {
                    let text = prefix.as_os_str().to_string_lossy();
                    let anchor = if lowercase {
                        format!("\u{0}{}\u{0}", text.to_lowercase())
                    } else {
                        format!("\u{0}{}\u{0}", text)
                    };
                    out.clear();
                    out.push(anchor);
                    anchored = true;
                }
            }
            std::path::Component::RootDir => {
                // Right after a prefix this is the same anchor. A bare root
                // (Unix `/`, Windows `\dir` against the current drive) gets
                // its own anchor: it can never be PROVEN equal to an
                // explicit drive, and the sweep must not reap on a guess.
                if !anchored {
                    out.clear();
                    out.push(BARE_ROOT_ANCHOR.to_string());
                    anchored = true;
                }
            }
            std::path::Component::ParentDir => {
                // Popping past the anchor/root is a no-op (`C:\..` == `C:\`).
                if out.len() > usize::from(anchored) {
                    out.pop();
                }
            }
            std::path::Component::Normal(text) => {
                let text = text.to_string_lossy();
                if lowercase {
                    out.push(text.to_lowercase());
                } else {
                    out.push(text.into_owned());
                }
            }
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Git plumbing (direct process spawn, no shell, arguments never interpolated)
// ---------------------------------------------------------------------------

fn git_command(dir: &Path, args: &[&str]) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(dir).args(args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    apply_no_window(&mut cmd);
    cmd
}

fn run_git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let output = git_command(dir, args)
        .output()
        .map_err(|e| format!("Falha ao executar o git: {}", e))?;
    if !output.status.success() {
        let subcommand = args.first().copied().unwrap_or("git");
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git {} falhou: {}", subcommand, stderr.trim()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Runs git feeding the patch through stdin (used by `git apply`). The payload
/// is written from a helper thread so a chatty git process can never deadlock
/// on a full pipe buffer.
fn run_git_stdin(dir: &Path, args: &[&str], input: &[u8]) -> Result<(), String> {
    let mut child = git_command(dir, args)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Falha ao executar o git: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        let payload = input.to_vec();
        thread::spawn(move || {
            let _ = stdin.write_all(&payload);
        });
    }
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Erro ao aguardar o git: {}", e))?;
    if output.status.success() {
        return Ok(());
    }
    Err(String::from_utf8_lossy(&output.stderr).to_string())
}

fn ensure_git_repo(dir: &Path) -> Result<(), String> {
    let output = run_git(dir, &["rev-parse", "--is-inside-work-tree"])?;
    if output.trim() != "true" {
        return Err(
            "O diretório informado não é um repositório git de trabalho — o Race Mode \
             exige um repositório git"
                .to_string(),
        );
    }
    Ok(())
}

fn working_tree_clean(dir: &Path) -> Result<bool, String> {
    let output = run_git(dir, &["status", "--porcelain"])?;
    Ok(output.trim().is_empty())
}

/// Dirty-tree guard — applied at start AND re-applied at adopt time.
fn require_clean_tree(dir: &Path, context: &str) -> Result<(), String> {
    if working_tree_clean(dir)? {
        return Ok(());
    }
    Err(format!(
        "A árvore de trabalho precisa estar limpa antes de {}: faça commit ou stash das mudanças pendentes e tente novamente",
        context
    ))
}

fn head_sha(dir: &Path) -> Result<String, String> {
    let sha = run_git(dir, &["rev-parse", "HEAD"])?;
    let sha = sha.trim().to_string();
    if sha.is_empty() {
        return Err("Não foi possível determinar o SHA atual do repositório".to_string());
    }
    Ok(sha)
}

/// Limitation banners captured at start: submodules, LFS and the
/// worktree-dependency caveat (worktrees never inherit untracked files).
fn detect_repo_warnings(dir: &Path) -> Vec<String> {
    let mut warnings = Vec::new();
    if dir.join(".gitmodules").is_file() {
        warnings.push(
            "O repositório usa submódulos: eles não são inicializados automaticamente \
             nos worktrees da corrida."
                .to_string(),
        );
    }
    if let Ok(attributes) = fs::read_to_string(dir.join(".gitattributes")) {
        if attributes.contains("filter=lfs") {
            warnings.push(
                "O repositório usa Git LFS: objetos LFS podem não estar disponíveis \
                 nos worktrees da corrida."
                    .to_string(),
            );
        }
    }
    warnings.push(
        "Os worktrees não herdam arquivos não rastreados (ex.: node_modules): os \
         agentes podem precisar reinstalar as dependências para rodar builds e testes."
            .to_string(),
    );
    warnings
}

// ---------------------------------------------------------------------------
// Diff plumbing
// ---------------------------------------------------------------------------

/// Commit message of the automatic agent snapshot created by
/// [`auto_commit_worktree`].
const AUTO_COMMIT_MESSAGE: &str = "race: snapshot do agente (auto)";

/// Auto-commit guard (v23.2c): agents like Claude Code edit files without ever
/// running `git commit`, and the three-dot diff (`base_sha...race-branch`) can
/// only see commits — uncommitted work was invisible to the Diff Cockpit. So
/// BEFORE any diff/adopt, an unclean agent worktree gets `git add -A` plus a
/// single snapshot commit on the race branch.
///
/// Guarantees:
/// - This NEVER runs on the user's main directory. Callers must pass the
///   worktree through [`validate_worktree_scoped`], which refuses any path
///   outside this race's managed directory under the races root.
/// - A failed commit fails the whole diff/adopt with a clear message:
///   silently proceeding would show a stale diff that lies about the agent's
///   work (or adopt an empty patch).
///
/// Returns whether a snapshot commit was created.
fn auto_commit_worktree(worktree: &Path, agent: &str) -> Result<bool, String> {
    let status = run_git(worktree, &["status", "--porcelain"])?;
    if status.trim().is_empty() {
        return Ok(false);
    }
    run_git(worktree, &["add", "--all"])?;
    run_git(worktree, &["commit", "-m", AUTO_COMMIT_MESSAGE]).map_err(|e| {
        format!(
            "Falha ao consolidar as mudanças não commitadas do agente {} no worktree da \
             corrida: {}",
            agent, e
        )
    })?;
    Ok(true)
}

/// Scope guard for any git mutation on an agent worktree: the recorded path
/// must live inside THIS race's managed directory under the races root, so
/// the auto-commit can never reach the user's main repository even if the
/// persisted state file is tampered with.
fn validate_worktree_scoped(
    root: &Path,
    race_id: &str,
    entry: &AgentRecord,
) -> Result<PathBuf, String> {
    let worktree = PathBuf::from(&entry.worktree);
    if !worktree.starts_with(race_dir(root, race_id)) {
        return Err(format!(
            "O worktree do agente {} está fora do diretório gerenciado da corrida — \
             operação recusada por segurança",
            entry.agent
        ));
    }
    Ok(worktree)
}

/// Parses `git diff --numstat` output: `adds<TAB>dels<TAB>path`, where `-`
/// marks binary files. Unparseable lines are skipped, never fatal.
fn parse_numstat(output: &str) -> Vec<RaceFileStat> {
    let mut files = Vec::new();
    for line in output.lines() {
        let line = line.trim_end_matches('\r');
        if line.trim().is_empty() {
            continue;
        }
        let mut parts = line.splitn(3, '\t');
        let (Some(adds_raw), Some(dels_raw), Some(path_raw)) =
            (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        let parse = |raw: &str| {
            if raw == "-" {
                None
            } else {
                raw.trim().parse::<u64>().ok()
            }
        };
        files.push(RaceFileStat {
            path: path_raw.trim().to_string(),
            adds: parse(adds_raw),
            dels: parse(dels_raw),
        });
    }
    files
}

/// Caps the unified patch at [`MAX_PATCH_BYTES`], respecting char boundaries,
/// with an explicit truncation marker.
fn cap_patch(patch: String) -> (String, bool) {
    if patch.len() <= MAX_PATCH_BYTES {
        return (patch, false);
    }
    let mut cut = MAX_PATCH_BYTES;
    while cut > 0 && !patch.is_char_boundary(cut) {
        cut -= 1;
    }
    (
        format!(
            "{}\n… (diff truncado no limite de {} MB)",
            &patch[..cut],
            MAX_PATCH_BYTES / (1024 * 1024)
        ),
        true,
    )
}

fn read_log_tail(path: &Path) -> Vec<String> {
    let Ok(text) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.len().saturating_sub(LOG_TAIL_LINES);
    let mut out: Vec<String> = Vec::new();
    let mut count = 0usize;
    for line in lines[start..].iter().rev() {
        count += line.chars().count() + 1;
        if count > MAX_LOG_CHARS {
            break;
        }
        out.push((*line).to_string());
    }
    out.reverse();
    out
}

fn append_log_line(path: &Path, line: &str) {
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{}", line);
    }
}

// ---------------------------------------------------------------------------
// Worktree lifecycle
// ---------------------------------------------------------------------------

fn create_all_worktrees(
    main_repo: &Path,
    root: &Path,
    race_id: &str,
    base_sha: &str,
    agent_keys: &[String],
) -> Result<Vec<AgentRecord>, String> {
    let mut created = Vec::with_capacity(agent_keys.len());
    for key in agent_keys {
        let worktree = agent_worktree(root, race_id, key);
        let entry = AgentRecord {
            agent: key.clone(),
            branch: branch_name(race_id, key),
            worktree: worktree.to_string_lossy().into_owned(),
            pid: None,
            identity: None,
        };
        if let Some(parent) = worktree.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Falha ao criar o diretório do worktree: {}", e))?;
        }
        let worktree_text = entry.worktree.clone();
        let branch_text = entry.branch.clone();
        if let Err(error) = run_git(
            main_repo,
            &[
                "worktree",
                "add",
                "-b",
                &branch_text,
                &worktree_text,
                base_sha,
            ],
        ) {
            // `git worktree add -b` creates the branch ref BEFORE it fails on
            // the path, so the failed entry's branch must be deleted too.
            rollback_worktrees(main_repo, root, race_id, &created);
            let _ = run_git(main_repo, &["branch", "-D", &entry.branch]);
            let _ = prune_race_worktree_metadata(main_repo, root, race_id);
            return Err(format!(
                "Falha ao criar o worktree do agente {}: {}",
                entry.agent, error
            ));
        }
        created.push(entry);
    }
    Ok(created)
}

fn rollback_worktrees(main_repo: &Path, root: &Path, race_id: &str, entries: &[AgentRecord]) {
    for entry in entries {
        let _ = run_git(
            main_repo,
            &["worktree", "remove", "--force", entry.worktree.as_str()],
        );
        let _ = run_git(main_repo, &["branch", "-D", &entry.branch]);
    }
    let _ = prune_race_worktree_metadata(main_repo, root, race_id);
}

// ---------------------------------------------------------------------------
// Agent spawn
// ---------------------------------------------------------------------------

/// Non-interactive argv per CLI. The prompt is ALWAYS the last positional
/// argument and each token is a separate argv entry: the prompt never crosses
/// a shell. Real guarantee on flag interpretation: aider and goose take the
/// prompt as a FLAG VALUE (`--message` / `--text`), so leading dashes are
/// inert; claude/codex/unknown CLIs take a positional prompt, where a prompt
/// starting with `-` COULD be parsed as a flag by the CLI itself — harmless
/// to the OS (no shell, no injection), but a UI-wave refinement can add `--`
/// for CLIs that document end-of-options support. Unknown CLIs get a bare
/// positional prompt (documented MVP mapping; the UI wave refines it).
fn agent_argv(agent: &str, prompt: &str) -> Vec<String> {
    let prompt = prompt.to_string();
    match agent {
        "claude" => vec!["-p".into(), prompt],
        "codex" => vec!["exec".into(), prompt],
        "aider" => vec!["--yes-always".into(), "--message".into(), prompt],
        "goose" => vec!["run".into(), "--text".into(), prompt],
        _ => vec![prompt],
    }
}

/// Spawns one agent process in its worktree with output captured to a log
/// file. The proc is registered in the runtime registry immediately after the
/// spawn, so the waiter thread can always find its slot to store the exit
/// code. Cancellation later reuses `crate::util::kill_tree` on the pid.
fn spawn_agent_process(
    race_id: &str,
    agent: &str,
    program: &str,
    argv: &[String],
    cwd: &Path,
    log_path: &Path,
) -> Result<AgentProc, String> {
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Falha ao criar o diretório de log do agente {}: {}",
                agent, e
            )
        })?;
    }
    fs::File::create(log_path)
        .map_err(|e| format!("Falha ao criar o log do agente {}: {}", agent, e))?;
    let mut cmd = Command::new(program);
    cmd.args(argv).current_dir(cwd);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    apply_no_window(&mut cmd);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt as _;
        cmd.process_group(0);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Falha ao iniciar '{}': {}", program, e))?;

    let proc = AgentProc {
        pid: child.id(),
        started_at: Instant::now(),
        finished: false,
        exit_code: None,
        log_path: log_path.to_path_buf(),
    };
    {
        let mut guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let runtime = guard.entry(race_id.to_string()).or_default();
        runtime.agents.insert(agent.to_string(), proc.clone());
    }

    let waiter_race = race_id.to_string();
    let waiter_agent = agent.to_string();
    let out_log = log_path.to_path_buf();
    let err_log = log_path.to_path_buf();
    let final_log = log_path.to_path_buf();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let out_handle = stdout.map(|stream| {
        thread::spawn(move || {
            let reader = BufReader::new(stream);
            for line in reader.lines().map_while(Result::ok) {
                append_log_line(&out_log, &line);
            }
        })
    });
    let err_handle = stderr.map(|stream| {
        thread::spawn(move || {
            let reader = BufReader::new(stream);
            for line in reader.lines().map_while(Result::ok) {
                append_log_line(&err_log, &line);
            }
        })
    });
    thread::spawn(move || {
        let status = child.wait();
        let code = status.ok().and_then(|s| s.code());
        if let Some(handle) = out_handle {
            let _ = handle.join();
        }
        if let Some(handle) = err_handle {
            let _ = handle.join();
        }
        append_log_line(
            &final_log,
            &format!(
                "[ai-launcher] agente encerrado (exit code {})",
                code.map(|c| c.to_string())
                    .unwrap_or_else(|| "desconhecido".to_string())
            ),
        );
        let mut guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(runtime) = guard.get_mut(&waiter_race) {
            if let Some(proc) = runtime.agents.get_mut(&waiter_agent) {
                proc.finished = true;
                proc.exit_code = code;
            }
        }
    });
    Ok(proc)
}

fn spawn_agent(
    root: &Path,
    race_id: &str,
    entry: &AgentRecord,
    prompt: &str,
) -> Result<AgentProc, String> {
    let defs = get_cli_definitions();
    let def = defs
        .iter()
        .find(|c| c.key == entry.agent)
        .ok_or_else(|| format!("Agente não suportado: {}", entry.agent))?;
    let program =
        resolve_cli_path(&def.command, &def.extra_paths).unwrap_or_else(|| def.command.clone());
    let argv = agent_argv(&entry.agent, prompt);
    let cwd = PathBuf::from(&entry.worktree);
    let log_path = agent_log_path(root, race_id, &entry.agent);
    spawn_agent_process(race_id, &entry.agent, &program, &argv, &cwd, &log_path)
}

// ---------------------------------------------------------------------------
// Blocking command bodies (injected races root for testability)
// ---------------------------------------------------------------------------

fn current_record(root: &Path, race_id: &str) -> Result<RaceRecord, String> {
    get_race(root, race_id).ok_or_else(|| format!("Corrida não encontrada: {}", race_id))
}

/// Best-effort abort of a start that failed midway: kill spawned agents,
/// drop the runtime entry, undo worktrees/branches and remove the race dir.
fn abort_start(main_repo: &Path, root: &Path, race_id: &str, entries: &[AgentRecord]) {
    let pids: Vec<u32> = {
        let guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard
            .get(race_id)
            .map(|rt| rt.agents.values().map(|p| p.pid).collect())
            .unwrap_or_default()
    };
    for pid in pids {
        let _ = crate::util::kill_tree(pid);
    }
    runtimes()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(race_id);
    rollback_worktrees(main_repo, root, race_id, entries);
    let _ = fs::remove_dir_all(race_dir(root, race_id));
}

fn race_start_blocking_in(
    root: &Path,
    directory: String,
    task_prompt: String,
    agents: Vec<String>,
) -> Result<RaceHandle, String> {
    let dir_str = validate_directory(&directory)?;
    let main_repo = PathBuf::from(&dir_str);
    ensure_git_repo(&main_repo)?;
    require_clean_tree(&main_repo, "iniciar uma corrida")?;
    let agent_keys = validate_agents(&agents)?;

    let prompt = task_prompt.trim();
    if prompt.is_empty() {
        return Err("Descreva a tarefa da corrida: o prompt está vazio".to_string());
    }
    if prompt.chars().count() > MAX_PROMPT_CHARS {
        return Err(format!(
            "O prompt da corrida excede o limite de {} caracteres",
            MAX_PROMPT_CHARS
        ));
    }

    // Pre-flight: every agent binary must exist before anything is mutated.
    for key in &agent_keys {
        let def = get_cli_definitions()
            .into_iter()
            .find(|c| &c.key == key)
            .ok_or_else(|| format!("Agente não suportado: {}", key))?;
        let program =
            resolve_cli_path(&def.command, &def.extra_paths).unwrap_or_else(|| def.command.clone());
        if !command_exists(&program) {
            return Err(format!(
                "O agente '{}' não foi encontrado neste sistema — instale-o antes de iniciar a corrida",
                key
            ));
        }
    }

    let base_sha = head_sha(&main_repo)?;
    let race_id = uuid::Uuid::new_v4().to_string();
    let warnings = detect_repo_warnings(&main_repo);
    let entries = create_all_worktrees(&main_repo, root, &race_id, &base_sha, &agent_keys)?;
    let mut spawned_pids: HashMap<String, u32> = HashMap::new();
    let mut spawned_identities: HashMap<String, ProcessIdentity> = HashMap::new();

    // Placeholder runtime BEFORE the spawns, so waiter threads always find
    // their slot to record the exit code.
    runtimes()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(race_id.clone(), RaceRuntime::default());

    for entry in &entries {
        match spawn_agent(root, &race_id, entry, prompt) {
            Ok(proc) => {
                spawned_pids.insert(entry.agent.clone(), proc.pid);
                // Sign the process NOW (exe path + creation time): this is
                // what lets race_recover tell the real agent apart from a
                // pid the OS handed to an unrelated process after a reboot.
                if let Some(identity) = capture_process_identity(proc.pid) {
                    spawned_identities.insert(entry.agent.clone(), identity);
                }
            }
            Err(error) => {
                abort_start(&main_repo, root, &race_id, &entries);
                return Err(format!(
                    "Falha ao iniciar o agente {}: {}",
                    entry.agent, error
                ));
            }
        }
    }

    let started_at = chrono::Local::now().to_rfc3339();
    // Persist every agent pid + process signature: after an app crash,
    // `race_recover` kills a pid only when the OS still reports the exact
    // recorded identity; without a signature it never kills (fail-safe).
    let agents_with_pids: Vec<AgentRecord> = entries
        .iter()
        .map(|entry| AgentRecord {
            pid: spawned_pids.get(&entry.agent).copied(),
            identity: spawned_identities.get(&entry.agent).cloned(),
            ..entry.clone()
        })
        .collect();
    let record = RaceRecord {
        race_id: race_id.clone(),
        directory: dir_str.clone(),
        base_sha: base_sha.clone(),
        status: "running".to_string(),
        started_at: started_at.clone(),
        finished_at: None,
        warnings: warnings.clone(),
        agents: agents_with_pids,
    };
    if let Err(error) = upsert_race(root, &record) {
        abort_start(&main_repo, root, &race_id, &entries);
        return Err(format!("Falha ao registrar a corrida: {}", error));
    }

    Ok(RaceHandle {
        race_id,
        directory: dir_str,
        base_sha,
        agents: agent_keys,
        branches: entries.iter().map(|e| e.branch.clone()).collect(),
        worktrees: entries.iter().map(|e| e.worktree.clone()).collect(),
        warnings,
        started_at,
    })
}

fn race_status_blocking_in(root: &Path, handle: RaceHandle) -> Result<RaceSnapshot, String> {
    let race_id = validate_race_id(&handle.race_id)?;
    let record = current_record(root, &race_id)?;
    let runtime = {
        let guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard
            .get(&race_id)
            .map(|rt| (rt.cancelled, rt.agents.clone()))
    };

    let mut agents = Vec::with_capacity(record.agents.len());
    for entry in &record.agents {
        if let Some((cancelled, procs)) = &runtime {
            if let Some(proc) = procs.get(&entry.agent) {
                let status = if *cancelled && !(proc.finished && proc.exit_code == Some(0)) {
                    "killed"
                } else if !proc.finished {
                    "running"
                } else if proc.exit_code == Some(0) {
                    "completed"
                } else {
                    "failed"
                };
                agents.push(AgentRuntimeStatus {
                    agent: entry.agent.clone(),
                    status: status.to_string(),
                    pid: Some(proc.pid),
                    exit_code: proc.exit_code,
                    duration_secs: Some(proc.started_at.elapsed().as_secs()),
                    last_log_lines: read_log_tail(&proc.log_path),
                });
                continue;
            }
        }
        // No live runtime for this process (app restarted): the record is the
        // source of truth and per-agent details are unknown until 23.2d wires
        // the boot scan.
        agents.push(AgentRuntimeStatus {
            agent: entry.agent.clone(),
            status: "unknown".to_string(),
            pid: None,
            exit_code: None,
            duration_secs: None,
            last_log_lines: Vec::new(),
        });
    }

    let overall = match record.status.as_str() {
        "adopted" | "cancelled" | "cleaned" => record.status.clone(),
        _ => match &runtime {
            Some((_, procs)) if procs.values().any(|p| !p.finished) => "running".to_string(),
            Some((_, procs))
                if !procs.is_empty()
                    && procs.values().all(|p| p.finished && p.exit_code == Some(0)) =>
            {
                "completed".to_string()
            }
            Some(_) => "failed".to_string(),
            None => record.status.clone(),
        },
    };

    Ok(RaceSnapshot {
        race_id,
        directory: record.directory,
        status: overall,
        base_sha: record.base_sha,
        started_at: record.started_at,
        warnings: record.warnings,
        agents,
    })
}

fn race_diff_blocking_in(
    root: &Path,
    handle: RaceHandle,
    agent: String,
) -> Result<DiffReport, String> {
    let race_id = validate_race_id(&handle.race_id)?;
    let record = current_record(root, &race_id)?;
    let agent_key = validate_race_agent(&record, &agent)?;
    let entry = record
        .agents
        .iter()
        .find(|a| a.agent == agent_key)
        .ok_or_else(|| format!("Agente ausente na corrida: {}", agent_key))?;
    let worktree = validate_worktree_scoped(root, &race_id, entry)?;
    if !worktree.is_dir() {
        return Err(format!(
            "O worktree do agente {} não existe mais (a corrida foi limpa ou o diretório foi removido)",
            agent_key
        ));
    }
    // The Cockpit must show the agent's real work: consolidate uncommitted
    // edits into the race branch BEFORE diffing (see `auto_commit_worktree`).
    auto_commit_worktree(&worktree, &agent_key)?;
    let base = record.base_sha.clone();
    let branch = entry.branch.clone();
    let range = format!("{}...{}", base, branch);
    let numstat = run_git(
        &worktree,
        &["-c", "core.quotepath=false", "diff", "--numstat", &range],
    )?;
    let files = parse_numstat(&numstat);
    let patch_raw = run_git(&worktree, &["-c", "core.quotepath=false", "diff", &range])?;
    let (patch, truncated) = cap_patch(patch_raw);
    let total_adds = files.iter().filter_map(|f| f.adds).sum();
    let total_dels = files.iter().filter_map(|f| f.dels).sum();
    Ok(DiffReport {
        agent: agent_key,
        files,
        total_adds,
        total_dels,
        patch,
        truncated,
    })
}

/// Branch mode (default safe): create an adoption branch at the race tip in
/// the user's repository. The working tree is never touched.
fn adopt_via_branch(
    record: &RaceRecord,
    main_repo: &Path,
    agent_key: &str,
    entry: &AgentRecord,
) -> Result<AdoptReport, String> {
    let short = &record.race_id[..record.race_id.len().min(8)];
    let adopted = format!("race-adopted/{}-{}", agent_key, short);
    let tip = run_git(main_repo, &["rev-parse", "--verify", &entry.branch])
        .map_err(|_| format!("A branch da corrida '{}' não existe mais", entry.branch))?;
    if run_git(main_repo, &["rev-parse", "--verify", &adopted]).is_ok() {
        return Err(format!(
            "A branch de adoção '{}' já existe neste repositório — remova-a antes de adotar novamente",
            adopted
        ));
    }
    let tip = tip.trim().to_string();
    run_git(main_repo, &["branch", &adopted, &tip])?;
    Ok(AdoptReport {
        mode: "branch".to_string(),
        ok: true,
        branch: Some(adopted.clone()),
        conflicts: Vec::new(),
        message: format!(
            "Branch '{}' criada com o resultado do agente {}. Faça o merge quando quiser — a árvore de trabalho não foi alterada.",
            adopted, agent_key
        ),
    })
}

fn first_error_line(raw: &str) -> String {
    let line = raw
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("conflito ao aplicar o patch");
    line.chars().take(200).collect()
}

/// Runs git and returns raw stdout bytes (binary-safe, for `git show`).
fn run_git_bytes(dir: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = git_command(dir, args)
        .output()
        .map_err(|e| format!("Falha ao executar o git: {}", e))?;
    if !output.status.success() {
        let subcommand = args.first().copied().unwrap_or("git");
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git {} falhou: {}", subcommand, stderr.trim()));
    }
    Ok(output.stdout)
}

/// Content of a path at a revision; None when the path does not exist there.
fn blob_content(repo: &Path, revision: &str, path: &str) -> Option<Vec<u8>> {
    run_git_bytes(repo, &["show", &format!("{}:{}", revision, path)]).ok()
}

/// Simulates the three-way content merge for ONE file of the race diff
/// without touching the working tree.
///
/// Why not `git apply --3way --check`: the check only validates patch
/// applicability — it does NOT run the content merge, so a conflicting patch
/// sails through the check and only explodes on the real apply, touching the
/// tree. `git merge-file` runs the same internal merge algorithm with zero
/// side effects, so a clean simulation guarantees the real apply is clean.
///
/// "ours" comes from the main repository's HEAD BLOB, never from `fs::read`
/// (auditor P1): with `core.autocrlf=true` (and any other smudge filter) the
/// on-disk copy holds CRLF while the blobs hold LF, so a disk-based merge
/// flags the whole file as conflicted even though the real apply is clean.
/// The adopt-time clean-tree guard guarantees worktree == index == HEAD, and
/// HEAD's blob is exactly what `git apply --3way` merges against.
fn check_three_way_file(
    repo: &Path,
    base_sha: &str,
    ours_sha: &str,
    branch: &str,
    file: &RaceFileStat,
) -> Result<(), String> {
    let path = file.path.as_str();
    let ours = blob_content(repo, ours_sha, path);
    let base = blob_content(repo, base_sha, path);
    let theirs = blob_content(repo, branch, path);
    match (base.as_ref(), theirs.as_ref(), ours.as_ref()) {
        // Added by the agent: it must not already exist in the main tree.
        (None, Some(_), None) => Ok(()),
        (None, Some(_), Some(_)) => Err("o arquivo já existe na árvore principal".to_string()),
        // Deleted by the agent: the main tree must still match the base.
        (Some(base_bytes), None, Some(ours_bytes)) => {
            if base_bytes == ours_bytes {
                Ok(())
            } else {
                Err("o arquivo foi modificado na árvore principal e o agente o removeu".to_string())
            }
        }
        (Some(_), None, None) => Ok(()),
        // Modified by the agent: simulate the content merge.
        (Some(base_bytes), Some(theirs_bytes), Some(ours_bytes)) => {
            if file.adds.is_none() || file.dels.is_none() {
                // Binary content: git cannot merge it; only a copy identical
                // to the base is safe to replace.
                return if ours_bytes == base_bytes {
                    Ok(())
                } else {
                    Err(
                        "arquivo binário modificado nos dois lados não pode ser mesclado"
                            .to_string(),
                    )
                };
            }
            simulate_merge_file(base_bytes, ours_bytes, theirs_bytes)
        }
        // Modified by the agent but the file is gone from the main tree.
        (Some(_), Some(_), None) => {
            Err("o arquivo não existe mais na árvore principal".to_string())
        }
        // Present in the diff but resolvable at neither revision: a parse or
        // quoting artifact (composite rename path, escaped/quoted path…).
        // FAIL-CLOSED (auditor P0): approving an unvalidatable entry here let
        // the real `git apply --3way` touch the tree unchecked.
        (None, None, _) => Err(
            "arquivo não validável no patch (caminho composto ou escapado) — \
             adote o resultado com o modo branch"
                .to_string(),
        ),
    }
}

/// Runs `git merge-file` over temp copies. Exit code 0 = clean merge; a
/// positive code is the conflict count; the temp directory is always removed.
fn simulate_merge_file(base: &[u8], ours: &[u8], theirs: &[u8]) -> Result<(), String> {
    let token = uuid::Uuid::new_v4().simple().to_string();
    let dir = std::env::temp_dir().join(format!("ai-launcher-race-{}", token));
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Falha ao preparar a simulação de merge: {}", e))?;
    let ours_path = dir.join("ours");
    let base_path = dir.join("base");
    let theirs_path = dir.join("theirs");
    let outcome = (|| {
        for (path, bytes) in [
            (&ours_path, ours),
            (&base_path, base),
            (&theirs_path, theirs),
        ] {
            fs::write(path, bytes)
                .map_err(|e| format!("Falha ao preparar a simulação de merge: {}", e))?;
        }
        let output = git_command(
            &dir,
            &[
                "merge-file",
                &ours_path.to_string_lossy(),
                &base_path.to_string_lossy(),
                &theirs_path.to_string_lossy(),
            ],
        )
        .output()
        .map_err(|e| format!("Falha ao simular o merge: {}", e))?;
        match output.status.code() {
            Some(0) => Ok(()),
            Some(_) => Err(first_error_line(&String::from_utf8_lossy(&output.stdout))),
            None => Err("o git não conseguiu concluir a simulação de merge".to_string()),
        }
    })();
    let _ = fs::remove_dir_all(&dir);
    outcome
}

/// Apply mode: atomic. The whole diff is pre-validated file by file with the
/// real three-way merge simulation ([`check_three_way_file`]); only when
/// EVERY file merges clean is `git apply --3way` executed. A failed check
/// yields a per-file conflict report and leaves the tree untouched.
fn adopt_via_apply(
    record: &RaceRecord,
    main_repo: &Path,
    agent_key: &str,
    entry: &AgentRecord,
) -> Result<AdoptReport, String> {
    let base = record.base_sha.clone();
    let branch = entry.branch.clone();
    let range = format!("{}...{}", base, branch);
    let numstat = run_git(
        main_repo,
        &["-c", "core.quotepath=false", "diff", "--numstat", &range],
    )?;
    let files = parse_numstat(&numstat);
    if files.is_empty() {
        return Ok(AdoptReport {
            mode: "apply".to_string(),
            ok: true,
            branch: None,
            conflicts: Vec::new(),
            message: format!("O agente {} não produziu mudanças para aplicar", agent_key),
        });
    }
    // The current main-repository HEAD is "ours" for the merge simulation —
    // the same side `git apply --3way` uses. The clean-tree guard revalidated
    // above guarantees worktree == index == HEAD.
    let ours_sha = head_sha(main_repo)?;
    let mut conflicts = Vec::new();
    for file in &files {
        // Rename entries arrive from `--numstat` as a composite path
        // (`old.txt => new.txt`), which cannot be validated file-by-file.
        // FAIL-CLOSED (auditor P0): without this gate the entry sailed
        // through validation and the real `git apply --3way` could write
        // conflict markers into the user's tree. Never attempt to apply.
        if file.path.contains(" => ") {
            conflicts.push(AdoptConflict {
                path: file.path.clone(),
                reason: "renomeação no patch não é validável pelo modo apply desta versão — \
                         adote o resultado com o modo branch"
                    .to_string(),
            });
            continue;
        }
        if let Err(reason) = check_three_way_file(main_repo, &base, &ours_sha, &branch, file) {
            conflicts.push(AdoptConflict {
                path: file.path.clone(),
                reason,
            });
        }
    }
    if !conflicts.is_empty() {
        return Ok(AdoptReport {
            mode: "apply".to_string(),
            ok: false,
            branch: None,
            conflicts,
            message: "Aplicação bloqueada: o patch conflita com o estado atual do repositório \
                      e a árvore de trabalho NÃO foi alterada. Resolva os conflitos indicados \
                      ou use o modo branch."
                .to_string(),
        });
    }
    let patch = run_git(main_repo, &["-c", "core.quotepath=false", "diff", &range])?;
    if patch.trim().is_empty() {
        return Ok(AdoptReport {
            mode: "apply".to_string(),
            ok: true,
            branch: None,
            conflicts: Vec::new(),
            message: format!("O agente {} não produziu mudanças para aplicar", agent_key),
        });
    }
    run_git_stdin(
        main_repo,
        &["apply", "--3way", "--whitespace=nowarn"],
        patch.as_bytes(),
    )
    .map_err(|e| format!("Falha ao aplicar o patch: {}", e))?;
    Ok(AdoptReport {
        mode: "apply".to_string(),
        ok: true,
        branch: None,
        conflicts: Vec::new(),
        message: format!(
            "Patch do agente {} aplicado com sucesso no diretório principal",
            agent_key
        ),
    })
}

fn race_adopt_blocking_in(
    root: &Path,
    handle: RaceHandle,
    agent: String,
    mode: AdoptMode,
) -> Result<AdoptReport, String> {
    let race_id = validate_race_id(&handle.race_id)?;
    let record = current_record(root, &race_id)?;
    let agent_key = validate_race_agent(&record, &agent)?;
    let entry = record
        .agents
        .iter()
        .find(|a| a.agent == agent_key)
        .ok_or_else(|| format!("Agente ausente na corrida: {}", agent_key))?;
    // Adoption diffs `base_sha...race-branch`, so uncommitted agent work would
    // be silently dropped. Snapshot it first (same guard as race_diff; a
    // missing worktree means the race was already cleaned — nothing to save).
    let worktree = validate_worktree_scoped(root, &race_id, entry)?;
    if worktree.is_dir() {
        auto_commit_worktree(&worktree, &agent_key)?;
    }
    let main_repo = PathBuf::from(validate_directory(&record.directory)?);
    ensure_git_repo(&main_repo)?;
    // Guarda do design: a árvore limpa vale no start E é revalidada AGORA,
    // no momento do adopt — o usuário pode ter sujado a árvore no meio.
    require_clean_tree(&main_repo, "adotar o resultado de um agente")?;
    let report = match mode {
        AdoptMode::Branch => adopt_via_branch(&record, &main_repo, &agent_key, entry)?,
        AdoptMode::Apply => adopt_via_apply(&record, &main_repo, &agent_key, entry)?,
    };
    if report.ok {
        update_race(root, &race_id, |r| {
            r.status = "adopted".to_string();
            r.finished_at = Some(chrono::Local::now().to_rfc3339());
        })
        .map_err(|e| e.to_string())?;
    }
    Ok(report)
}

fn race_cancel_blocking_in(root: &Path, handle: RaceHandle) -> Result<(), String> {
    let race_id = validate_race_id(&handle.race_id)?;
    current_record(root, &race_id)?;
    // Without a live runtime (app restarted mid-race) there is nothing to
    // kill, but the persisted record is still flipped to "cancelled" so the
    // race stops being reported as running/orphan.
    let pids: Vec<u32> = {
        let mut guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        match guard.get_mut(&race_id) {
            Some(runtime) => {
                runtime.cancelled = true;
                runtime
                    .agents
                    .values()
                    .filter(|p| !p.finished)
                    .map(|p| p.pid)
                    .collect()
            }
            None => Vec::new(),
        }
    };
    for pid in pids {
        if let Err(error) = crate::util::kill_tree(pid) {
            log_event(
                "race_cancel",
                &format!("falha ao interromper o pid {}: {}", pid, error),
            );
        }
    }
    update_race(root, &race_id, |r| {
        if r.status == "running" {
            r.status = "cancelled".to_string();
            r.finished_at = Some(chrono::Local::now().to_rfc3339());
        }
    })
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn race_cleanup_blocking_in(
    root: &Path,
    handle: RaceHandle,
    keep_days: Option<u32>,
) -> Result<RaceCleanupReport, String> {
    let race_id = validate_race_id(&handle.race_id)?;
    let record = current_record(root, &race_id)?;
    {
        let guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(runtime) = guard.get(&race_id) {
            if runtime.agents.values().any(|p| !p.finished) {
                return Err(
                    "A corrida ainda está em execução — cancele-a antes de solicitar a limpeza"
                        .to_string(),
                );
            }
        }
    }
    let keep = keep_days.unwrap_or(DEFAULT_KEEP_DAYS);
    let end_text = record
        .finished_at
        .clone()
        .unwrap_or_else(|| record.started_at.clone());
    let end = chrono::DateTime::parse_from_rfc3339(&end_text).map_err(|_| {
        "O registro da corrida tem uma data inválida — impossível calcular a retenção".to_string()
    })?;
    let elapsed_secs = chrono::Utc::now()
        .signed_duration_since(end.with_timezone(&chrono::Utc))
        .num_seconds();
    let keep_secs = i64::from(keep) * 86_400;
    if elapsed_secs < keep_secs {
        // div_ceil manual (int_roundings is still unstable on our toolchain).
        let remaining_secs = keep_secs - elapsed_secs;
        let remaining_days =
            (remaining_secs / 86_400 + i64::from(remaining_secs % 86_400 != 0)).max(1);
        return Ok(RaceCleanupReport {
            race_id,
            removed_worktrees: Vec::new(),
            removed_branches: Vec::new(),
            pruned: false,
            skipped_reason: Some(format!(
                "Janela de retenção não expirada — faltam {} dia(s)",
                remaining_days
            )),
            unverified_processes: Vec::new(),
        });
    }

    // The user's project directory can disappear between the race and the
    // graveyard cleanup (moved/deleted project). With no repository left there
    // is nothing to detach: the worktree files under the races root are removed
    // directly, the record becomes "cleaned" history and the report explains
    // what happened instead of failing with a path error.
    if !Path::new(&record.directory).is_dir() {
        let mut removed = Vec::new();
        for entry in &record.agents {
            if Path::new(&entry.worktree).exists() && fs::remove_dir_all(&entry.worktree).is_ok() {
                removed.push(entry.worktree.clone());
            }
        }
        let _ = fs::remove_dir_all(race_dir(root, &race_id));
        runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&race_id);
        update_race(root, &race_id, |r| {
            r.status = "cleaned".to_string();
            if r.finished_at.is_none() {
                r.finished_at = Some(chrono::Local::now().to_rfc3339());
            }
        })
        .map_err(|e| e.to_string())?;
        return Ok(RaceCleanupReport {
            race_id,
            removed_worktrees: removed,
            removed_branches: Vec::new(),
            pruned: false,
            skipped_reason: Some(
                "O diretório do projeto não existe mais — apenas o registro e os logs foram removidos"
                    .to_string(),
            ),
            unverified_processes: Vec::new(),
        });
    }

    let main_repo = PathBuf::from(validate_directory(&record.directory)?);
    let mut removed_worktrees = Vec::new();
    let mut removed_branches = Vec::new();
    for entry in &record.agents {
        if Path::new(&entry.worktree).exists()
            && run_git(
                &main_repo,
                &["worktree", "remove", "--force", entry.worktree.as_str()],
            )
            .is_ok()
        {
            removed_worktrees.push(entry.worktree.clone());
        } else {
            log_event(
                "race_cleanup",
                &format!("worktree não removido: {}", entry.worktree),
            );
        }
    }
    // Re-gate condition: the prune is scoped to this race's worktree metadata
    // only — a global `git worktree prune` would also reap the user's own
    // orphaned worktrees. It runs BEFORE the branch deletions: stale metadata
    // of an externally deleted worktree still marks the race branch as
    // checked out, which would make `git branch -D` refuse.
    let pruned = prune_race_worktree_metadata(&main_repo, root, &race_id);
    for entry in &record.agents {
        if run_git(&main_repo, &["branch", "-D", &entry.branch]).is_ok() {
            removed_branches.push(entry.branch.clone());
        }
    }
    let _ = fs::remove_dir_all(race_dir(root, &race_id));
    runtimes()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(&race_id);
    update_race(root, &race_id, |r| {
        r.status = "cleaned".to_string();
        if r.finished_at.is_none() {
            r.finished_at = Some(chrono::Local::now().to_rfc3339());
        }
    })
    .map_err(|e| e.to_string())?;
    Ok(RaceCleanupReport {
        race_id,
        removed_worktrees,
        removed_branches,
        pruned,
        skipped_reason: None,
        unverified_processes: Vec::new(),
    })
}

fn race_scan_orphans_blocking_in(root: &Path) -> OrphanScanReport {
    let live: Vec<String> = {
        let guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.keys().cloned().collect()
    };
    let orphans = scan_orphans(root, &live)
        .into_iter()
        .map(|record| OrphanRace {
            race_id: record.race_id.clone(),
            directory: record.directory.clone(),
            started_at: record.started_at.clone(),
            agents: record.agents.iter().map(|a| a.agent.clone()).collect(),
            worktree_root: race_dir(root, &record.race_id)
                .to_string_lossy()
                .into_owned(),
            base_sha: record.base_sha.clone(),
            branches: record.agents.iter().map(|a| a.branch.clone()).collect(),
            worktrees: record.agents.iter().map(|a| a.worktree.clone()).collect(),
        })
        .collect();
    OrphanScanReport { orphans }
}

/// Crash recovery for one orphaned race: terminates the persisted agent
/// pids — ONLY after re-reading their identity from the OS (executable path
/// and creation timestamp) and matching it against the signature recorded
/// at spawn, so a pid reused by an unrelated process after a reboot is
/// never killed. Unverifiable processes are skipped, listed in the report's
/// `unverified_processes`, and the disk cleanup still runs (worktrees,
/// branches, scoped prune, race dir), leaving the record as "cleaned"
/// history. Refuses races whose runtime is alive in THIS session — those
/// are cancelled, not recovered — and races that are not orphaned at all.
fn race_recover_blocking_in(root: &Path, handle: RaceHandle) -> Result<RaceCleanupReport, String> {
    let race_id = validate_race_id(&handle.race_id)?;
    let record = current_record(root, &race_id)?;
    if record.status != "running" {
        return Err(format!(
            "A corrida {} não está órfã (status {}) — nada a recuperar",
            race_id, record.status
        ));
    }
    {
        let guard = runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(runtime) = guard.get(&race_id) {
            if runtime.agents.values().any(|p| !p.finished) {
                return Err(
                    "A corrida está ativa nesta sessão — cancele-a em vez de recuperar".to_string(),
                );
            }
        }
    }
    let mut unverified: Vec<String> = Vec::new();
    for entry in &record.agents {
        let Some(pid) = entry.pid else { continue };
        let Some(expected) = entry.identity.as_ref() else {
            // Legacy record (or failed capture): never kill blind.
            unverified.push(format!(
                "{}: sem assinatura persistida — processo não verificado, não finalizado",
                entry.agent
            ));
            continue;
        };
        if !process_identity_matches(pid, expected) {
            // Signature mismatch (pid reused) or unreadable: spare it.
            unverified.push(format!(
                "{}: identidade do pid {} não confere — processo não verificado, não finalizado",
                entry.agent, pid
            ));
            continue;
        }
        if let Err(error) = crate::util::kill_tree(pid) {
            // The process may have exited on its own between the check and
            // the kill; the disk cleanup below is the source of truth.
            log_event(
                "race_recover",
                &format!("falha ao interromper o pid {}: {}", pid, error),
            );
        }
    }
    runtimes()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(&race_id);
    // The race ended when the app died: stamp the end time so the retention
    // clock starts from the crash, then clean up immediately (keep_days = 0).
    update_race(root, &race_id, |r| {
        if r.finished_at.is_none() {
            r.finished_at = Some(chrono::Local::now().to_rfc3339());
        }
    })
    .map_err(|e| e.to_string())?;
    let mut report = race_cleanup_blocking_in(root, handle, Some(0))?;
    report.unverified_processes = unverified;
    Ok(report)
}

/// Graveyard listing: every terminal race record, newest first, with a flag
/// telling whether the worktrees are still on disk (restore with live diffs)
/// or the race is archived (read-only record view).
fn race_list_history_blocking_in(root: &Path) -> Vec<RaceHistoryEntry> {
    let mut entries: Vec<RaceHistoryEntry> = load_state(root)
        .races
        .into_iter()
        .filter(|r| r.status != "running")
        .map(|r| RaceHistoryEntry {
            worktrees_present: !r.agents.is_empty()
                && r.agents.iter().all(|a| Path::new(&a.worktree).exists()),
            race_id: r.race_id.clone(),
            directory: r.directory.clone(),
            base_sha: r.base_sha.clone(),
            status: r.status.clone(),
            started_at: r.started_at.clone(),
            finished_at: r.finished_at.clone(),
            agents: r.agents.iter().map(|a| a.agent.clone()).collect(),
            branches: r.agents.iter().map(|a| a.branch.clone()).collect(),
            worktrees: r.agents.iter().map(|a| a.worktree.clone()).collect(),
        })
        .collect();
    entries.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    entries
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

async fn run_blocking<T, F>(work: F, action: &str) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| AppError::new(format!("Falha interna ao {}: {}", action, error)))?
        .map_err(AppError::from)
}

/// Starts a race: validates the repository (git, clean tree), the agent
/// allowlist (≤ 3, no duplicates, binaries present), freezes `base_sha`,
/// creates one worktree per agent outside the repository, spawns each CLI
/// in non-interactive mode and records the race for crash recovery.
#[tauri::command]
pub async fn race_start(
    directory: String,
    task_prompt: String,
    agents: Vec<String>,
) -> Result<RaceHandle, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            race_start_blocking_in(&root, directory, task_prompt, agents)
        },
        "iniciar a corrida",
    )
    .await
}

/// Lightweight poll: process liveness, exit codes, log tail and duration.
#[tauri::command]
pub async fn race_status(handle: RaceHandle) -> Result<RaceSnapshot, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            race_status_blocking_in(&root, handle)
        },
        "consultar o status da corrida",
    )
    .await
}

/// Diff of one agent against the frozen base: `base_sha...race-branch`
/// (three-dot), file stats via `--numstat` plus a patch capped at 2 MB.
/// Uncommitted work in the agent worktree is auto-committed on the race
/// branch first, so agents that edit without committing still show up here.
#[tauri::command]
pub async fn race_diff(handle: RaceHandle, agent: String) -> Result<DiffReport, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            race_diff_blocking_in(&root, handle, agent)
        },
        "gerar o diff do agente",
    )
    .await
}

/// Adopts one agent's result. `mode`:
/// - `branch` (default, safe): adoption branch at the race tip, tree untouched;
/// - `apply`: atomic `git apply --3way` with a pre-check — on conflict, a
///   per-file report is returned and the tree is never touched.
#[tauri::command]
pub async fn race_adopt(
    handle: RaceHandle,
    agent: String,
    mode: Option<AdoptMode>,
) -> Result<AdoptReport, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            race_adopt_blocking_in(&root, handle, agent, mode.unwrap_or(AdoptMode::Branch))
        },
        "adotar o resultado do agente",
    )
    .await
}

/// Kills the agent process trees (shared `util::kill_tree`) and marks the
/// race as cancelled. Safe to call again after an app restart (only the
/// persisted record is flipped).
#[tauri::command]
pub async fn race_cancel(handle: RaceHandle) -> Result<(), AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            race_cancel_blocking_in(&root, handle)
        },
        "cancelar a corrida",
    )
    .await
}

/// Removes the race worktrees and branches after the retention window
/// (`keep_days`, default 7; 0 = immediate), prunes the race's stale worktree
/// metadata (scoped — never a global prune of the user's repository) and
/// drops the per-race directory (logs included). The `races.json` index is
/// never removed — the record is kept as history with status "cleaned".
#[tauri::command]
pub async fn race_cleanup(
    handle: RaceHandle,
    keep_days: Option<u32>,
) -> Result<RaceCleanupReport, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            race_cleanup_blocking_in(&root, handle, keep_days)
        },
        "limpar a corrida",
    )
    .await
}

/// Boot-time primitive (wiring lands in 23.2d): races recorded as "running"
/// that have no live runtime in this process — i.e. the app died mid-race.
#[tauri::command]
pub async fn race_scan_orphans() -> Result<OrphanScanReport, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            Ok(race_scan_orphans_blocking_in(&root))
        },
        "varrer corridas órfãs",
    )
    .await
}

/// Crash recovery (23.2d): kills the persisted agent pids of an orphaned
/// race and immediately cleans up its worktrees, branches and race
/// directory. The record stays as "cleaned" history.
#[tauri::command]
pub async fn race_recover(handle: RaceHandle) -> Result<RaceCleanupReport, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            race_recover_blocking_in(&root, handle)
        },
        "recuperar a corrida órfã",
    )
    .await
}

/// Graveyard listing (23.2d): terminal race records for the "Corridas
/// anteriores" section, newest first.
#[tauri::command]
pub async fn race_list_history() -> Result<Vec<RaceHistoryEntry>, AppError> {
    run_blocking(
        move || {
            let root = races_root().map_err(|e| e.to_string())?;
            Ok(race_list_history_blocking_in(&root))
        },
        "listar as corridas anteriores",
    )
    .await
}

// ---------------------------------------------------------------------------
// Tests — matrix from design §5 (real temp git repos via tempfile)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    type TempRoot = tempfile::TempDir;

    fn temp_race_root() -> TempRoot {
        tempfile::tempdir().expect("diretório temporário de corridas")
    }

    fn git(dir: &Path, args: &[&str]) {
        run_git(dir, args).unwrap_or_else(|e| panic!("git {:?} falhou: {}", args, e));
    }

    fn commit_all(dir: &Path, message: &str) {
        run_git(dir, &["add", "-A"]).expect("git add");
        run_git(dir, &["commit", "-m", message]).expect("git commit");
    }

    /// Real temp git repository with one initial commit (any default branch).
    fn temp_repo(name: &str) -> (TempRoot, PathBuf) {
        let tmp = tempfile::tempdir().expect("repositório temporário");
        let repo = tmp.path().join(name);
        fs::create_dir_all(&repo).expect("criar repositório");
        git(&repo, &["init"]);
        // Determinismo de plataforma: herdar core.autocrlf do ambiente (true no
        // Git for Windows) faria o apply --3way devolver CRLF e quebrar os
        // asserts de conteúdo. O teste de autocrlf sobrescreve depois.
        git(&repo, &["config", "core.autocrlf", "false"]);
        git(&repo, &["config", "user.email", "race-test@example.com"]);
        git(&repo, &["config", "user.name", "Race Test"]);
        fs::write(repo.join("file.txt"), "linha1\nlinha2\n").expect("arquivo base");
        commit_all(&repo, "base");
        (tmp, repo)
    }

    /// Builds a race record + worktrees/branches WITHOUT spawning agent CLIs
    /// (spawn is covered separately with a real `git` child process).
    fn manual_race(root: &Path, repo: &Path, agents: &[&str]) -> RaceRecord {
        let race_id = uuid::Uuid::new_v4().to_string();
        let base_sha = head_sha(repo).expect("HEAD do repositório");
        let keys: Vec<String> = agents.iter().map(|a| a.to_string()).collect();
        let entries =
            create_all_worktrees(repo, root, &race_id, &base_sha, &keys).expect("criar worktrees");
        let record = RaceRecord {
            race_id: race_id.clone(),
            directory: repo.to_string_lossy().into_owned(),
            base_sha,
            status: "running".to_string(),
            started_at: chrono::Local::now().to_rfc3339(),
            finished_at: None,
            warnings: Vec::new(),
            agents: entries,
        };
        upsert_race(root, &record).expect("registrar corrida");
        record
    }

    fn handle_of(record: &RaceRecord) -> RaceHandle {
        RaceHandle {
            race_id: record.race_id.clone(),
            directory: record.directory.clone(),
            base_sha: record.base_sha.clone(),
            agents: record.agents.iter().map(|a| a.agent.clone()).collect(),
            branches: record.agents.iter().map(|a| a.branch.clone()).collect(),
            worktrees: record.agents.iter().map(|a| a.worktree.clone()).collect(),
            warnings: record.warnings.clone(),
            started_at: record.started_at.clone(),
        }
    }

    fn worktree_of(record: &RaceRecord, index: usize) -> PathBuf {
        PathBuf::from(&record.agents[index].worktree)
    }

    fn drop_runtime(race_id: &str) {
        runtimes()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(race_id);
    }

    // --- UUID / branch derivation ------------------------------------------

    #[test]
    fn branch_names_are_uuid_derived_and_agent_scoped() {
        let id = uuid::Uuid::new_v4().to_string();
        assert_eq!(branch_name(&id, "claude"), format!("race/{}/claude", id));
        assert_ne!(branch_name(&id, "codex"), branch_name(&id, "claude"));
        assert!(validate_race_id(&id).is_ok());
        for bad in ["", "../evil", "a b", "x/y", "a;b", &"x".repeat(65)] {
            assert!(validate_race_id(bad).is_err(), "id inválido aceito: {bad}");
        }
    }

    // --- Allowlist gate ------------------------------------------------------

    #[test]
    fn agent_allowlist_rejects_duplicates_unknown_and_over_limit() {
        assert!(validate_agents(&[]).is_err(), "corrida sem agentes");
        assert!(validate_agents(&["claude".into(), "claude".into()]).is_err());
        assert!(validate_agents(&["cli-inexistente".into()]).is_err());
        let four: Vec<String> = ["claude", "codex", "aider", "goose"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        assert!(validate_agents(&four).is_err(), "mais de 3 agentes");
        let ok = validate_agents(&[" Claude ".into(), "codex".into()]).expect("agentes válidos");
        assert_eq!(ok, vec!["claude".to_string(), "codex".to_string()]);
    }

    #[test]
    fn prompt_is_always_the_last_argument_and_never_a_flag() {
        let hostile = "arruma o bug --help; rm -rf /";
        for agent in ["claude", "codex", "aider", "goose", "cli-desconhecido"] {
            let argv = agent_argv(agent, hostile);
            assert_eq!(argv.last().expect("argv"), hostile, "agente {agent}");
        }
        assert_eq!(
            agent_argv("claude", "tarefa"),
            vec!["-p".to_string(), "tarefa".to_string()]
        );
    }

    // --- numstat / patch cap -------------------------------------------------

    #[test]
    fn numstat_parses_files_binaries_and_skips_junk() {
        let output = "3\t1\tsrc/a.rs\n-\t-\tmedia/logo.png\n\n12\t0\tnovo.ts\n";
        let files = parse_numstat(output);
        assert_eq!(files.len(), 3);
        assert_eq!(files[0].adds, Some(3));
        assert_eq!(files[0].dels, Some(1));
        assert_eq!(files[0].path, "src/a.rs");
        assert_eq!(files[1].adds, None, "arquivo binário");
        assert_eq!(files[1].dels, None);
        assert_eq!(files[2].path, "novo.ts");
        assert_eq!(files[2].adds, Some(12));
    }

    #[test]
    fn patch_is_capped_with_truncation_flag_and_char_safety() {
        let small = "a".repeat(1_000);
        let (patch, truncated) = cap_patch(small.clone());
        assert!(!truncated);
        assert_eq!(patch, small);

        let big = "x".repeat(MAX_PATCH_BYTES + 10);
        let (patch, truncated) = cap_patch(big);
        assert!(truncated);
        assert!(patch.contains("truncado"));
        assert!(patch.len() < MAX_PATCH_BYTES + 100);

        // Multibyte content must not be cut mid-character.
        let multibyte = "é".repeat(MAX_PATCH_BYTES / 2 + 4);
        let (patch, truncated) = cap_patch(multibyte);
        assert!(truncated);
        assert!(patch.is_char_boundary(patch.len().saturating_sub(1)));
    }

    #[test]
    fn log_tail_is_bounded_in_lines_and_chars() {
        let tmp = tempfile::tempdir().expect("tempdir de log");
        let log = tmp.path().join("claude.log");
        let body: String = (0..200).map(|i| format!("linha {}\n", i)).collect();
        fs::write(&log, body).expect("gravar log");
        let tail = read_log_tail(&log);
        assert_eq!(tail.len(), LOG_TAIL_LINES);
        assert_eq!(tail.last().expect("última linha"), "linha 199");
        assert!(tail.iter().map(|l| l.chars().count() + 1).sum::<usize>() <= MAX_LOG_CHARS);
    }

    // --- Start guards --------------------------------------------------------

    #[test]
    fn start_rejects_dirty_tree_before_any_mutation() {
        let (_tmp, repo) = temp_repo("start-dirty");
        fs::write(repo.join("file.txt"), "mudança não commitada\n").expect("sujar árvore");
        let root = temp_race_root();
        let error = race_start_blocking_in(
            root.path(),
            repo.to_string_lossy().into_owned(),
            "tarefa".to_string(),
            vec!["claude".to_string()],
        )
        .expect_err("árvore suja deve bloquear o start");
        assert!(error.contains("limpa"), "mensagem: {error}");
        assert!(root.path().read_dir().expect("raiz").next().is_none());
    }

    #[test]
    fn start_rejects_non_git_directory() {
        let empty = tempfile::tempdir().expect("diretório vazio");
        let root = temp_race_root();
        let error = race_start_blocking_in(
            root.path(),
            empty.path().to_string_lossy().into_owned(),
            "tarefa".to_string(),
            vec!["claude".to_string()],
        )
        .expect_err("diretório sem git deve falhar");
        assert!(
            error.contains("repositório") || error.contains("git"),
            "mensagem: {error}"
        );
    }

    #[test]
    fn start_validates_prompt_and_agent_list() {
        let (_tmp, repo) = temp_repo("start-validation");
        let root = temp_race_root();
        let dir = repo.to_string_lossy().into_owned();
        let error = race_start_blocking_in(
            root.path(),
            dir.clone(),
            "   ".to_string(),
            vec!["claude".to_string()],
        )
        .expect_err("prompt vazio deve falhar");
        assert!(error.contains("vazio"), "mensagem: {error}");
        let error = race_start_blocking_in(
            root.path(),
            dir,
            "tarefa".to_string(),
            vec!["claude".to_string(), "claude".to_string()],
        )
        .expect_err("agente duplicado deve falhar");
        assert!(error.contains("duplicado"), "mensagem: {error}");
    }

    #[test]
    fn start_detects_submodules_and_lfs_warnings() {
        let (_tmp, repo) = temp_repo("start-warnings");
        fs::write(
            repo.join(".gitmodules"),
            "[submodule \"lib\"]\n\tpath = lib\n\turl = https://example.com/lib.git\n",
        )
        .expect("gitmodules");
        fs::write(
            repo.join(".gitattributes"),
            "assets/*.bin filter=lfs diff=lfs merge=lfs -text\n",
        )
        .expect("gitattributes");
        commit_all(&repo, "infra");
        let warnings = detect_repo_warnings(&repo);
        assert!(
            warnings.iter().any(|w| w.contains("submódulo")),
            "{warnings:?}"
        );
        assert!(warnings.iter().any(|w| w.contains("LFS")), "{warnings:?}");
        assert!(
            warnings.iter().any(|w| w.contains("node_modules")),
            "aviso de dependências ausente: {warnings:?}"
        );
    }

    #[test]
    fn failed_worktree_creation_rolls_back_previous_ones() {
        let (_tmp, repo) = temp_repo("start-rollback");
        let root = temp_race_root();
        let race_id = uuid::Uuid::new_v4().to_string();
        let base = head_sha(&repo).expect("HEAD");
        let collision = agent_worktree(root.path(), &race_id, "goose");
        fs::create_dir_all(collision.parent().expect("pai")).expect("mkdir");
        fs::write(&collision, "arquivo que bloqueia o worktree").expect("colisão");
        let error = create_all_worktrees(
            &repo,
            root.path(),
            &race_id,
            &base,
            &["claude".to_string(), "goose".to_string()],
        )
        .expect_err("colisão deve falhar");
        assert!(error.contains("goose"), "mensagem: {error}");
        assert!(
            !agent_worktree(root.path(), &race_id, "claude").exists(),
            "worktree do primeiro agente deveria ter sido desfeito"
        );
        let branches = run_git(&repo, &["branch", "--list", "race/*"]).expect("branch list");
        assert!(branches.trim().is_empty(), "branches residuais: {branches}");
    }

    // --- Worktrees outside the repo -------------------------------------------

    #[test]
    fn worktrees_outside_repo_are_invisible_to_main_status() {
        let (_tmp, repo) = temp_repo("invisible");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude", "goose"]);
        let status = run_git(&repo, &["status", "--porcelain"]).expect("status");
        assert!(status.trim().is_empty(), "status poluído: {status}");
        assert!(
            !repo.join("races").exists(),
            "nenhum artefato dentro do repo"
        );
        for entry in &record.agents {
            let worktree = Path::new(&entry.worktree);
            assert!(worktree.is_dir(), "worktree criado: {}", entry.worktree);
            assert!(
                !entry.worktree.starts_with(repo.to_string_lossy().as_ref()),
                "worktree não pode viver dentro do repositório"
            );
        }
        // Cleanup so the branches do not leak into other tests' repos (they
        // are per-test temp repos, but the runtime registry is global).
        let _ = fs::remove_dir_all(root.path());
    }

    // --- Frozen base SHA -------------------------------------------------------

    #[test]
    fn frozen_base_sha_keeps_diff_stable_when_default_branch_moves() {
        let (_tmp, repo) = temp_repo("frozen-base");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        fs::write(worktree.join("agente.txt"), "mudança do agente\n").expect("mudança");
        commit_all(&worktree, "trabalho do agente");

        // The default branch advances with an UNRELATED commit after start.
        fs::write(repo.join("outro.txt"), "commit feito durante a corrida\n").expect("outro");
        commit_all(&repo, "avanço da branch padrão");

        let report = race_diff_blocking_in(root.path(), handle_of(&record), "claude".to_string())
            .expect("diff");
        let paths: Vec<&str> = report.files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(
            paths,
            vec!["agente.txt"],
            "diff contaminado pelo avanço da default"
        );
        assert_eq!(report.total_adds, 1);
        assert!(report.patch.contains("agente.txt"));
        assert!(!report.truncated);
    }

    #[test]
    fn repos_with_master_default_are_supported() {
        let tmp = tempfile::tempdir().expect("repositório master temporário");
        let repo = tmp.path().join("master-repo");
        fs::create_dir_all(&repo).expect("mkdir");
        git(&repo, &["init", "-b", "master"]);
        git(&repo, &["config", "user.email", "race-test@example.com"]);
        git(&repo, &["config", "user.name", "Race Test"]);
        fs::write(repo.join("file.txt"), "linha1\nlinha2\n").expect("arquivo base");
        commit_all(&repo, "base em master");
        assert_eq!(
            run_git(&repo, &["symbolic-ref", "--short", "HEAD"])
                .expect("branch padrão")
                .trim(),
            "master"
        );

        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["codex"]);
        let worktree = worktree_of(&record, 0);
        fs::write(worktree.join("novo.txt"), "conteúdo\n").expect("mudança");
        commit_all(&worktree, "trabalho em master");
        let report = race_diff_blocking_in(root.path(), handle_of(&record), "codex".to_string())
            .expect("diff");
        assert_eq!(report.files.len(), 1);
        let adoption = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "codex".to_string(),
            AdoptMode::Branch,
        )
        .expect("adopt");
        assert!(adoption.ok);
        assert!(adoption.branch.is_some());
    }

    // --- Auto-commit of uncommitted agent work (v23.2c) ------------------------

    #[test]
    fn race_diff_auto_commits_uncommitted_agent_work() {
        let (_tmp, repo) = temp_repo("autocommit-diff");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        // The Claude Code pattern: real edits, never a `git commit`.
        fs::write(worktree.join("agente.txt"), "trabalho não commitado\n").expect("novo arquivo");
        fs::write(worktree.join("file.txt"), "linha1 editada\nlinha2\n").expect("edição");

        let report = race_diff_blocking_in(root.path(), handle_of(&record), "claude".to_string())
            .expect("diff deve incluir o trabalho não commitado");
        let paths: Vec<&str> = report.files.iter().map(|f| f.path.as_str()).collect();
        assert!(
            paths.contains(&"agente.txt") && paths.contains(&"file.txt"),
            "mudanças não commitadas ausentes do diff: {paths:?}"
        );
        assert!(report.patch.contains("agente.txt"));

        // The snapshot commit exists on the race branch and the tree is clean.
        assert!(
            run_git(&worktree, &["status", "--porcelain"])
                .expect("status")
                .trim()
                .is_empty(),
            "worktree deveria ter ficado limpo após o snapshot"
        );
        let last = run_git(&worktree, &["log", "--format=%s", "-n", "1"]).expect("log");
        assert!(
            last.contains("snapshot do agente"),
            "commit automático ausente: {last}"
        );
        let ahead = run_git(
            &worktree,
            &[
                "rev-list",
                "--count",
                &format!("{}..{}", record.base_sha, record.agents[0].branch),
            ],
        )
        .expect("rev-list");
        assert_eq!(ahead.trim(), "1", "exatamente um commit de snapshot");
        // The user's main repository is untouched by the auto-commit.
        assert!(run_git(&repo, &["status", "--porcelain"])
            .expect("status principal")
            .trim()
            .is_empty());
    }

    #[test]
    fn race_diff_with_clean_worktree_makes_no_extra_commit() {
        let (_tmp, repo) = temp_repo("autocommit-clean");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        fs::write(worktree.join("agente.txt"), "trabalho commitado\n").expect("mudança");
        run_git(&worktree, &["add", "-A"]).expect("add");
        run_git(&worktree, &["commit", "-m", "commit explícito do agente"]).expect("commit");

        race_diff_blocking_in(root.path(), handle_of(&record), "claude".to_string()).expect("diff");
        let last = run_git(&worktree, &["log", "--format=%s", "-n", "1"]).expect("log");
        assert!(
            last.contains("commit explícito do agente"),
            "commit extra criado com o worktree limpo: {last}"
        );
        let ahead = run_git(
            &worktree,
            &[
                "rev-list",
                "--count",
                &format!("{}..{}", record.base_sha, record.agents[0].branch),
            ],
        )
        .expect("rev-list");
        assert_eq!(ahead.trim(), "1");
    }

    #[test]
    fn race_adopt_snapshots_uncommitted_work_before_adopting() {
        let (_tmp, repo) = temp_repo("autocommit-adopt");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        fs::write(worktree.join("agente.txt"), "trabalho não commitado\n").expect("mudança");

        let report = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Branch,
        )
        .expect("adopt branch");
        assert!(report.ok, "mensagem: {}", report.message);
        // The adoption branch carries the uncommitted work: it points at the
        // snapshot commit, not at the empty base.
        let branch = report.branch.expect("branch de adoção");
        let tip_file = run_git(&repo, &["show", &format!("{}:agente.txt", branch)]).expect("blob");
        assert_eq!(tip_file, "trabalho não commitado\n");
        assert!(
            run_git(&worktree, &["status", "--porcelain"])
                .expect("status")
                .trim()
                .is_empty(),
            "worktree do agente deveria ter ficado limpo"
        );
    }

    #[test]
    fn auto_commit_refuses_worktree_outside_the_race_directory() {
        let (_tmp, repo) = temp_repo("autocommit-scope");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let handle = handle_of(&record);
        // Tampered persisted state: the worktree now points at the user's MAIN
        // repository. The scope guard must refuse it — the auto-commit may
        // never run `git add -A` + `git commit` on the user's tree.
        let mut tampered = record.clone();
        tampered.agents[0].worktree = repo.to_string_lossy().into_owned();
        upsert_race(root.path(), &tampered).expect("registrar estado adulterado");

        let error = race_diff_blocking_in(root.path(), handle, "claude".to_string())
            .expect_err("worktree fora do escopo deve ser recusado");
        assert!(error.contains("recusada"), "mensagem: {error}");
        // The user's main repository did not receive any snapshot commit.
        let log = run_git(&repo, &["log", "--format=%s", "-n", "1"]).expect("log");
        assert!(
            !log.contains("snapshot do agente"),
            "auto-commit alcançou o repositório principal: {log}"
        );
    }

    // --- Adopt guards and modes ------------------------------------------------

    #[test]
    fn adopt_rejects_dirty_main_tree_after_start() {
        let (_tmp, repo) = temp_repo("adopt-dirty");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        fs::write(worktree.join("agente.txt"), "trabalho do agente\n").expect("mudança");
        commit_all(&worktree, "trabalho do agente");

        // The user dirties the MAIN tree between start and adopt.
        fs::write(repo.join("file.txt"), "modificada sem commit\n").expect("sujar");
        let error = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Branch,
        )
        .expect_err("árvore suja no adopt deve ser rejeitada");
        assert!(error.contains("limpa"), "mensagem: {error}");

        // The agent's work never reached the main tree.
        assert!(!repo.join("agente.txt").exists());
    }

    #[test]
    fn adopt_validates_agent_against_race_participants() {
        let (_tmp, repo) = temp_repo("adopt-agent-gate");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let error = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "codex".to_string(),
            AdoptMode::Branch,
        )
        .expect_err("agente fora da corrida deve falhar");
        assert!(error.contains("não participa"), "mensagem: {error}");
        let error = race_diff_blocking_in(
            root.path(),
            handle_of(&record),
            "../../etc/passwd".to_string(),
        )
        .expect_err("string livre deve falhar no diff");
        assert!(error.contains("não participa"), "mensagem: {error}");
    }

    #[test]
    fn adopt_branch_mode_creates_adoption_branch_at_tip() {
        let (_tmp, repo) = temp_repo("adopt-branch");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        fs::write(worktree.join("agente.txt"), "trabalho do agente\n").expect("mudança");
        commit_all(&worktree, "trabalho do agente");

        let report = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Branch,
        )
        .expect("adopt branch");
        assert!(report.ok);
        assert_eq!(report.mode, "branch");
        let branch = report.branch.expect("branch de adoção");
        let tip = run_git(&repo, &["rev-parse", &branch]).expect("tip da adoção");
        let race_tip =
            run_git(&repo, &["rev-parse", &record.agents[0].branch]).expect("tip da corrida");
        assert_eq!(tip.trim(), race_tip.trim());
        // Working tree untouched.
        assert!(run_git(&repo, &["status", "--porcelain"])
            .expect("status")
            .trim()
            .is_empty());
        // A second adopt on the same agent is refused (branch already exists).
        let error = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Branch,
        )
        .expect_err("adopt repetido deve falhar");
        assert!(error.contains("já existe"), "mensagem: {error}");
        let stored = get_race(root.path(), &record.race_id).expect("registro");
        assert_eq!(stored.status, "adopted");
    }

    #[test]
    fn apply_mode_applies_patch_when_check_passes() {
        let (_tmp, repo) = temp_repo("apply-clean");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        fs::write(worktree.join("agente.txt"), "trabalho do agente\n").expect("mudança");
        commit_all(&worktree, "trabalho do agente");
        // Base advances with a NON-conflicting commit.
        fs::write(repo.join("outro.txt"), "novo arquivo na main\n").expect("outro");
        commit_all(&repo, "avanço sem conflito");

        let report = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Apply,
        )
        .expect("adopt apply");
        assert!(report.ok, "mensagem: {}", report.message);
        assert!(report.conflicts.is_empty());
        assert!(repo.join("agente.txt").exists(), "patch não aplicado");
        assert_eq!(
            fs::read_to_string(repo.join("agente.txt")).expect("conteúdo aplicado"),
            "trabalho do agente\n"
        );
    }

    #[test]
    fn apply_conflict_reports_per_file_and_leaves_tree_intact() {
        let (_tmp, repo) = temp_repo("apply-conflict");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        // The agent rewrites line 1.
        fs::write(
            worktree.join("file.txt"),
            "agente mudou a linha 1\nlinha2\n",
        )
        .expect("mudança");
        commit_all(&worktree, "agente reescreve a linha 1");
        // The default branch rewrites the SAME line, differently.
        fs::write(repo.join("file.txt"), "main mudou a linha 1\nlinha2\n").expect("conflito");
        commit_all(&repo, "main reescreve a mesma linha");
        let before = fs::read_to_string(repo.join("file.txt")).expect("conteúdo antes");

        let report = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Apply,
        )
        .expect("o adopt NÃO deve falhar como comando — o conflito vira relatório");
        assert!(!report.ok, "aplicação conflitante não pode reportar ok");
        assert_eq!(report.mode, "apply");
        assert!(
            report.conflicts.iter().any(|c| c.path == "file.txt"),
            "conflito por arquivo ausente: {:?}",
            report.conflicts
        );
        assert!(
            report.message.contains("NÃO foi alterada"),
            "mensagem: {}",
            report.message
        );
        // The main tree is byte-identical and git-clean.
        assert_eq!(
            fs::read_to_string(repo.join("file.txt")).expect("depois"),
            before
        );
        assert!(run_git(&repo, &["status", "--porcelain"])
            .expect("status")
            .trim()
            .is_empty());
    }

    /// Auditor P0 regression: `--numstat` emits `old.txt => new.txt` for
    /// renames; the composite path used to slip through validation via the
    /// defensive arm and the real `git apply --3way` wrote conflict markers
    /// (UU) and deleted the original in the user's tree. Must be refused.
    #[test]
    fn apply_mode_blocks_rename_patch_and_leaves_tree_untouched() {
        let (_tmp, repo) = temp_repo("apply-rename");
        // Enough unchanged lines for git's rename detection (similarity ≥ 50%).
        let body = "linha1\nlinha2\nlinha3\nlinha4\nlinha5\nlinha6\nlinha7\nlinha8\n";
        fs::write(repo.join("file.txt"), body).expect("arquivo com contexto");
        commit_all(&repo, "arquivo maior para similaridade de rename");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        // The agent renames AND edits the renamed line.
        git(&worktree, &["mv", "file.txt", "new.txt"]);
        fs::write(
            worktree.join("new.txt"),
            "agente mudou a linha 1\nlinha2\nlinha3\nlinha4\nlinha5\nlinha6\nlinha7\nlinha8\n",
        )
        .expect("mudança do agente");
        commit_all(&worktree, "agente renomeia e edita");
        // The main tree edits the SAME line, divergently.
        fs::write(
            repo.join("file.txt"),
            "main mudou a linha 1\nlinha2\nlinha3\nlinha4\nlinha5\nlinha6\nlinha7\nlinha8\n",
        )
        .expect("divergência");
        commit_all(&repo, "main edita a mesma linha");
        let before = fs::read_to_string(repo.join("file.txt")).expect("conteúdo antes");

        // Sanity: the diff really does carry a composite rename path.
        let range = format!("{}...{}", record.base_sha, record.agents[0].branch);
        let numstat = run_git(
            &repo,
            &["-c", "core.quotepath=false", "diff", "--numstat", &range],
        )
        .expect("numstat");
        assert!(numstat.contains(" => "), "rename não detectado: {numstat}");

        let report = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Apply,
        )
        .expect("o adopt não falha como comando — o rename vira recusa orientada");
        assert!(
            !report.ok,
            "patch com rename não pode ser aplicado: {report:?}"
        );
        assert!(
            report
                .conflicts
                .iter()
                .any(|c| c.path.contains(" => ") && c.path.contains("file.txt")),
            "entrada de rename esperada no relatório: {:?}",
            report.conflicts
        );
        assert!(
            report.conflicts.iter().any(|c| c.reason.contains("branch")),
            "a recusa deve orientar o modo branch: {:?}",
            report.conflicts
        );

        // The user's working tree is untouched: no UU markers, no deletion,
        // no renamed file, git-clean.
        assert_eq!(
            fs::read_to_string(repo.join("file.txt")).expect("depois"),
            before
        );
        assert!(
            !repo.join("new.txt").exists(),
            "rename não pode ser aplicado"
        );
        assert!(run_git(&repo, &["status", "--porcelain"])
            .expect("status")
            .trim()
            .is_empty());

        // Defense in depth: the unvalidatable entry itself is refused.
        let bogus = RaceFileStat {
            path: "file.txt => new.txt".to_string(),
            adds: Some(1),
            dels: Some(1),
        };
        let head = head_sha(&repo).expect("HEAD");
        assert!(check_three_way_file(
            &repo,
            &record.base_sha,
            &head,
            &record.agents[0].branch,
            &bogus
        )
        .is_err());
    }

    /// Auditor P1 regression: with `core.autocrlf=true` the on-disk working
    /// copy holds CRLF while the blobs hold LF. Taking "ours" from disk made
    /// the whole file conflict and blocked a clean apply; ours now comes from
    /// HEAD's blob, exactly what `git apply --3way` merges against.
    #[test]
    fn apply_mode_merges_cleanly_with_autocrlf_working_tree() {
        let tmp = tempfile::tempdir().expect("repositório autocrlf temporário");
        let repo = tmp.path().join("crlf-repo");
        fs::create_dir_all(&repo).expect("mkdir");
        git(&repo, &["init"]);
        // Determinismo de plataforma: herdar core.autocrlf do ambiente (true no
        // Git for Windows) faria o apply --3way devolver CRLF e quebrar os
        // asserts de conteúdo. O teste de autocrlf sobrescreve depois.
        git(&repo, &["config", "core.autocrlf", "false"]);
        git(&repo, &["config", "user.email", "race-test@example.com"]);
        git(&repo, &["config", "user.name", "Race Test"]);
        git(&repo, &["config", "core.autocrlf", "true"]);
        fs::write(repo.join("file.txt"), "linha1\nlinha2\nlinha3\n").expect("arquivo base");
        commit_all(&repo, "base");
        // Real checkout so the working copy is CRLF-smudged on disk.
        fs::remove_file(repo.join("file.txt")).expect("remover para re-checkout");
        git(&repo, &["checkout", "--", "file.txt"]);
        let disk = fs::read_to_string(repo.join("file.txt")).expect("cópia de trabalho");
        assert!(
            disk.contains("\r\n"),
            "checkout deveria smudgar CRLF: {disk:?}"
        );

        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let worktree = worktree_of(&record, 0);
        // The worktree checks out CRLF too (config is shared); the agent edits
        // there and commits — autocrlf normalizes the blob back to LF.
        let agent_disk = fs::read_to_string(worktree.join("file.txt")).expect("cópia do agente");
        let agent_edited = agent_disk.replacen("linha1", "agente mudou a linha 1", 1);
        fs::write(worktree.join("file.txt"), agent_edited).expect("edição do agente");
        commit_all(&worktree, "agente edita com CRLF em disco");

        let report = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Apply,
        )
        .expect("adopt apply");
        assert!(
            report.ok,
            "apply limpo não pode ser bloqueado por CRLF: {report:?}"
        );
        assert!(report.conflicts.is_empty());
        let applied = fs::read_to_string(repo.join("file.txt")).expect("conteúdo aplicado");
        assert!(
            applied.contains("agente mudou a linha 1"),
            "conteúdo aplicado: {applied:?}"
        );
    }

    #[test]
    fn apply_with_no_changes_reports_success_without_touching_the_tree() {
        let (_tmp, repo) = temp_repo("apply-empty");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let report = race_adopt_blocking_in(
            root.path(),
            handle_of(&record),
            "claude".to_string(),
            AdoptMode::Apply,
        )
        .expect("adopt apply vazio");
        assert!(report.ok);
        assert!(run_git(&repo, &["status", "--porcelain"])
            .expect("status")
            .trim()
            .is_empty());
    }

    // --- Agent process lifecycle (real child process) --------------------------

    #[test]
    fn agent_process_lifecycle_is_tracked_and_logged() {
        let (_tmp, repo) = temp_repo("agent-lifecycle");
        let root = temp_race_root();
        let race_id = uuid::Uuid::new_v4().to_string();
        let log = agent_log_path(root.path(), &race_id, "claude");
        let argv = vec!["--version".to_string()];
        let proc = spawn_agent_process(&race_id, "claude", "git", &argv, &repo, &log)
            .expect("spawn do processo agente");
        assert!(!proc.finished);

        let mut finished = false;
        for _ in 0..250 {
            {
                let guard = runtimes()
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                if let Some(p) = guard.get(&race_id).and_then(|r| r.agents.get("claude")) {
                    if p.finished {
                        assert_eq!(p.exit_code, Some(0), "git --version deve sair com 0");
                        finished = true;
                        break;
                    }
                }
            }
            thread::sleep(Duration::from_millis(20));
        }
        assert!(finished, "o agente deveria ter terminado");
        let log_text = fs::read_to_string(&log).expect("log do agente");
        assert!(log_text.contains("git version"), "log: {log_text}");
        assert!(log_text.contains("agente encerrado"), "log: {log_text}");
        drop_runtime(&race_id);
    }

    // --- Cancel -----------------------------------------------------------------

    #[test]
    fn cancel_without_runtime_flips_persisted_status() {
        let (_tmp, repo) = temp_repo("cancel-offline");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        race_cancel_blocking_in(root.path(), handle_of(&record)).expect("cancel");
        let stored = get_race(root.path(), &record.race_id).expect("registro");
        assert_eq!(stored.status, "cancelled");
        assert!(stored.finished_at.is_some());
    }

    // --- Cleanup ------------------------------------------------------------------

    #[test]
    fn cleanup_after_retention_removes_worktrees_branches_and_prunes() {
        let (_tmp, repo) = temp_repo("cleanup");
        let root = temp_race_root();
        let mut record = manual_race(root.path(), &repo, &["claude"]);
        record.status = "completed".to_string();
        record.finished_at = Some((chrono::Local::now() - chrono::Duration::days(8)).to_rfc3339());
        upsert_race(root.path(), &record).expect("atualizar registro");

        let report =
            race_cleanup_blocking_in(root.path(), handle_of(&record), Some(7)).expect("cleanup");
        assert!(
            report.skipped_reason.is_none(),
            "{:?}",
            report.skipped_reason
        );
        assert!(report.pruned);
        assert_eq!(
            report.removed_worktrees,
            vec![record.agents[0].worktree.clone()]
        );
        assert_eq!(
            report.removed_branches,
            vec![record.agents[0].branch.clone()]
        );
        assert!(
            !Path::new(&record.agents[0].worktree).exists(),
            "worktree removido"
        );
        assert!(
            run_git(&repo, &["branch", "--list", &record.agents[0].branch])
                .expect("branch list")
                .trim()
                .is_empty()
        );
        assert!(
            !race_dir(root.path(), &record.race_id).exists(),
            "diretório da corrida removido"
        );
        let stored =
            get_race(root.path(), &record.race_id).expect("registro mantido como histórico");
        assert_eq!(stored.status, "cleaned");
    }

    #[test]
    fn cleanup_within_retention_window_is_skipped() {
        let (_tmp, repo) = temp_repo("cleanup-window");
        let root = temp_race_root();
        let mut record = manual_race(root.path(), &repo, &["claude"]);
        record.status = "completed".to_string();
        record.finished_at = Some(chrono::Local::now().to_rfc3339());
        upsert_race(root.path(), &record).expect("atualizar registro");

        let report =
            race_cleanup_blocking_in(root.path(), handle_of(&record), Some(7)).expect("cleanup");
        assert!(report.skipped_reason.is_some(), "deveria ter sido ignorado");
        assert!(report.removed_worktrees.is_empty());
        assert!(
            Path::new(&record.agents[0].worktree).exists(),
            "worktree preservado"
        );
        let stored = get_race(root.path(), &record.race_id).expect("registro");
        assert_eq!(stored.status, "completed");
    }

    #[test]
    fn cleanup_with_zero_days_is_immediate_for_finished_races() {
        let (_tmp, repo) = temp_repo("cleanup-zero");
        let root = temp_race_root();
        let mut record = manual_race(root.path(), &repo, &["claude"]);
        record.status = "failed".to_string();
        record.finished_at = Some(chrono::Local::now().to_rfc3339());
        upsert_race(root.path(), &record).expect("atualizar registro");
        let report =
            race_cleanup_blocking_in(root.path(), handle_of(&record), Some(0)).expect("cleanup");
        assert!(report.skipped_reason.is_none());
        assert!(!Path::new(&record.agents[0].worktree).exists());
    }

    #[test]
    fn cleanup_refuses_race_with_live_agents_but_allows_orphans() {
        let (_tmp, repo) = temp_repo("cleanup-live");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        // Simulate a truly live agent in the runtime registry.
        {
            let mut guard = runtimes()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            guard.insert(
                record.race_id.clone(),
                RaceRuntime {
                    cancelled: false,
                    agents: HashMap::from([(
                        "claude".to_string(),
                        AgentProc {
                            pid: u32::MAX,
                            started_at: Instant::now(),
                            finished: false,
                            exit_code: None,
                            log_path: PathBuf::new(),
                        },
                    )]),
                },
            );
        }
        let error = race_cleanup_blocking_in(root.path(), handle_of(&record), Some(0))
            .expect_err("corrida viva não pode ser limpa");
        assert!(error.contains("cancele"), "mensagem: {error}");
        drop_runtime(&record.race_id);
        // Orphan running race (no runtime): cleanup is allowed (crash recovery).
        let report = race_cleanup_blocking_in(root.path(), handle_of(&record), Some(0))
            .expect("cleanup órfã");
        assert!(report.skipped_reason.is_none());
    }

    // --- Orphan scan -----------------------------------------------------------

    #[test]
    fn orphan_scan_reports_running_races_without_live_runtime() {
        let (_tmp, repo) = temp_repo("orphans");
        let root = temp_race_root();
        let orphan = manual_race(root.path(), &repo, &["claude"]);
        let mut done = manual_race(root.path(), &repo, &["codex"]);
        done.status = "completed".to_string();
        upsert_race(root.path(), &done).expect("atualizar registro");

        let report = race_scan_orphans_blocking_in(root.path());
        let ids: Vec<&str> = report.orphans.iter().map(|o| o.race_id.as_str()).collect();
        assert_eq!(ids, vec![orphan.race_id.as_str()]);
        assert_eq!(report.orphans[0].agents, vec!["claude".to_string()]);
        assert!(report.orphans[0].worktree_root.contains(&orphan.race_id));

        // With a live runtime, the race is no longer an orphan.
        {
            let mut guard = runtimes()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            guard.insert(orphan.race_id.clone(), RaceRuntime::default());
        }
        let report = race_scan_orphans_blocking_in(root.path());
        assert!(report.orphans.is_empty());
        drop_runtime(&orphan.race_id);
        drop_runtime(&done.race_id);
    }

    // --- Status snapshot ---------------------------------------------------------

    #[test]
    fn status_snapshot_reflects_record_without_runtime() {
        let (_tmp, repo) = temp_repo("status-offline");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude", "goose"]);
        let snapshot = race_status_blocking_in(root.path(), handle_of(&record)).expect("snapshot");
        assert_eq!(snapshot.status, "running");
        assert_eq!(snapshot.agents.len(), 2);
        assert!(snapshot.agents.iter().all(|a| a.status == "unknown"));
        assert_eq!(snapshot.base_sha, record.base_sha);

        update_race(root.path(), &record.race_id, |r| {
            r.status = "adopted".to_string();
        })
        .expect("update");
        let snapshot = race_status_blocking_in(root.path(), handle_of(&record)).expect("snapshot");
        assert_eq!(snapshot.status, "adopted");
    }

    #[test]
    fn unknown_race_is_rejected_with_clear_message() {
        let root = temp_race_root();
        let handle = RaceHandle {
            race_id: uuid::Uuid::new_v4().to_string(),
            directory: String::new(),
            base_sha: String::new(),
            agents: Vec::new(),
            branches: Vec::new(),
            worktrees: Vec::new(),
            warnings: Vec::new(),
            started_at: String::new(),
        };
        let error =
            race_status_blocking_in(root.path(), handle.clone()).expect_err("corrida ausente");
        assert!(error.contains("não encontrada"), "mensagem: {error}");
        let error = race_cancel_blocking_in(root.path(), handle).expect_err("corrida ausente");
        assert!(error.contains("não encontrada"), "mensagem: {error}");
    }

    // --- Graveyard / crash recovery (23.2d) ------------------------------------

    /// OS-level liveness probe used by the recover tests (tasklist on Windows,
    /// `kill -0` elsewhere). Returns true when the pid is no longer running.
    fn process_is_gone(pid: u32) -> bool {
        #[cfg(windows)]
        {
            Command::new("tasklist")
                .args(["/FI", &format!("PID eq {}", pid), "/NH"])
                .output()
                .map(|out| !String::from_utf8_lossy(&out.stdout).contains(&pid.to_string()))
                .unwrap_or(false)
        }
        #[cfg(not(windows))]
        {
            Command::new("kill")
                .arg("-0")
                .arg(pid.to_string())
                .status()
                .map(|s| !s.success())
                .unwrap_or(false)
        }
    }

    /// Polls the OS until the pid reaches the desired state (gone when
    /// `true`, alive when `false`); returns whether the state was reached
    /// within the deadline.
    fn wait_process_state(pid: u32, gone: bool) -> bool {
        for _ in 0..150 {
            if process_is_gone(pid) == gone {
                return true;
            }
            thread::sleep(Duration::from_millis(50));
        }
        process_is_gone(pid) == gone
    }

    /// Test-as-child helper: the parent re-executes THIS test binary with
    /// `--ignored --exact` so it gets a real, long-lived process to kill.
    /// `#[ignore]` keeps it out of the normal suite.
    #[test]
    #[ignore]
    fn recover_sleep_child_stays_alive_until_killed() {
        thread::sleep(Duration::from_secs(30));
    }

    /// Spawns a real long-lived child (see `recover_sleep_child_*`) with a
    /// NEUTRAL cwd (the races root): on Windows a live process would lock its
    /// working directory, and the spare-process scenarios below must be able
    /// to remove the worktree while the sleeper is still running.
    fn spawn_sleeper(root: &Path, record: &RaceRecord) -> AgentProc {
        let exe = std::env::current_exe().expect("binário de teste");
        spawn_agent_process(
            &record.race_id,
            "claude",
            exe.to_str().expect("caminho do binário"),
            &[
                "--exact".to_string(),
                "commands::race::tests::recover_sleep_child_stays_alive_until_killed".to_string(),
                "--ignored".to_string(),
                "--test-threads=1".to_string(),
            ],
            root,
            &agent_log_path(root, &record.race_id, "claude"),
        )
        .expect("spawn do filho dormente")
    }

    #[test]
    fn prune_is_scoped_to_race_metadata_and_spares_user_worktrees() {
        let (tmp, repo) = temp_repo("prune-scoped");
        let root = temp_race_root();
        let mut record = manual_race(root.path(), &repo, &["claude"]);

        // The user's own worktree in the same repository, then both worktree
        // directories removed externally — exactly the orphaned-metadata case.
        let user_wt = tmp.path().join("user-worktree");
        git(
            &repo,
            &[
                "worktree",
                "add",
                "-b",
                "user/feature",
                user_wt.to_str().expect("caminho do worktree do usuário"),
                "HEAD",
            ],
        );
        fs::remove_dir_all(worktree_of(&record, 0)).expect("remover worktree da corrida");
        fs::remove_dir_all(&user_wt).expect("remover worktree do usuário");

        record.status = "completed".to_string();
        record.finished_at = Some((chrono::Local::now() - chrono::Duration::days(8)).to_rfc3339());
        upsert_race(root.path(), &record).expect("atualizar registro");

        let report =
            race_cleanup_blocking_in(root.path(), handle_of(&record), Some(0)).expect("cleanup");
        assert!(report.pruned, "o prune escopado deve rodar");
        // The race's stale metadata is gone from the user's repository...
        assert!(
            !repo.join(".git").join("worktrees").join("claude").exists(),
            "metadado da corrida removido"
        );
        // ...while the user's own orphaned worktree metadata survives intact.
        assert!(
            repo.join(".git")
                .join("worktrees")
                .join("user-worktree")
                .exists(),
            "metadado do worktree do usuário deve permanecer"
        );
        assert!(
            !run_git(&repo, &["branch", "--list", "user/feature"])
                .expect("branch list")
                .trim()
                .is_empty(),
            "branch do usuário preservada"
        );
        assert!(
            run_git(&repo, &["branch", "--list", &record.agents[0].branch])
                .expect("branch list")
                .trim()
                .is_empty(),
            "branch da corrida removida"
        );
    }

    // --- gitdir resolution (git 2.46+ relative paths) --------------------------

    #[test]
    fn gitdir_relative_content_resolves_into_the_race_scope() {
        // Metadata at <repo>/.git/worktrees/claude; the race worktree lives in
        // a sibling tree — git 2.46+ (useRelativePaths) records `gitdir` as a
        // RELATIVE path in exactly this shape.
        let metadata_dir = Path::new("C:/dados/repo/.git/worktrees/claude");
        let race_dir = Path::new("C:/dados/races/race-1");
        assert!(gitdir_points_into_race(
            "../../../../races/race-1/claude/.git\n",
            metadata_dir,
            race_dir
        ));
    }

    #[test]
    fn gitdir_absolute_forward_slashes_match_on_both_platforms() {
        // git writes forward slashes regardless of platform; on Windows the
        // filesystem (and therefore the match) is case-insensitive.
        let content = if cfg!(windows) {
            "c:/dados/races/race-1/claude/.git"
        } else {
            "C:/dados/races/race-1/claude/.git"
        };
        let race_dir = if cfg!(windows) {
            PathBuf::from("C:\\Dados\\Races\\race-1")
        } else {
            PathBuf::from("C:/dados/races/race-1")
        };
        let metadata_dir = Path::new("C:/dados/repo/.git/worktrees/claude");
        assert!(gitdir_points_into_race(content, metadata_dir, &race_dir));
    }

    #[test]
    fn gitdir_outside_the_race_scope_is_never_matched() {
        let metadata_dir = Path::new("C:/dados/repo/.git/worktrees/user-wt");
        let race_dir = Path::new("C:/dados/races/race-1");

        // Absolute path outside the races root…
        assert!(!gitdir_points_into_race(
            "C:/outros/projeto/.git",
            metadata_dir,
            race_dir
        ));
        // …a relative path escaping to a sibling tree…
        assert!(!gitdir_points_into_race(
            "../../../../outros/projeto/.git",
            metadata_dir,
            race_dir
        ));
        // …component-wise comparison: race-11 is NOT race-1 (no string
        // prefix matching)…
        assert!(!gitdir_points_into_race(
            "../../../../races/race-11/claude/.git",
            metadata_dir,
            race_dir
        ));
        // …and empty/whitespace content is never a match.
        assert!(!gitdir_points_into_race("   \n", metadata_dir, race_dir));
    }

    #[test]
    fn gitdir_on_another_drive_is_never_matched() {
        // Cross-drive absolute content with the SAME suffix must never
        // match: the anchor carries the real drive, not a generic token
        // (re-audit follow-up — `D:\...` once matched scope `C:/...`).
        let metadata_dir = Path::new("C:/dados/repo/.git/worktrees/claude");
        let race_dir = Path::new("C:/dados/races/race-1");
        assert!(!gitdir_points_into_race(
            r"D:\dados\races\race-1\x\.git",
            metadata_dir,
            race_dir
        ));
    }

    #[test]
    fn prune_resolves_relative_gitdir_written_by_newer_git() {
        // Builds the RELATIVE path from `from` to `to` the way git 2.46+
        // (useRelativePaths) does: through the closest common ancestor.
        fn relative_gitdir(from: &Path, to: &Path) -> String {
            let from: Vec<_> = from.components().collect();
            let to: Vec<_> = to.components().collect();
            let common = from
                .iter()
                .zip(to.iter())
                .take_while(|(a, b)| a == b)
                .count();
            let mut parts: Vec<String> = vec!["..".to_string(); from.len() - common];
            parts.extend(
                to[common..]
                    .iter()
                    .map(|c| c.as_os_str().to_string_lossy().into_owned()),
            );
            parts.join("/")
        }

        let (_tmp, repo) = temp_repo("prune-relative");
        let root = temp_race_root();
        let mut record = manual_race(root.path(), &repo, &["claude"]);
        record.status = "completed".to_string();
        record.finished_at = Some((chrono::Local::now() - chrono::Duration::days(8)).to_rfc3339());
        upsert_race(root.path(), &record).expect("atualizar registro");

        // The worktree directory is removed externally; only the metadata in
        // the user's repository survives — as after any crash/hand cleanup.
        // The settled removal keeps the setup deterministic under CI file
        // scanners (a freshly git-written tree can linger "delete pending").
        assert!(
            remove_dir_all_settled(&worktree_of(&record, 0)),
            "remover worktree da corrida"
        );
        let metadata_dir = repo.join(".git").join("worktrees").join("claude");
        let gitdir_file = metadata_dir.join("gitdir");
        assert!(gitdir_file.is_file(), "metadado órfão presente");

        // Rewrite the gitdir the way git 2.46+ (useRelativePaths) can: a
        // RELATIVE path through the common ancestor. The sweep must resolve
        // it back into the race scope.
        let worktree_git = worktree_of(&record, 0).join(".git");
        let relative = relative_gitdir(&metadata_dir, &worktree_git);
        assert!(
            relative.starts_with("../"),
            "o gitdir reescrito deve ser relativo: {relative}"
        );
        fs::write(&gitdir_file, format!("{relative}\n")).expect("reescrever gitdir relativo");

        let report =
            race_cleanup_blocking_in(root.path(), handle_of(&record), Some(0)).expect("cleanup");
        assert!(report.pruned, "o prune escopado deve rodar");
        assert!(
            !metadata_dir.exists(),
            "metadado da corrida removido mesmo com gitdir relativo"
        );
        // With the stale metadata gone, the branch is no longer "checked
        // out" and the deletion succeeds — no partial cleanup for the user.
        assert!(
            run_git(&repo, &["branch", "--list", &record.agents[0].branch])
                .expect("branch list")
                .trim()
                .is_empty(),
            "branch da corrida removida"
        );
        assert_eq!(report.removed_branches.len(), 1);
    }

    #[test]
    fn cleanup_with_missing_project_dir_still_cleans_history() {
        let (_tmp, repo) = temp_repo("cleanup-gone-dir");
        let root = temp_race_root();
        let mut record = manual_race(root.path(), &repo, &["claude"]);
        record.status = "failed".to_string();
        record.finished_at = Some(chrono::Local::now().to_rfc3339());
        upsert_race(root.path(), &record).expect("atualizar registro");

        // The user deleted or moved the project after the race ended.
        fs::remove_dir_all(&repo).expect("remover o diretório do projeto");

        let report =
            race_cleanup_blocking_in(root.path(), handle_of(&record), Some(0)).expect("cleanup");
        assert!(
            report
                .skipped_reason
                .as_deref()
                .unwrap_or_default()
                .contains("não existe mais"),
            "motivo: {:?}",
            report.skipped_reason
        );
        assert!(
            !Path::new(&record.agents[0].worktree).exists(),
            "worktree removido diretamente da raiz de corridas"
        );
        let stored = get_race(root.path(), &record.race_id).expect("registro");
        assert_eq!(stored.status, "cleaned");
    }

    #[test]
    fn recover_kills_live_persisted_pids_and_cleans_up() {
        let (_tmp, repo) = temp_repo("recover-kill");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let wt = worktree_of(&record, 0);

        // A real live "agent": this test binary re-executed as a sleeper.
        let proc = spawn_sleeper(root.path(), &record);
        assert!(
            wait_process_state(proc.pid, false),
            "o filho dormente deveria estar vivo"
        );

        // Persist pid + the REAL signature like race_start does, then
        // simulate the app crash.
        let identity = capture_process_identity(proc.pid).expect("assinatura do processo vivo");
        update_race(root.path(), &record.race_id, |r| {
            if let Some(agent) = r.agents.first_mut() {
                agent.pid = Some(proc.pid);
                agent.identity = Some(identity);
            }
        })
        .expect("persistir pid e assinatura");
        drop_runtime(&record.race_id);

        let report = race_recover_blocking_in(root.path(), handle_of(&record)).expect("recover");
        assert!(
            report.skipped_reason.is_none(),
            "{:?}",
            report.skipped_reason
        );
        assert!(
            report.unverified_processes.is_empty(),
            "identidade deve bater: {:?}",
            report.unverified_processes
        );
        assert_eq!(
            report.removed_worktrees,
            vec![record.agents[0].worktree.clone()]
        );

        assert!(
            wait_process_state(proc.pid, true),
            "o pid assinado deveria ter sido encerrado"
        );
        assert!(!wt.exists(), "worktree removido");
        assert!(
            run_git(&repo, &["branch", "--list", &record.agents[0].branch])
                .expect("branch list")
                .trim()
                .is_empty(),
            "branch removida"
        );
        let stored = get_race(root.path(), &record.race_id).expect("registro");
        assert_eq!(stored.status, "cleaned");
        assert!(stored.finished_at.is_some());
    }

    #[test]
    fn recover_spares_reused_pid_of_a_different_executable() {
        let (_tmp, repo) = temp_repo("recover-reused");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let wt = worktree_of(&record, 0);

        let proc = spawn_sleeper(root.path(), &record);
        assert!(
            wait_process_state(proc.pid, false),
            "o filho dormente deveria estar vivo"
        );

        // Simulate a reboot where the OS handed the recorded pid to another
        // executable: the persisted signature can no longer match.
        let reused = ProcessIdentity {
            exe: if cfg!(windows) {
                r"C:\Windows\System32\notepad.exe".to_string()
            } else {
                "/usr/bin/yes".to_string()
            },
            creation_time: 42,
        };
        update_race(root.path(), &record.race_id, |r| {
            if let Some(agent) = r.agents.first_mut() {
                agent.pid = Some(proc.pid);
                agent.identity = Some(reused);
            }
        })
        .expect("persistir pid reaproveitado");
        drop_runtime(&record.race_id);

        let report = race_recover_blocking_in(root.path(), handle_of(&record)).expect("recover");
        assert_eq!(report.unverified_processes.len(), 1, "{report:?}");
        assert!(
            report.unverified_processes[0].contains("não verificado"),
            "{:?}",
            report.unverified_processes
        );
        // The innocent process SURVIVES the recovery…
        assert!(
            wait_process_state(proc.pid, false),
            "o processo inocente não pode ser morto"
        );
        // …while the disk cleanup still ran.
        assert!(!wt.exists(), "worktree removido mesmo sem kill");
        assert_eq!(
            get_race(root.path(), &record.race_id)
                .expect("registro")
                .status,
            "cleaned"
        );

        // Test hygiene: kill the survivor spawned for this test.
        crate::util::kill_tree(proc.pid).expect("encerrar o filho do teste");
        assert!(wait_process_state(proc.pid, true));
    }

    #[test]
    fn recover_with_legacy_record_without_signature_spares_process() {
        let (_tmp, repo) = temp_repo("recover-legacy");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        let wt = worktree_of(&record, 0);

        let proc = spawn_sleeper(root.path(), &record);
        assert!(
            wait_process_state(proc.pid, false),
            "o filho dormente deveria estar vivo"
        );

        // Legacy record shape: pid present, no persisted identity at all.
        update_race(root.path(), &record.race_id, |r| {
            if let Some(agent) = r.agents.first_mut() {
                agent.pid = Some(proc.pid);
                agent.identity = None;
            }
        })
        .expect("persistir pid sem assinatura");
        drop_runtime(&record.race_id);

        let report = race_recover_blocking_in(root.path(), handle_of(&record)).expect("recover");
        assert_eq!(report.unverified_processes.len(), 1, "{report:?}");
        assert!(
            report.unverified_processes[0].contains("sem assinatura"),
            "{:?}",
            report.unverified_processes
        );
        // Fail-safe: no signature, no kill — the process survives.
        assert!(
            wait_process_state(proc.pid, false),
            "sem assinatura o processo não pode ser morto"
        );
        // Disk cleanup still proceeded.
        assert!(!wt.exists(), "worktree removido");
        assert_eq!(
            get_race(root.path(), &record.race_id)
                .expect("registro")
                .status,
            "cleaned"
        );

        crate::util::kill_tree(proc.pid).expect("encerrar o filho do teste");
        assert!(wait_process_state(proc.pid, true));
    }

    #[test]
    fn recover_refuses_race_with_live_runtime_in_this_session() {
        let (_tmp, repo) = temp_repo("recover-live");
        let root = temp_race_root();
        let record = manual_race(root.path(), &repo, &["claude"]);
        {
            let mut guard = runtimes()
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            guard.insert(
                record.race_id.clone(),
                RaceRuntime {
                    cancelled: false,
                    agents: HashMap::from([(
                        "claude".to_string(),
                        AgentProc {
                            pid: u32::MAX,
                            started_at: Instant::now(),
                            finished: false,
                            exit_code: None,
                            log_path: PathBuf::new(),
                        },
                    )]),
                },
            );
        }
        let error = race_recover_blocking_in(root.path(), handle_of(&record))
            .expect_err("corrida viva nesta sessão deve ser recusada");
        assert!(error.contains("cancele"), "mensagem: {error}");
        assert!(
            worktree_of(&record, 0).exists(),
            "nada é removido quando a corrida está ativa"
        );
        drop_runtime(&record.race_id);
    }

    #[test]
    fn history_lists_only_terminal_records_with_worktree_presence() {
        let (_tmp, repo) = temp_repo("history");
        let root = temp_race_root();

        let mut done = manual_race(root.path(), &repo, &["claude"]);
        done.status = "completed".to_string();
        done.started_at = "2026-09-01T10:00:00-03:00".to_string();
        upsert_race(root.path(), &done).expect("atualizar registro");

        let mut gone = manual_race(root.path(), &repo, &["codex"]);
        gone.status = "cleaned".to_string();
        gone.started_at = "2026-09-02T10:00:00-03:00".to_string();
        fs::remove_dir_all(worktree_of(&gone, 0)).expect("remover worktree limpo");
        upsert_race(root.path(), &gone).expect("atualizar registro");

        let running = manual_race(root.path(), &repo, &["goose"]);

        let history = race_list_history_blocking_in(root.path());
        let ids: Vec<&str> = history.iter().map(|e| e.race_id.as_str()).collect();
        assert_eq!(
            ids,
            vec![gone.race_id.as_str(), done.race_id.as_str()],
            "somente registros terminais, mais recentes primeiro"
        );
        assert!(
            !history[0].worktrees_present,
            "worktrees limpos → arquivada"
        );
        assert!(
            history[1].worktrees_present,
            "worktrees vivos → restaurável"
        );
        assert_eq!(history[1].agents, vec!["claude".to_string()]);
        assert_eq!(history[1].base_sha, done.base_sha);
        drop_runtime(&running.race_id);
    }
}
