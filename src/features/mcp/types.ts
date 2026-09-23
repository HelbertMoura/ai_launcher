import { z } from "zod";

/** Which managed CLI a server belongs to. Mirrors the Rust `McpCli` enum. */
export const McpCliSchema = z.enum(["claude", "codex", "gemini"]);
export type McpCli = z.infer<typeof McpCliSchema>;

export const MCP_CLIS: McpCli[] = ["claude", "codex", "gemini"];

/** Transport kind. Mirrors the Rust `McpTransport` enum. */
export const McpTransportSchema = z.enum(["stdio", "http"]);
export type McpTransport = z.infer<typeof McpTransportSchema>;

/**
 * A unified MCP server descriptor as returned by `list_mcp_servers`.
 *
 * Secret-bearing fields are redacted by the backend: only `headers_keys` and
 * `env_keys` arrive here — never the values.
 */
export const McpServerSchema = z.object({
  name: z.string(),
  cli: McpCliSchema,
  transport: McpTransportSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  headers_keys: z.array(z.string()).default([]),
  env_keys: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const McpServerListSchema = z.array(McpServerSchema);

/** A non-fatal read/parse failure for one CLI's MCP config file. */
export const McpConfigWarningSchema = z.object({
  cli: McpCliSchema,
  path: z.string(),
  message: z.string(),
});
export type McpConfigWarning = z.infer<typeof McpConfigWarningSchema>;

/** Payload of `list_mcp_servers`: merged servers plus per-CLI warnings. */
export const McpListResultSchema = z.object({
  servers: z.array(McpServerSchema),
  warnings: z.array(McpConfigWarningSchema).default([]),
});
export type McpListResult = z.infer<typeof McpListResultSchema>;

/**
 * Input payload for `add_mcp_server` / `update_mcp_server`. Carries the full
 * (secret-bearing) values written to disk. Never serialized back from the
 * backend.
 */
export interface McpServerInput {
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled: boolean;
}

/** Outcome discriminators of `mcp_health_check`. Mirrors the Rust enum. */
export const McpHealthStateSchema = z.enum(["ok", "fail", "disabled"]);
export type McpHealthState = z.infer<typeof McpHealthStateSchema>;

/**
 * Result of `mcp_health_check`. `disabled` = the server is switched off, so
 * the backend never probes it and the UI must render a neutral state.
 */
export const McpHealthSchema = z.object({
  state: McpHealthStateSchema,
  ok: z.boolean(),
  detail: z.string(),
});
export type McpHealth = z.infer<typeof McpHealthSchema>;

/** Server name gate — must match the backend `^[A-Za-z0-9_-]+$` validation. */
export function isValidMcpName(name: string): boolean {
  return name.length > 0 && /^[A-Za-z0-9_-]+$/.test(name);
}
