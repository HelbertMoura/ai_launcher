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

/** Result of `mcp_health_check`. */
export const McpHealthSchema = z.object({
  ok: z.boolean(),
  detail: z.string(),
});
export type McpHealth = z.infer<typeof McpHealthSchema>;

/** Server name gate — must match the backend `^[A-Za-z0-9_-]+$` validation. */
export function isValidMcpName(name: string): boolean {
  return name.length > 0 && /^[A-Za-z0-9_-]+$/.test(name);
}
