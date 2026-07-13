import type { PrereqCheck } from "../prereqs/usePrerequisites";

export type DoctorSeverity = "critical" | "warning" | "info";

export interface DoctorItem {
  check: PrereqCheck;
  severity: DoctorSeverity;
}

export interface DoctorSummary {
  total: number;
  installed: number;
  missing: number;
  criticalMissing: number;
  warningMissing: number;
  optionalMissing: number;
  readinessPct: number;
  status: "healthy" | "critical" | "attention";
}

const CRITICAL_KEYS = new Set(["node", "git"]);
const WARNING_KEYS = new Set(["python", "rust", "pnpm", "yarn", "bun"]);

export function classifyDoctorCheck(key: string): DoctorSeverity {
  if (CRITICAL_KEYS.has(key)) return "critical";
  if (WARNING_KEYS.has(key)) return "warning";
  return "info";
}

export function buildDoctorItems(checks: PrereqCheck[]): DoctorItem[] {
  return checks.map((check) => ({
    check,
    severity: classifyDoctorCheck(check.key),
  }));
}

export function buildDoctorSummary(items: DoctorItem[]): DoctorSummary {
  const total = items.length;
  const installed = items.filter((item) => item.check.installed).length;
  const missing = total - installed;
  const criticalMissing = items.filter(
    (item) => item.severity === "critical" && !item.check.installed,
  ).length;
  const warningMissing = items.filter(
    (item) => item.severity === "warning" && !item.check.installed,
  ).length;
  const optionalMissing = items.filter(
    (item) => item.severity === "info" && !item.check.installed,
  ).length;

  return {
    total,
    installed,
    missing,
    criticalMissing,
    warningMissing,
    optionalMissing,
    readinessPct: total > 0 ? Math.round((installed / total) * 100) : 0,
    status: criticalMissing > 0 ? "critical" : missing > 0 ? "attention" : "healthy",
  };
}
