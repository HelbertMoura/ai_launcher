import type { PrereqCheck } from "./usePrerequisites";
import { buildDoctorItems, buildDoctorSummary } from "../workspace/doctorPageModel";

export interface PrereqsPageSummary {
  total: number;
  installed: number;
  missing: number;
  readinessPct: number;
  requiredMissing: number;
  recommendedMissing: number;
  optionalMissing: number;
}

export function buildPrereqsPageSummary(items: PrereqCheck[]): PrereqsPageSummary {
  const summary = buildDoctorSummary(buildDoctorItems(items));
  return {
    total: summary.total,
    installed: summary.installed,
    missing: summary.missing,
    readinessPct: summary.readinessPct,
    requiredMissing: summary.criticalMissing,
    recommendedMissing: summary.warningMissing,
    optionalMissing: summary.optionalMissing,
  };
}
