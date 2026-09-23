// ==============================================================================
// AI Launcher Pro - Project <-> Workspace reconciliation (Cost Governance 3.0)
// Pure, best-effort join between usage entries and WorkspaceProfile directories
// (design v23 §4 D5 / gate condition 2). No I/O — callers pass the profiles so
// every result is deterministic and testable.
// ==============================================================================

import type { WorkspaceProfile } from '../../domain/types';

export interface ReconciledProject {
  /** Canonical grouping key (normalized directory, normalized path or label). */
  key: string;
  /** Readable label for the UI: the usage label when present, else a basename. */
  displayName: string;
}

/**
 * Canonical path form: backslashes -> slashes, lowercased, no trailing slash.
 * Intentionally minimal (design-mandated): no drive-letter or separator-count
 * normalization beyond what the gate condition specifies.
 */
export function normalizeDirPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/\/+$/, '');
}

/** Last path segment of a normalized path (whole string when it has no slash). */
function baseName(normalized: string): string {
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

/**
 * Resolve the canonical project identity of one usage entry.
 *
 * Precedence (gate condition 2):
 *  1. Exact normalized path match: entry `projectPath` vs a workspace
 *     `directory` (both via `normalizeDirPath`). Matched -> the workspace's
 *     normalized directory is the key.
 *  2. Basename-vs-basename fallback — ONLY when unambiguous: 2+ workspaces
 *     sharing a basename in distinct paths means NO match (would silently
 *     merge different projects). Matched -> the workspace's normalized
 *     directory is the key (this is what actually dedupes label-only entries).
 *  3. No workspace matched: key = normalized `projectPath` when present,
 *     else the lowercased label; `displayName` stays the raw label.
 *
 * Returns null only when the entry carries neither a label nor a path.
 */
export function resolveProjectKey(
  entry: { project?: string | null; projectPath?: string | null },
  workspaces: WorkspaceProfile[],
): ReconciledProject | null {
  const label = (entry.project ?? '').trim();
  const rawPath = (entry.projectPath ?? '').trim();
  const path = rawPath ? normalizeDirPath(rawPath) : '';

  // 1) Exact normalized path match.
  if (path) {
    const exact = workspaces.find((w) => normalizeDirPath(w.directory) === path);
    if (exact) {
      return { key: path, displayName: label || baseName(path) };
    }
  }

  // 2) Unambiguous basename fallback (entry side: path basename, or the label
  // treated as a folder name for Claude-style entries without a path).
  const entryBase = path ? baseName(path) : baseName(normalizeDirPath(label));
  if (entryBase) {
    const candidates = workspaces.filter((w) => {
      const dir = normalizeDirPath(w.directory);
      return dir !== '' && baseName(dir) === entryBase;
    });
    if (candidates.length === 1) {
      const key = normalizeDirPath(candidates[0].directory);
      return { key, displayName: label || entryBase };
    }
  }

  // 3) No workspace matched — canonical key from the entry itself.
  if (path) return { key: path, displayName: label || baseName(path) };
  if (label) return { key: label.toLowerCase(), displayName: label };
  return null;
}
