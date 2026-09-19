// ============================================================================
// CLI inventory command layer — the only place in the launcher feature that
// touches `invoke` directly (mirrors `mcp/commands.ts`). Errors keep
// surfacing as raw strings.
// ============================================================================

import { invoke } from "@tauri-apps/api/core";
import type { CliInfo } from "./useClis";

export function getAllClis(): Promise<CliInfo[]> {
  return invoke<CliInfo[]>("get_all_clis");
}
