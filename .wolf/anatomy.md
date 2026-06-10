# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-06-10T14:26:07.467Z
> Files: 24 tracked | Anatomy hits: 0 | Misses: 0

## ../.wolf/

- `buglog.json` — /*.jsonl (linhas type=assistant com message.usage), Codex em ~/.codex/sessions/YYYY/MM/DD/rollout-*. (~10638 tok)
- `cerebrum.md` — Cerebrum (~2199 tok)

## ../src/app/

- `App.tsx` — IS_MAC (~4106 tok)

## ../src/domain/

- `profileStore.ts` — Ensure migration has run, then load all profiles. (~916 tok)

## ../src/features/costs/

- `BudgetDashboard.tsx` — ============================================================================== (~2244 tok)
- `useUsage.ts` — Logical provider behind the CLI (e.g. "anthropic" for Claude, "openai" for (~415 tok)

## ../src/features/history/

- `useHistory.ts` — Migrate legacy items that lack the new session-lifecycle fields. (~2410 tok)
- `useSessionEvents.test.ts` — CONFIG_KEY: seedHistory, readHistory, baseItem (~800 tok)
- `useSessionEvents.ts` — Payload emitted by the Rust backend when a tracked session ends. (~651 tok)

## ../src/features/workspace/

- `workspaceStore.ts` — Keys that look like secrets — redacted during export. (~1237 tok)

## ../src/lib/

- `configIO.test.ts` — Declares result (~2325 tok)
- `configIO.ts` — Redact a single backup value just before it leaves the machine. (~2880 tok)

## ../src/lib/storage/

- `index.ts` — Low-level: read the raw deserialized value for an entry, or undefined. (~1326 tok)
- `keys.ts` — ============================================================================== (~674 tok)
- `registry.ts` — Schema used to validate the deserialized value on load. (~3291 tok)

## ../src/providers/

- `budget.test.ts` — entry: todayISO, daysAgoISO (~1672 tok)
- `budget.ts` — Optional explicit period anchor (YYYY-MM-DD). When set, the budget period (~2704 tok)

## ./


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

- `session.rs` — Session engine: registro global OnceLock<Mutex<HashMap>> de sessoes ativas; track_child (tokio child.wait -> emit session-ended completed/failed+duration), register_detached (wt.exe -> emit detached imediato); comandos list_active_sessions/kill_session (taskkill /T /F); 6 testes #[cfg(test)]. (~1100 tok)

## src/

- `main.rs` (~1333 tok)

## src/app/


## src/app/layout/


## src/commands/

- `cli.rs` — Result returned by all launch commands. (~4130 tok)
- `config.rs` — /*.jsonl, one event per line. We care about (~8714 tok)
- `mod.rs` (~33 tok)
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

