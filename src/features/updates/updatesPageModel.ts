import type { UpdatesSummary } from "../../hooks/useUpdates";

export interface UpdatesOverview {
  cliUpdates: UpdatesSummary["cli_updates"];
  envUpdates: UpdatesSummary["env_updates"];
  toolUpdates: UpdatesSummary["tool_updates"];
  missingPrereqs: number;
  missingClis: number;
  total: number;
  checkedAt: string | null;
}

export function buildUpdatesOverview(
  summary: UpdatesSummary | null,
  missingPrereqs: number,
  missingClis: number,
): UpdatesOverview {
  const cliUpdates = summary?.cli_updates.filter((update) => update.has_update) ?? [];
  const envUpdates = summary?.env_updates.filter((update) => update.has_update) ?? [];
  const toolUpdates = summary?.tool_updates.filter((update) => update.has_update) ?? [];

  return {
    cliUpdates,
    envUpdates,
    toolUpdates,
    missingPrereqs,
    missingClis,
    total:
      cliUpdates.length +
      envUpdates.length +
      toolUpdates.length +
      missingPrereqs +
      missingClis,
    checkedAt: summary?.checked_at ?? null,
  };
}
