# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-06-11T20:40:40.459Z
> Files: 2 tracked | Anatomy hits: 0 | Misses: 0

## ../


## ../../../../.claude/projects/C--Users-Helbert-Desktop-DevManiacs-ai-launcher-tutra/memory/

- `v16-roadmap-progress.md` (~615 tok)

## ../../../../AppData/Local/Temp/

- `release-notes-v16.md` — ✨ Agent Analytics (~645 tok)

## ../.wolf/


## ../docs/superpowers/plans/


## ../docs/superpowers/specs/


## ../e2e/


## ../src/app/


## ../src/app/layout/


## ../src/domain/


## ../src/features/admin/sections/


## ../src/features/command-palette/


## ../src/features/costs/


## ../src/features/history/


## ../src/features/inbox/


## ../src/features/launcher/


## ../src/features/mcp/


## ../src/features/onboarding/


## ../src/features/workspace/


## ../src/hooks/


## ../src/i18n/locales/


## ../src/lib/


## ../src/lib/storage/


## ../src/providers/


## ../src/theme/


## ../src/ui/charts/


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


## src/


## src/app/


## src/app/layout/


## src/commands/


## src/domain/


## src/features/


## src/features/admin/


## src/features/admin/editors/


## src/features/admin/sections/


## src/features/command-palette/


## src/features/costs/


## src/features/help/


## src/features/history/


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


## v16.0 — arquivos novos (2026-06-11)

## Session notes — 2026-07-07 analysis

- `package.json` — scripts Vite/Tauri/test/e2e; React 19, Vite 8, TypeScript 6, Tauri 2 dependencies (~420 tok)
- `tsconfig.json` — strict TS config with noUnusedLocals/noUnusedParameters; includes only `src` (~120 tok)
- `vite.config.ts` — React plugin, port 5173 strict, `__APP_VERSION__` from package, build target/minify config (~150 tok)
- `src-tauri/Cargo.toml` — Tauri 2 Rust backend deps and release profile (~220 tok)
- `src-tauri/tauri.conf.json` — desktop window config min 1024x700, bundle MSI/NSIS config (~330 tok)
- `.github/workflows/release.yml` — tag-triggered Windows release workflow; cleans stale bundle artifacts, builds Tauri MSI/NSIS, uses docs/releases/<tag>.md body, uploads checksums/latest.json (~850 tok)
- `docs/releases/v16.0.1.md` — GitHub release body for v16.0.1 with highlights and validation commands (~240 tok)
- `docs/PRD-v20.md` — product requirements for v20 Command OS mega release; defines pillars, internal alpha/beta milestones, success criteria, risks (~1900 tok)
- `docs/superpowers/specs/2026-07-07-v20-command-os-design.md` — technical/product design for v20 Command OS: Command Center, Project Intelligence, Runbooks 2.0, MCP Hub, Sessions 2.0, trust guardrails (~1700 tok)
- `docs/superpowers/plans/2026-07-07-v20-command-os-plan.md` — implementation checklist for v20 alpha/beta phases with validation gates and concrete task breakdown (~1800 tok)
- `src/app/App.tsx` — main app shell, tabs, onboarding gate, budget/update inbox events, ChromeConnector status/sidebar/topbar wiring (~1600 tok)
- `src/app/App.css` — grid shell layout with fixed sidebar/topbar/statusbar and dotted bg (~80 tok)
- `src/app/onboarding.ts` — onboarding localStorage flags `ai-launcher:onboarding-done` and `ai-launcher:show-onboarding` (~90 tok)
- `src/app/layout/TabId.ts` — TabId union, order, labels, i18n keys and keyboard shortcuts; v20 adds command-center as Ctrl+1 default (~260 tok)
- `src/app/layout/Sidebar.tsx` / `Sidebar.css` — sidebar nav, indicators, version footer, fixed width visual style (~550 tok)
- `src/app/layout/TopBar.tsx` — command button, inbox, accent/theme/density/language controls (~450 tok)
- `src/theme/tokens.css` — global colors, spacing, radii, chrome sizes, focus, reduced motion (~350 tok)
- `src/features/launcher/LauncherPage.tsx` / `LauncherPage.css` — launcher grid, templates, dnd-kit ordering, install/launch flow, CLI card styles (~1500 tok)
- `src/features/launcher/CliCard.tsx` — CLI card, quick launch, recent/pinned dirs, local history append on quick launch (~900 tok)
- `src/features/launcher/LaunchDialog.tsx` — full launch flow with provider env, workspace env, `.ailauncher.json`, safe preview, templates (~1700 tok)
- `src/features/launcher/useClis.ts` / `clisStore.ts` — CLI snapshot store, Tauri invokes, sessionStorage cache, custom CLI listener (~900 tok)
- `src/features/launcher/launchSession.ts` — shared builtin CLI launch helper used by LaunchDialog/templates/quick launch; merges provider/workspace/project env, calls launch_cli, records history and recent dirs (~1050 tok)
- `src/features/command-center/CommandCenterPage.tsx` / `CommandCenterPage.css` — v20 alpha Command Center home page, workspace hero, quick actions, real workspace launch via launchCliSession, inline RunbooksPanel, real readiness cards, active sessions kill/recent replay, and null-safe Tauri boot reads (~1950 tok)
- `src/features/command-center/commandCenterModel.ts` — pure view-model builder for Command Center actions/readiness/sessions; merges active backend sessions with history and marks killable tracked sessions (~1350 tok)
- `src/features/command-center/commandCenterModel.test.ts` — vitest coverage for active workspace, empty state, compact recent sessions and active session priority/killable state (~650 tok)
- `src/features/project-intelligence/stackDetector.ts` — pure v20 stack detector from safe file/manifests snapshot; detects Tauri, React/Vite, Node, Rust, Python, Go, Docker, MCP and AI Launcher profile, returning primary stack and CLI/runbook/tag hints (~1500 tok)
- `src/features/project-intelligence/stackDetector.test.ts` — vitest coverage for Tauri+React, Python, Docker, .ailauncher hints and empty snapshots (~450 tok)
- `src/lib/projectProfile.ts` — zod schema/read/format/write helpers for `.ailauncher.json`; write helper validates/pretty-prints before invoking Rust writer (~650 tok)
- `src-tauri/src/commands/cli.rs` — launch/project-profile commands plus v20 `scan_project_stack(directory)` safe allowlist scanner and `write_project_profile(directory, contents)` fixed-path writer with JSON object validation and 256 KiB cap (~5600 tok)
- `src-tauri/src/main.rs` — Tauri invoke handler registration; v20 adds `scan_project_stack` and `write_project_profile` commands (~500 tok)
- `src/features/workspace/runbookPresets.ts` — local v20 Runbooks 2.0 presets for Node/Vite, Tauri/Rust, Rust, Python, Go, Docker and MCP; installs via `preset:<id>` marker tags to avoid duplicates (~1050 tok)
- `src/features/workspace/runbookPresets.test.ts` — vitest coverage for materialization, suggestion dedupe and one-time preset install behavior (~350 tok)
- `src/features/workspace/RunbooksPanel.tsx` / `Runbook.css` — runbook list/editor/runner host; v20 adds suggested preset cards, install button wired to detected project stack, and condition display styling (~1300 tok)
- `src/features/workspace/RunbookEditor.tsx` — runbook step editor; v20 adds optional condition controls (`fileExists`, `commandExists`, `envExists`, `previousSucceeded`, negate/value) (~1500 tok)
- `src/features/workspace/RunbookRunner.tsx` — runbook execution UI; evaluates optional conditions before running steps, skipping condition-failed steps and keeping previous step success state in frontend (~1450 tok)
- `src/features/workspace/runbookExecutionStore.ts` — local v20 execution log store for runbooks; persists run id/status/cwd, step status/output/duration, caps output and retains latest 50 executions (~1050 tok)
- `src/features/workspace/runbookExecutionStore.test.ts` — vitest coverage for starting executions, step updates/output cap/duration and runbook-scoped history (~450 tok)
- `src-tauri/src/commands/runbook.rs` — runbook backend; executes sanitized steps and v20 adds `evaluate_runbook_condition` for safe file/command/env checks with traversal/env validation (~1700 tok)
- `src/features/tools/toolsStore.ts` — shared tools/custom IDE store; now uses invokeOrFallback for non-destructive boot reads so Command Center can consume tools outside Tauri without crashing (~700 tok)
- `src-tauri/src/commands/tools.rs` — tools install/launch backend; `launch_tool` accepts optional directory for Command Center Open IDE while preserving old default home behavior (~1000 tok)
- `src/features/mcp/mcpStore.ts` — shared MCP server store; uses invokeOrFallback for list_mcp_servers so browser/Design QC boot does not crash (~520 tok)
- `src/features/mcp/projectMcp.ts` — pure helpers for v20 project-scoped MCP: server ids, profile resolution, health input and summary status (~650 tok)
- `src/features/mcp/projectMcp.test.ts` — vitest coverage for name/cli-qualified MCP matching, missing ids and health summary (~350 tok)
- `src/features/agents/agentProfileStore.ts` — v20 agent profile local store with CRUD, active profile id, pinning and normalization via storage registry (~650 tok)
- `src/features/agents/agentProfileStore.test.ts` — vitest coverage for agent profile add/update/pin/active clearing and normalization (~350 tok)
- `src/features/history/historyFilters.ts` — pure v20 persisted session filter helpers for status/cli/provider/window state (~450 tok)
- `src/features/history/historyFilters.test.ts` — vitest coverage for history filter normalization and persistence edge cases (~250 tok)
- `src/features/admin/sections/ConfigBackupSection.tsx` — Admin backup/export/import UI with manifest preview, known/unknown key counts and merge/replace actions (~900 tok)
- `src/lib/configIO.ts` — config export/import helpers; v20 adds manifest metadata, recursive secret redaction and import preview without writing (~1200 tok)
- `src/lib/configIO.test.ts` — tests for backup manifest, provider secret merge, generic redaction and preview behavior (~950 tok)
- `src/features/updates/AppUpdater.tsx` / `UpdatesPage.css` — self-updater UI; v20 adds trust chain indicators for latest.json/SHA-256/GitHub Release (~520 tok)
- `scripts/audit-release.sh` — GitHub release asset audit; v20 validates downloaded latest.json content against tag/version/windows URLs/release notes (~650 tok)
- `docs/releases/v20.0.0.md` — public GitHub release notes for Command OS v20 (~350 tok)
- `docs/releases/v20-checklist.md` — operational v20 release checklist covering local gates, assets, latest.json and smoke tests (~520 tok)
- `docs/command-os-v20.md` — public guide for Command Center, Project Intelligence, Runbooks 2.0, MCP por projeto, backup/update trust (~850 tok)
- `docs/screenshots/v20/` — generated v20 README screenshot set for Command Center, Workspaces/Runbooks, MCP, History and Updates (~5 png)
- `src/features/workspace/WorkspacePage.tsx` / `WorkspacePage.css` — workspace CRUD UI, bento dashboard, agent profile CRUD/active banner, budget/doctor/runbook/session cards, forms (~3600 tok)
- `src/features/workspace/workspaceStore.ts` — workspace localStorage CRUD, import/export with secret redaction, active workspace helpers (~700 tok)
- `src/features/costs/CostsPage.tsx` — usage analytics, export CSV/JSON, charts, budget dashboard (~900 tok)
- `src/features/mcp/McpPage.tsx` — MCP CRUD UI, catalog, health checks, confirmation dialog (~1000 tok)
- `src/lib/tauri.ts` — small runtime guard for Vite/browser QA: `isTauriRuntime()` and `invokeOrFallback<T>()` (~120 tok)
- `src/ui/Card.css` — shared card surface/interactivity styling (~80 tok)
- `e2e/launcher.spec.ts` — Playwright smoke/a11y spec; now expects Command Center as default page after onboarding (~450 tok)
