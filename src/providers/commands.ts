// ============================================================================
// Provider command layer — the only place in the provider domain that touches
// `invoke` directly (mirrors `mcp/commands.ts`). Errors keep surfacing as raw
// strings.
// ============================================================================

import { invoke } from "@tauri-apps/api/core";

/** Raw `test_provider_connection` payload (`ProviderTestResult` on the Rust side). */
export interface TestResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

/** Args forwarded verbatim, so the wire payload is stable. */
export type TestProviderConnectionArgs = {
  baseUrl: string;
  apiKey: string;
  model: string;
  protocol: string | null;
};

export function testProviderConnection(
  args: TestProviderConnectionArgs,
): Promise<TestResult> {
  return invoke("test_provider_connection", args);
}
