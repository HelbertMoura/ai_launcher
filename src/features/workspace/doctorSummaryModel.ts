import type { PrereqCheck } from "../prereqs/usePrerequisites";

const CRITICAL_NAMES = new Set(["node", "node.js", "git"]);
const WARNING_NAMES = new Set([
  "python",
  "python3",
  "rust",
  "rustc",
  "pnpm",
  "yarn",
  "bun",
]);

/**
 * Severity of a missing tool by its display name (lowercase compare).
 * Note: intentionally name-based and distinct from doctorPageModel's
 * key-based `classifyDoctorCheck` — the workspace card counts must keep
 * the legacy semantics.
 */
export function classifySeverity(name: string): "critical" | "warning" | "info" {
  const lower = name.toLowerCase();
  if (CRITICAL_NAMES.has(lower)) return "critical";
  if (WARNING_NAMES.has(lower)) return "warning";
  return "info";
}

export interface DoctorSeverityCounts {
  critical: number;
  warning: number;
  info: number;
  missing: number;
  total: number;
}

/** Groups the missing checks by severity for the workspace doctor card. */
export function summarizeDoctorSeverities(items: PrereqCheck[]): DoctorSeverityCounts {
  const missing = items.filter((c) => !c.installed);
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const c of missing) {
    const sev = classifySeverity(c.name);
    if (sev === "critical") critical += 1;
    else if (sev === "warning") warning += 1;
    else info += 1;
  }
  return { critical, warning, info, missing: missing.length, total: items.length };
}
