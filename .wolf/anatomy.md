# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-06-10T19:11:46.805Z
> Files: 60 tracked | Anatomy hits: 0 | Misses: 0

## ../

- `tsconfig.json` — TypeScript configuration (~183 tok)

## ../.wolf/

- `anatomy.md` — anatomy.md (~1776 tok)
- `buglog.json` — /*.jsonl (linhas type=assistant com message.usage), Codex em ~/.codex/sessions/YYYY/MM/DD/rollout-*. (~14740 tok)
- `cerebrum.md` — Cerebrum (~3360 tok)

## ../src/app/

- `App.tsx` — IS_MAC (~4138 tok)

## ../src/app/layout/

- `Sidebar.tsx` — Sidebar (~989 tok)
- `TabId.ts` — i18n keys for each tab (used by Sidebar + CommandPalette). (~410 tok)
- `TopBar.tsx` — CMD_KEY_LABEL (~952 tok)

## ../src/domain/

- `profileStore.ts` — Ensure migration has run, then load all profiles. (~916 tok)

## ../src/features/admin/sections/

- `AppearanceSection.tsx` — THEMES (~2021 tok)

## ../src/features/command-palette/

- `CommandPalette.tsx` — Simple subsequence fuzzy match (case-insensitive). (~4909 tok)

## ../src/features/costs/

- `BudgetDashboard.tsx` — ============================================================================== (~2244 tok)
- `useUsage.ts` — Logical provider behind the CLI (e.g. "anthropic" for Claude, "openai" for (~415 tok)

## ../src/features/history/

- `useHistory.ts` — Migrate legacy items that lack the new session-lifecycle fields. (~2410 tok)
- `useSessionEvents.test.ts` — CONFIG_KEY: seedHistory, readHistory, baseItem (~800 tok)
- `useSessionEvents.ts` — Payload emitted by the Rust backend when a tracked session ends. (~651 tok)

## ../src/features/launcher/

- `LaunchDialog.tsx` — Parsed `.ailauncher.json` for the chosen directory, when present. (~6372 tok)

## ../src/features/mcp/

- `catalog.test.ts` — Declares ids (~676 tok)
- `catalog.ts` — A pre-filled MCP server template the user can add with one click. (~1592 tok)
- `McpPage.css` — Styles: 27 rules (~875 tok)
- `McpPage.tsx` — Build the secret-free input the health check needs from a listed server. (~2913 tok)
- `McpServerDialog.tsx` — Pre-fill payload for the dialog. `cli` may be locked (edit mode) or free (~2664 tok)
- `mcpStore.ts` — Shared MCP store. Mirrors the `clisStore` pattern: a single in-memory (~654 tok)
- `types.ts` — Which managed CLI a server belongs to. Mirrors the Rust `McpCli` enum. (~552 tok)
- `useMcp.ts` — Subscribes to the shared MCP store and exposes the CRUD commands. Every (~577 tok)

## ../src/features/onboarding/

- `OnboardingPage.tsx` — THEMES (~3535 tok)

## ../src/features/workspace/

- `RunbookRunner.tsx` — Structured result returned by the Rust `run_runbook_step` command. (~2610 tok)
- `RunbooksPanel.tsx` — Working directory forwarded to runbook step execution. (~1310 tok)
- `WorkspacePage.tsx` — CRITICAL_NAMES (~7856 tok)
- `workspaceStore.ts` — Keys that look like secrets — redacted during export. (~1237 tok)

## ../src/hooks/

- `useTheme.ts` — Exports Theme, THEMES, nextTheme, useTheme (~572 tok)

## ../src/i18n/locales/

- `en.ts` — Exports en (~4432 tok)
- `pt-BR.ts` — Exports ptBR (~4657 tok)

## ../src/lib/

- `configIO.test.ts` — Declares result (~2325 tok)
- `configIO.ts` — Redact a single backup value just before it leaves the machine. (~2880 tok)
- `projectProfile.test.ts` — Declares raw (~1300 tok)
- `projectProfile.ts` — Schema for a `.ailauncher.json` file. Every field except `version` is optional. (~1363 tok)

## ../src/lib/storage/

- `index.ts` — Low-level: read the raw deserialized value for an entry, or undefined. (~1326 tok)
- `keys.ts` — ============================================================================== (~674 tok)
- `registry.ts` — Schema used to validate the deserialized value on load. (~3291 tok)

## ../src/providers/

- `budget.test.ts` — entry: todayISO, daysAgoISO (~1672 tok)
- `budget.ts` — Optional explicit period anchor (YYYY-MM-DD). When set, the budget period (~2704 tok)

## ../src/theme/

- `contract.ts` — CSS variables a complete theme block must declare. (~555 tok)
- `index.css` — Styles: 13 rules (~325 tok)
- `theme-amber.css` — Styles: 18 vars (~232 tok)
- `theme-contract.test.ts` — API routes: GET (2 endpoints) (~785 tok)
- `theme-high-contrast.css` — Styles: 1 rules, 21 vars (~370 tok)
- `theme-midnight.css` — Styles: 19 vars (~236 tok)
- `theme-phosphor.css` — Styles: 19 vars (~256 tok)

## ./

- `Cargo.toml` — Rust package manifest (~321 tok)

## .claude/


## .claude/rules/


## .github/


## .github/DISCUSSION_TEMPLATE/


## .github/ISSUE_TEMPLATE/


## .github/workflows/


## .playwright-mcp/


## .superpowers/brainstorm/109463-1776872103/content/


## .superpowers/brainstorm/109463-1776872103/state/


## .superpowers/brainstorm/337048-1776908517/state/


## dist-admin/


## dist-admin/assets/


## dist-public/


## dist-public/assets/


## docs/


## docs/archive/


## docs/superpowers/plans/


## docs/superpowers/specs/


## e2e/


## public/


## public/images/


## scripts/


## scripts/certs/


## src-tauri/


## src-tauri/capabilities/


## src-tauri/gen/schemas/


## src-tauri/src/


## src-tauri/src/commands/

- `mcp.rs` — MCP Manager backend (B1). Le/edita configs MCP dos 3 CLIs: Claude ~/.claude/.mcp.json (JSON), Codex ~/.codex/config.toml (TOML via toml_edit, format-preserving), Gemini ~/.gemini/config/mcp_config.json (JSON, preserva $typeName). Comandos: list_mcp_servers (unificado, REDIGE headers/env -> so headers_keys/env_keys), add/update/remove_mcp_server (backup .bak-<ts> antes de escrever, valida name ^[A-Za-z0-9_-]+$), mcp_health_check (stdio=command_exists; http=reachable unknown, sem net). 14 testes #[cfg(test)] com fixtures inline. (~9300 tok)
- `session.rs` — Session engine: registro global OnceLock<Mutex<HashMap>> de sessoes ativas; track_child (tokio child.wait -> emit session-ended completed/failed+duration), register_detached (wt.exe -> emit detached imediato); comandos list_active_sessions/kill_session (taskkill /T /F); 6 testes #[cfg(test)]. (~1100 tok)

## src/

- `main.rs` (~1438 tok)

## src/app/


## src/app/layout/


## src/commands/

- `cli.rs` — Result returned by all launch commands. (~4873 tok)
- `config.rs` — /*.jsonl, one event per line. We care about (~8714 tok)
- `mcp.rs` — MCP (Model Context Protocol) server manager. (~9259 tok)
- `mod.rs` (~42 tok)
- `runbook.rs` — Runbook step execution (B3). (~1836 tok)
- `session.rs` — How a session was launched, which determines whether we can measure it. (~2799 tok)

## src/domain/


## src/features/


## src/features/admin/


## src/features/admin/editors/


## src/features/admin/sections/


## src/features/command-palette/


## src/features/costs/


## src/features/help/


## src/features/history/

- `useSessionEvents.ts` — listener global listen('session-ended') montado 1x no App.tsx; valida payload com zod; aplica markSessionEnded (completed/failed) ou updateSessionStatus (detached). applySessionEnded exportado+testado. (~600 tok)

## src/features/launcher/


## src/features/mcp/


## src/features/onboarding/


## src/features/prereqs/


## src/features/tools/


## src/features/updates/


## src/features/workspace/


## src/hooks/


## src/i18n/


## src/i18n/locales/


## src/icons/


## src/lib/


## src/presets/


## src/providers/


## src/test/


## src/theme/


## src/ui/


## test-results/

