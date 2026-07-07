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
- `src/app/App.tsx` — main app shell, tabs, onboarding gate, budget/update inbox events, ChromeConnector status/sidebar/topbar wiring (~1600 tok)
- `src/app/App.css` — grid shell layout with fixed sidebar/topbar/statusbar and dotted bg (~80 tok)
- `src/app/onboarding.ts` — onboarding localStorage flags `ai-launcher:onboarding-done` and `ai-launcher:show-onboarding` (~90 tok)
- `src/app/layout/Sidebar.tsx` / `Sidebar.css` — sidebar nav, indicators, version footer, fixed width visual style (~550 tok)
- `src/app/layout/TopBar.tsx` — command button, inbox, accent/theme/density/language controls (~450 tok)
- `src/theme/tokens.css` — global colors, spacing, radii, chrome sizes, focus, reduced motion (~350 tok)
- `src/features/launcher/LauncherPage.tsx` / `LauncherPage.css` — launcher grid, templates, dnd-kit ordering, install/launch flow, CLI card styles (~1500 tok)
- `src/features/launcher/CliCard.tsx` — CLI card, quick launch, recent/pinned dirs, local history append on quick launch (~900 tok)
- `src/features/launcher/LaunchDialog.tsx` — full launch flow with provider env, workspace env, `.ailauncher.json`, safe preview, templates (~1700 tok)
- `src/features/launcher/useClis.ts` / `clisStore.ts` — CLI snapshot store, Tauri invokes, sessionStorage cache, custom CLI listener (~900 tok)
- `src/features/launcher/launchSession.ts` — shared builtin CLI launch helper used by LaunchDialog/templates/quick launch; merges provider/workspace/project env, calls launch_cli, records history and recent dirs (~1050 tok)
- `src/features/workspace/WorkspacePage.tsx` / `WorkspacePage.css` — workspace CRUD UI, bento dashboard, budget/doctor/runbook/session cards, form (~2600 tok)
- `src/features/workspace/workspaceStore.ts` — workspace localStorage CRUD, import/export with secret redaction, active workspace helpers (~700 tok)
- `src/features/costs/CostsPage.tsx` — usage analytics, export CSV/JSON, charts, budget dashboard (~900 tok)
- `src/features/mcp/McpPage.tsx` — MCP CRUD UI, catalog, health checks, confirmation dialog (~1000 tok)
- `src/lib/tauri.ts` — small runtime guard for Vite/browser QA: `isTauriRuntime()` and `invokeOrFallback<T>()` (~120 tok)
- `src/ui/Card.css` — shared card surface/interactivity styling (~80 tok)
