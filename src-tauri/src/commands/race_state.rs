// Persistent race state for Race Mode (crash recovery).
//
// Races are indexed in a single JSON file —
//   %LOCALAPPDATA%/ai-launcher/races/races.json
// — that lives OUTSIDE the per-race directories (`races/<race-id>/`), so a
// race cleanup can never delete the index itself. Writes are atomic (temp
// file + rename) so a crash mid-write never destroys the previous snapshot.
// Reads are fail-closed: a corrupted file (or a single corrupted record) is
// skipped with a warning instead of panicking or failing the command. The
// prompt/credentials are never persisted — only identifiers, paths and
// lifecycle metadata.
//
// All functions take the races root as a parameter so they can be exercised
// against a temporary directory in tests; the Tauri commands resolve the real
// root via [`races_root`].

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::errors::AppError;
use crate::util::log_event;
use crate::util::process::ProcessIdentity;

pub const STATE_FILE_NAME: &str = "races.json";
pub const STATE_VERSION: u32 = 1;

/// One agent slot of a recorded race.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentRecord {
    /// Allowlisted agent key (e.g. "claude"). Never free-form user text.
    pub agent: String,
    /// Branch created for this agent: `race/<race-id>/<agent>`.
    pub branch: String,
    /// Absolute path of the agent's worktree (outside the user's repository).
    pub worktree: String,
    /// OS pid captured at spawn, so a crash-recovery pass (`race_recover`)
    /// can terminate processes left behind by a dead app session.
    /// Records written before 23.2d deserialize as `None`.
    #[serde(default)]
    pub pid: Option<u32>,
    /// Executable path + creation timestamp captured at spawn. `race_recover`
    /// only kills a persisted pid when the OS still reports this exact
    /// identity — a pid reused by another process after a reboot is spared.
    /// Records without it (legacy or failed capture) are never killed.
    #[serde(default)]
    pub identity: Option<ProcessIdentity>,
}

/// A recorded race, persisted while it runs and kept afterwards as history.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RaceRecord {
    pub race_id: String,
    /// The user's repository the race runs against.
    pub directory: String,
    /// HEAD SHA frozen at start; diffs always use `base_sha...race-branch`.
    pub base_sha: String,
    /// Lifecycle: "running" | "completed" | "failed" | "cancelled" |
    /// "adopted" | "cleaned".
    pub status: String,
    /// RFC3339 timestamp of the race start.
    pub started_at: String,
    /// RFC3339 timestamp of the race end, when known.
    pub finished_at: Option<String>,
    /// Limitation banners captured at start (submodules/LFS/dependencies).
    #[serde(default)]
    pub warnings: Vec<String>,
    pub agents: Vec<AgentRecord>,
}

/// Root document of `races.json`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RaceState {
    pub version: u32,
    #[serde(default)]
    pub races: Vec<RaceRecord>,
}

impl Default for RaceState {
    fn default() -> Self {
        Self {
            version: STATE_VERSION,
            races: Vec::new(),
        }
    }
}

/// Canonical location of the races root for the installed app:
/// `%LOCALAPPDATA%/ai-launcher/races`. Deliberately `data_local_dir()` —
/// never `data_dir()` (Roaming) and never inside a user repository.
pub fn races_root() -> Result<PathBuf, AppError> {
    dirs::data_local_dir()
        .map(|dir| dir.join("ai-launcher").join("races"))
        .ok_or_else(|| {
            AppError::new("Não foi possível determinar o diretório de dados locais do usuário")
        })
}

/// Full path of the index file inside the races root.
pub fn state_path(root: &Path) -> PathBuf {
    root.join(STATE_FILE_NAME)
}

/// Loads the index, fail-closed: a missing, unreadable or corrupted file
/// yields an empty state with a warning (never a panic, never a failure).
/// A record that fails to deserialize is skipped individually so one bad
/// entry cannot hide the others.
pub fn load_state(root: &Path) -> RaceState {
    let path = state_path(root);
    let text = match fs::read_to_string(&path) {
        Ok(text) => text,
        Err(_) => return RaceState::default(),
    };
    let mut state = RaceState::default();
    let value = match serde_json::from_str::<serde_json::Value>(&text) {
        Ok(value) => value,
        Err(error) => {
            log_event(
                "race_state",
                &format!("races.json corrompido — conteúdo ignorado: {}", error),
            );
            return state;
        }
    };
    if let Some(version) = value.get("version").and_then(|v| v.as_u64()) {
        state.version = u32::try_from(version).unwrap_or(STATE_VERSION);
    }
    if let Some(entries) = value.get("races").and_then(|v| v.as_array()) {
        for entry in entries {
            match serde_json::from_value::<RaceRecord>(entry.clone()) {
                Ok(record) => state.races.push(record),
                Err(error) => log_event(
                    "race_state",
                    &format!("registro de corrida inválido ignorado: {}", error),
                ),
            }
        }
    }
    state
}

/// Persists the index atomically: the payload is written to a unique temp
/// file in the same directory and renamed over `races.json`, so a crash
/// mid-write never corrupts the previous snapshot.
pub fn save_state(root: &Path, state: &RaceState) -> Result<(), AppError> {
    fs::create_dir_all(root)
        .map_err(|e| AppError::new(format!("Falha ao criar o diretório de corridas: {}", e)))?;
    let target = state_path(root);
    let temp = root.join(format!("{}.tmp-{}", STATE_FILE_NAME, uuid::Uuid::new_v4()));
    let payload = serde_json::to_string_pretty(state)
        .map_err(|e| AppError::new(format!("Falha ao serializar o state de corridas: {}", e)))?;
    fs::write(&temp, payload)
        .map_err(|e| AppError::new(format!("Falha ao gravar o state de corridas: {}", e)))?;
    if let Err(error) = fs::rename(&temp, &target) {
        let _ = fs::remove_file(&temp);
        return Err(AppError::new(format!(
            "Falha ao finalizar a gravação do state de corridas: {}",
            error
        )));
    }
    Ok(())
}

/// Inserts or replaces the record of a race.
pub fn upsert_race(root: &Path, record: &RaceRecord) -> Result<(), AppError> {
    let mut state = load_state(root);
    if let Some(existing) = state.races.iter_mut().find(|r| r.race_id == record.race_id) {
        *existing = record.clone();
    } else {
        state.races.push(record.clone());
    }
    save_state(root, &state)
}

/// Looks up a race record by id.
pub fn get_race(root: &Path, race_id: &str) -> Option<RaceRecord> {
    load_state(root)
        .races
        .into_iter()
        .find(|r| r.race_id == race_id)
}

/// Applies an in-place mutation to a race record and persists the result.
/// Returns the updated record, or None when the race is unknown.
pub fn update_race<T: FnOnce(&mut RaceRecord)>(
    root: &Path,
    race_id: &str,
    mutate: T,
) -> Result<Option<RaceRecord>, AppError> {
    let mut state = load_state(root);
    let Some(record) = state.races.iter_mut().find(|r| r.race_id == race_id) else {
        return Ok(None);
    };
    mutate(record);
    let updated = record.clone();
    save_state(root, &state)?;
    Ok(Some(updated))
}

/// Races marked "running" that have no live runtime in this app process —
/// i.e. the app died (or was killed) mid-race. The boot wiring lives in
/// 23.2d; this primitive only reports them.
pub fn scan_orphans(root: &Path, live_race_ids: &[String]) -> Vec<RaceRecord> {
    load_state(root)
        .races
        .into_iter()
        .filter(|r| r.status == "running" && !live_race_ids.contains(&r.race_id))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root() -> tempfile::TempDir {
        tempfile::tempdir().expect("tempdir do state de corridas")
    }

    fn sample_record(race_id: &str, status: &str) -> RaceRecord {
        RaceRecord {
            race_id: race_id.to_string(),
            directory: r"C:\projetos\demo".to_string(),
            base_sha: "0123456789abcdef0123456789abcdef01234567".to_string(),
            status: status.to_string(),
            started_at: "2026-09-22T10:00:00-03:00".to_string(),
            finished_at: None,
            warnings: vec!["aviso de exemplo".to_string()],
            agents: vec![AgentRecord {
                agent: "claude".to_string(),
                branch: format!("race/{}/claude", race_id),
                worktree: format!(r"C:\dados\races\{}\claude", race_id),
                pid: Some(4242),
                identity: None,
            }],
        }
    }

    #[test]
    fn save_and_load_roundtrip_preserves_records() {
        let root = temp_root();
        let record = sample_record("race-abc", "running");
        upsert_race(root.path(), &record).expect("upsert");
        let loaded = get_race(root.path(), "race-abc").expect("registro persistido");
        assert_eq!(loaded, record);
        let state = load_state(root.path());
        assert_eq!(state.version, STATE_VERSION);
        assert_eq!(state.races.len(), 1);
    }

    #[test]
    fn missing_state_file_yields_empty_state() {
        let root = temp_root();
        let state = load_state(root.path());
        assert!(state.races.is_empty());
        assert!(get_race(root.path(), "qualquer").is_none());
    }

    #[test]
    fn corrupted_state_file_is_fail_closed_and_never_panics() {
        let root = temp_root();
        fs::create_dir_all(root.path()).unwrap();
        fs::write(state_path(root.path()), "{{{ isto não é json ]]").unwrap();
        let state = load_state(root.path());
        assert!(
            state.races.is_empty(),
            "conteúdo corrompido deve ser ignorado"
        );
        // A subsequent save still produces a valid file.
        upsert_race(root.path(), &sample_record("race-ok", "running"))
            .expect("upsert pós-corrupção");
        assert!(get_race(root.path(), "race-ok").is_some());
    }

    #[test]
    fn single_corrupted_record_is_skipped_and_valid_ones_kept() {
        let root = temp_root();
        let good = sample_record("race-good", "completed");
        let bad =
            "{\"race_id\":\"race-bad\",\"status\":123,\"agents\":\"não é lista\"}".to_string();
        let good_json = serde_json::to_string(&good).unwrap();
        let payload = format!(
            "{{\"version\":{},\"races\":[{},{}]}}",
            STATE_VERSION, bad, good_json
        );
        fs::create_dir_all(root.path()).unwrap();
        fs::write(state_path(root.path()), payload).unwrap();
        let state = load_state(root.path());
        assert_eq!(state.races.len(), 1, "apenas o registro válido sobrevive");
        assert_eq!(state.races[0].race_id, "race-good");
    }

    #[test]
    fn update_race_mutates_only_the_target_record() {
        let root = temp_root();
        upsert_race(root.path(), &sample_record("race-1", "running")).unwrap();
        upsert_race(root.path(), &sample_record("race-2", "running")).unwrap();
        let updated = update_race(root.path(), "race-1", |r| {
            r.status = "adopted".into();
            r.finished_at = Some("2026-09-22T11:00:00-03:00".into());
        })
        .expect("update")
        .expect("registro existente");
        assert_eq!(updated.status, "adopted");
        assert_eq!(get_race(root.path(), "race-2").unwrap().status, "running");
        assert!(update_race(root.path(), "race-missing", |_| {})
            .expect("update")
            .is_none());
    }

    #[test]
    fn atomic_save_leaves_no_temp_files_behind() {
        let root = temp_root();
        for i in 0..5 {
            upsert_race(
                root.path(),
                &sample_record(&format!("race-{}", i), "running"),
            )
            .expect("upsert");
        }
        let leftovers: Vec<_> = fs::read_dir(root.path())
            .expect("diretório de corridas")
            .filter_map(Result::ok)
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp-"))
            .collect();
        assert!(
            leftovers.is_empty(),
            "arquivos temporários residuais: {leftovers:?}"
        );
        assert!(state_path(root.path()).is_file());
    }

    #[test]
    fn orphan_scan_flags_only_running_races_without_live_runtime() {
        let root = temp_root();
        upsert_race(root.path(), &sample_record("race-orphan", "running")).unwrap();
        upsert_race(root.path(), &sample_record("race-done", "completed")).unwrap();
        let orphans = scan_orphans(root.path(), &[]);
        let ids: Vec<_> = orphans.iter().map(|r| r.race_id.as_str()).collect();
        assert_eq!(ids, vec!["race-orphan"]);
        // A live runtime (same process) disqualifies the race.
        let orphans = scan_orphans(root.path(), &["race-orphan".to_string()]);
        assert!(orphans.is_empty());
    }

    #[test]
    fn legacy_records_without_pid_deserialize_with_none() {
        let root = temp_root();
        let record = sample_record("race-legacy", "running");
        let mut agent = serde_json::to_value(&record).expect("serializar registro");
        agent["agents"][0]
            .as_object_mut()
            .expect("agente é objeto")
            .remove("pid");
        let payload = serde_json::json!({ "version": STATE_VERSION, "races": [agent] });
        fs::create_dir_all(root.path()).unwrap();
        fs::write(
            state_path(root.path()),
            serde_json::to_string(&payload).unwrap(),
        )
        .unwrap();
        let loaded = get_race(root.path(), "race-legacy").expect("registro persistido");
        assert_eq!(
            loaded.agents[0].pid, None,
            "registro pré-23.2d: pid ausente"
        );
    }
}
