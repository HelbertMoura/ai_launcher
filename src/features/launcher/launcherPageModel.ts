import type { CheckResult, CliInfo } from "./useClis";

export interface LauncherOverview {
  total: number;
  installed: number;
  missing: number;
  updates: number;
}

export function buildLauncherOverview(
  clis: CliInfo[],
  customCliCount: number,
  checks: Record<string, CheckResult>,
  updateNames: ReadonlySet<string>,
): LauncherOverview {
  const installedBuiltins = clis.filter((cli) => checks[cli.name]?.installed).length;
  const installed = installedBuiltins + customCliCount;
  const total = clis.length + customCliCount;
  return {
    total,
    installed,
    missing: Math.max(0, total - installed),
    updates: clis.filter((cli) => updateNames.has(cli.name)).length,
  };
}
