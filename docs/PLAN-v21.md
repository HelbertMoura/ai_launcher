# AI Launcher v21 — Implementation Plan

Specification: [PRD-v21.md](./PRD-v21.md)  
Execution model: incremental vertical slices, local validation before Git operations  
Release theme: Trust & Flow / Command Deck

## Execution progress

- 2026-07-11 — M0 complete: scripts, build metrics, explicit Tauri E2E stub, dependency/capability CI gates and two visual baselines.
- 2026-07-11 — M1 complete locally: Windows Credential Manager, fail-closed provider flow, reduced Tauri capabilities, backend-owned verified updater and zero npm audit findings.
- 2026-07-12 — M2 complete locally: production persistence migrated to the typed registry/scoped adapters, schema v1 migration manifest is idempotent and secret-safe, mutable defaults fixed and CI blocks new direct `localStorage` access.
- 2026-07-12 — M3 complete locally: sans/mono typography roles, semantic surfaces, higher contrast, accessible control heights, refreshed shared controls/dialogs/cards and responsive onboarding validated with DesignQC and Playwright.
- 2026-07-12 — M4 complete locally: collapsible icon navigation, primary command search, quick settings popover, truthful execution-mode status and verified 1024x700 layout/keyboard operation.
- 2026-07-12 — M5 complete locally: explicit Command Center states, guided empty flow, focused action/health/context/activity hierarchy, editable project-profile preview, execution modes and bounded redacted local audit trail.
- 2026-07-13 — M6 complete locally: explicit Runbooks 3.0 state machine, real process-tree stop, dry-run/per-step approval/retry/resume, secret-free resumable cursors, searchable bounded output and a redacted workspace-scoped unified timeline.
- 2026-07-13 — M7 Wave A complete locally: Launcher, Workspaces and History/Sessions now use operational summaries, explicit hierarchy/states, accessible controls and page models; 3 pages × 3 themes pass visual regression and Axe WCAG AA.
- 2026-07-13 — M7 Wave B complete locally: MCP, Updates and Admin providers/security/backup now expose operational/trust/recovery posture, typed page models, localized copy and confirmed destructive flows; 5 surfaces × 3 themes pass visual regression, Axe and keyboard checks.
- 2026-07-13 — M7 Wave C complete locally: Onboarding, Analytics, Doctor, Prerequisites and Help now expose guided readiness/spend/support posture, safe install/fix previews, localized copy and pure summary models; 5 surfaces × 3 themes pass visual regression, Axe and keyboard checks.
- 2026-07-13 — M8 complete locally: critical workflow E2E expanded to 60 total Playwright scenarios, packaged Windows smoke/readiness scripts added, and quality/build/release workflows now run the release-readiness contract before packaging or publishing.
- 2026-07-13 — v21.0.0 release-candidate packaging dry run complete: local Tauri build generated MSI/NSIS/exe, packaged smoke validated ProductVersion 21.0.0, main-window boot and single-instance behavior; public docs/screenshots/changelog updated for GitHub release.
- Next proposed slice: push tag `v21.0.0`, let GitHub Actions build/sign-if-configured/publish installers, then audit the remote release assets.

## Planning rules

- Do not use a big-bang rewrite. Every milestone must leave the application buildable.
- Security P0 work precedes visual and product expansion.
- Preserve existing user data with versioned, idempotent migrations.
- Keep `launchCliSession` as the only built-in CLI launch path.
- Add pt-BR keys first, then mirror them in English.
- Do not push, tag or publish without explicit user confirmation.
- Run targeted tests during a task and the complete local gate at every milestone exit.
- Capture Design QC screenshots before and after every visual milestone at 1024x700 and 1280x860.

## Milestone map

| Milestone | Outcome | Depends on |
|---|---|---|
| M0 | Reproducible v21 baseline and regression fixtures | — |
| M1 | P0 security defects removed | M0 |
| M2 | Versioned persistence and safe migrations | M1 |
| M3 | Command Deck tokens and shared components | M0 |
| M4 | App Shell 2.0 | M3 |
| M5 | Command Center 2.0 and project onboarding | M2, M4 |
| M6 | Runbooks 3.0 and unified timeline | M2, M5 |
| M7 | Required page visual migrations | M3, M4 |
| M8 | Packaged-app quality and trusted release | M1–M7 |

## M0 — Baseline and guardrails

### M0.1 Capture the current contract

Files:

- `package.json`
- `src-tauri/Cargo.toml`
- `.github/workflows/quality.yml`
- `playwright.config.ts`
- `e2e/launcher.spec.ts`

Work:

1. Add scripts for `typecheck`, `check`, `check:rust`, `audit` and targeted E2E execution.
2. Add an npm audit job that distinguishes production dependencies from tooling dependencies.
3. Capture baseline bundle sizes and build duration in CI artifacts.
4. Add screenshot fixtures for onboarding, empty Command Center and configured Command Center.
5. Add a test helper that provides typed Tauri command stubs instead of a catch-all `return null`.

Acceptance:

- Existing 184 frontend tests, 72 Rust tests and 3 E2E scenarios remain green.
- CI reports bundle size and audit results without changing runtime behavior.
- Browser tests fail when a newly invoked Tauri command has no explicit stub.

## M1 — Trust Foundation

### M1.1 Replace fail-open secret storage

Files:

- `src/lib/secrets.ts`
- `src/providers/storage.ts`
- `src-tauri/src/secrets.rs`
- `src-tauri/src/main.rs`
- `src-tauri/Cargo.toml`
- new `src-tauri/src/commands/credentials.rs` if the backend is separated

Work:

1. Implement native Windows credential protection without PowerShell subprocesses.
2. Use one protected record per logical secret with schema version and algorithm metadata.
3. Make packaged-app writes fail closed; use session-memory storage only in browser development.
4. Return a structured storage result instead of an ignored boolean.
5. Add an idempotent migration from:
   - `ai-launcher-secret:*` localStorage keys;
   - legacy `secrets.json` DPAPI entries;
   - legacy base64 entries.
6. Verify each migrated secret before removing its source.
7. Redact credential identifiers and values from logs and errors.

Tests:

- secure round trip;
- multiple entries with independent metadata;
- legacy mixed-mode migration;
- DPAPI/credential failure does not persist plaintext;
- interrupted migration is safe to retry;
- provider save/load/delete remains compatible.

Acceptance:

- No production code writes API keys to localStorage.
- No secret value appears in a spawned process command line.
- Migration preserves all recoverable credentials and never deletes unverified source data.

### M1.2 Minimize Tauri capabilities

Files:

- `src-tauri/capabilities/default.json`
- `src-tauri/src/main.rs`
- `package.json`
- `package-lock.json`

Work:

1. Remove the frontend shell plugin dependency if unused.
2. Remove shell open/execute/spawn/stdin/kill permissions.
3. Narrow dialog permissions to operations actually used.
4. Add a contract test or audit script that rejects forbidden broad permissions.
5. Document every remaining permission and its caller.

Acceptance:

- Launcher, tools, runbooks and session termination continue through narrow Rust commands.
- Capability audit contains no unused generic shell execution permission.

### M1.3 Make self-update atomic and backend-owned

Files:

- `src-tauri/src/commands/self_update.rs`
- `src/hooks/useAppUpdate.ts`
- `src/features/updates/AppUpdater.tsx`
- `scripts/audit-release.sh`

Work:

1. Replace frontend-supplied raw URL/path parameters with an opaque backend release candidate.
2. Validate GitHub repository, HTTPS host, exact asset name, extension and architecture.
3. Use a canonical temp directory, safe filename extraction, `create_new` and download-size cap.
4. Combine download and checksum verification in one command.
5. Clean partial files on cancellation, mismatch and process failure.
6. Return structured progress and verification states to the UI.

Tests:

- malicious host;
- traversal/backslash filename;
- oversized response;
- checksum mismatch;
- interrupted download;
- exact NSIS/MSI asset selection;
- stale temp artifact cleanup.

Acceptance:

- The frontend cannot choose an arbitrary download URL or local destination.
- No unverified installer path is returned as ready to execute.

### M1.4 Dependency cleanup

Files:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.lock`

Work:

1. Remove unused `to-ico` and its legacy dependency chain.
2. Update Vite, Vitest, jsdom/undici and compatible patch/minor dependencies.
3. Update `anyhow` transitively to a patched version.
4. Re-run full npm and cargo audits and document unavoidable target-specific warnings.

Acceptance:

- Production audit has zero findings.
- Full npm graph has no high or critical finding.
- Cargo audit has no vulnerability or relevant unsound warning on the Windows target.

## M2 — Versioned persistence

### M2.1 Complete storage registry migration

Files:

- `src/lib/storage/keys.ts`
- `src/lib/storage/registry.ts`
- `src/lib/storage/index.ts`
- all 28 production files with direct localStorage access

Work:

1. Inventory every static and dynamic key.
2. Move static keys behind typed `readKey`, `writeKey` and `removeKey` APIs.
3. Add scoped typed helpers for dynamic keys such as pinned directories and provider test state.
4. Remove direct localStorage calls outside the storage and secret adapters.
5. Introduce a storage-event abstraction for cross-window changes.

Acceptance:

- A repository check rejects new direct localStorage usage outside approved adapters.
- Corrupt values fall back safely without losing unrelated state.

### M2.2 Migration coordinator and recovery

New/updated files:

- new `src/lib/storage/migrations.ts`
- new `src/lib/storage/migrations.test.ts`
- `src/lib/configIO.ts`
- `src/app/App.tsx`
- Admin backup UI

Work:

1. Define current schema version and ordered migrations.
2. Create a redacted pre-migration snapshot.
3. Execute migrations atomically per key and record completion only after validation.
4. Show recovery UI when migration cannot complete.
5. Support export of a diagnostic manifest without secrets.

Acceptance:

- Re-running any migration is safe.
- Simulated interruption at each migration step preserves a recoverable state.

## M3 — Command Deck visual foundation

### M3.1 Semantic token contract

Files:

- `src/theme/tokens.css`
- `src/theme/fonts.css`
- `src/theme/contract.ts`
- all `theme-*.css`
- `src/theme/theme-contract.test.ts`

Work:

1. Define semantic tokens for canvas, navigation, surfaces, overlays, text levels, borders, state colors, focus, elevation and motion.
2. Define typography roles using system UI for reading and monospace for commands/data.
3. Provide compact and comfortable density tokens while keeping accessible hit targets.
4. Align dark, light, midnight, phosphor, glacier, amber and high-contrast themes to one contract.
5. Add contrast tests for text and component boundaries on actual surface combinations.

Acceptance:

- No migrated component consumes raw color literals for product states.
- Theme contract and WCAG contrast tests pass for required combinations.

### M3.2 Shared component refresh

Files:

- `src/ui/Button.*`
- `src/ui/Card.*`
- `src/ui/Input.*`
- `src/ui/Dialog.*`
- `src/ui/ConfirmDialog.*`
- `src/ui/EmptyState.*`
- `src/ui/Banner.*`
- `src/ui/Chip.*`
- `src/ui/Skeleton.*`
- `src/ui/Tooltip.*`
- `src/ui/SafeCommandPreview.*`

Work:

1. Normalize sizes, states, focus rings, disabled/loading behavior and accessible names.
2. Add shared `PageHeader`, `SectionHeader`, `Metric`, `ActionCard`, `StatusDot` and `Toolbar` primitives only where repeated usage is proven.
3. Remove ad-hoc visual variants duplicated across feature CSS.
4. Add component interaction/a11y tests for keyboard and focus behavior.

Acceptance:

- Core components look and behave consistently in every theme and density.
- Reduced-motion mode removes nonessential transitions.

## M4 — App Shell 2.0

Files:

- `src/app/App.tsx`
- `src/app/App.css`
- `src/app/layout/Sidebar.*`
- `src/app/layout/TopBar.*`
- `src/app/layout/StatusBar.*`
- `src/app/layout/TabId.ts`
- command palette files

Work:

1. Implement collapsible navigation with icons, labels and stable keyboard traversal.
2. Simplify active-state styling and separate workspace/system/support groups.
3. Make command search the top-bar primary control.
4. Move appearance/language/density controls into quick settings.
5. Redesign status bar around session, connection, security mode and version.
6. Guarantee no clipping at 1024x700 and 125% Windows scaling.
7. Preserve all existing shortcuts and onboarding behavior.

Acceptance:

- Full shell is keyboard operable with visible focus.
- Screenshots pass at minimum, default and large desktop sizes.
- No page content is hidden behind the status bar.

## M5 — Command Center 2.0

### M5.1 Split model, controller and view

Files:

- `src/features/command-center/CommandCenterPage.tsx`
- `src/features/command-center/commandCenterModel.ts`
- new focused hooks/components under the same feature

Work:

1. Move boot orchestration into a dedicated controller hook.
2. Keep project/action/readiness/session derivation pure in view-model functions.
3. Split workspace header, next action, live activity and intelligence into focused components.
4. Remove stale `v20 alpha` copy and revise both dictionaries.

Acceptance:

- Main page container is substantially smaller and its states are unit tested.
- Empty, loading, error, ready, running and degraded states are explicit.

### M5.2 Guided project onboarding

Work:

1. Build an editable scan result preview.
2. Explain proposed CLI, provider, agent, MCP and runbook selections.
3. Preview `.ailauncher.json` and affected files before writing.
4. Route the user directly into safe launch or runbook dry-run after confirmation.

Acceptance:

- A new project reaches a safe first session from the Command Center in at most two page transitions.

### M5.3 Execution modes and audit trail

New/updated areas:

- execution-mode domain/store
- Admin security section
- command preview and privileged actions
- local redacted audit event store

Acceptance:

- Safe, Standard and temporary Admin modes produce deterministic approval behavior.
- Audit records never contain provider secrets or full environment values.

## M6 — Runbooks 3.0 and timeline

### M6.1 Runbook execution state machine

Files:

- `RunbookRunner.tsx`
- `runbookExecutionStore.ts`
- `RunbookEditor.tsx`
- Rust runbook command module

Work:

1. Extract an explicit run state machine.
2. Add dry-run, per-step approval, stop, retry and resume.
3. Persist a resumable plan without persisting secrets.
4. Add searchable/copyable bounded output.

### M6.2 Unified workspace timeline

Work:

1. Normalize session, runbook, MCP and privileged configuration events.
2. Add filters and deep links to the originating feature.
3. Keep replay routed through shared validated services.

Acceptance:

- Interrupted runbooks resume deterministically.
- Timeline events remain bounded, redacted and workspace-scoped.

## M7 — Required page migrations

Execute in waves so each page is independently reviewable.

### Wave A

- [x] Launcher
- [x] Workspaces
- [x] History/Sessions

Wave A implementation notes:

- Launcher exposes ready/missing/update counts, saved-template context and a semantically named CLI catalog; custom CLIs count as ready and DnD semantics live on the handle instead of wrapping nested actions.
- Workspaces consolidates workspace + agent selection into one operating context, consumes canonical History state for active-session counts and removes the nested Runbooks interaction.
- History prioritizes live sessions, sorts active work before completed history, names every filter, provides a real empty state and uses keyboard-operable session notes.
- Pure page models cover Launcher readiness, Workspace activity and History outcome/priority derivation.
- Playwright locks all three pages in dark, light and high contrast, with Axe on every matrix cell and cold-compositor stabilization before screenshots.

### Wave B

- [x] MCP
- [x] Updates
- [x] Admin providers/security/backup

Wave B implementation notes:

- MCP now summarizes healthy/unavailable/checking servers and CLI coverage, groups managed servers by target CLI, keeps secrets redacted, exposes backup guarantees and makes horizontally scrollable commands keyboard reachable.
- Updates now counts and renders environment updates in addition to CLI/tool updates and missing installs, presents release posture and a three-step manifest/checksum/release trust chain, and exposes semantic download progress.
- Admin navigation is grouped into credentials/trust, experience and integrations. Providers show active routing and secure-credential posture; Security ranks risk and confirms audit deletion; Backup teaches export/preview/restore and confirms destructive replacement.
- Pure models cover MCP health, complete update attention totals and provider/secure-credential summaries.
- Playwright locks five Wave B surfaces in dark, light and high contrast (15 snapshots), with Axe on every cell, keyboard checks in dark and a serialized compositor-safe capture path on Windows.

### Wave C

- Onboarding now has a guided three-step rail, local-trust promises, theme/accent selection and scan-result metrics.
- Analytics now presents spend posture, trend/tokens/source metrics, export actions and localized Budget Guard copy.
- Doctor and prerequisites now share pure readiness summaries, group missing items by impact, keep commands keyboard-scrollable and require preview/confirmation before repair/install actions.
- Help now acts as a compact support hub with terminal identity, shortcuts, troubleshooting, links and real package version.

Pure models added/extended: `buildCostsOverview`, `doctorPageModel` and `prereqsPageModel`.
Playwright locks five Wave C surfaces in dark, light and high contrast (15 snapshots), with Axe on every cell and keyboard checks in dark.

Acceptance:

- Every required page passes the visual/a11y matrix in dark, light and high contrast. ✅
- No page introduces raw storage access or direct built-in CLI invokes. ✅

## M8 — Quality, packaging and release

### M8.1 Critical workflow E2E

Expand to at least 15 meaningful scenarios covering:

- onboarding;
- workspace CRUD;
- provider credential lifecycle;
- project scan/profile write;
- CLI launch/session lifecycle;
- runbook dry-run/stop/retry/resume;
- MCP backup/mutation/health;
- backup/import/recovery;
- updater failure paths;
- keyboard navigation.

Status: ✅ Complete locally. Added `e2e/critical-workflows.spec.ts` with 11 high-signal workflow scenarios on top of the existing smoke/visual suites. Full Playwright now runs 60 scenarios covering onboarding, workspace CRUD, provider secure credential lifecycle and failure, project scan/profile write, CLI session launch/kill, runbook approval/dry-run/retry/resume controls, MCP health/mutation, backup import/replace confirmation, updater failure paths and keyboard navigation.

### M8.2 Packaged Windows smoke harness

Work:

1. Build and launch the release executable in a clean test profile.
2. Verify WebView2 boot, single instance, tray behavior and credential round trip.
3. Test MSI/NSIS upgrade from v20 and uninstall behavior.
4. Validate signed binary metadata and update rollback.

Status: ✅ Local packaged dry run complete, ⏳ installer upgrade/uninstall and signed metadata remain remote/manual release checks. Added `npm run smoke:packaged`, backed by `scripts/smoke-packaged-app.mjs`, to launch an already-built release executable in an isolated WebView2/profile directory, inspect Windows metadata/signature status, wait for the visible main window and assert Tauri single-instance behavior. The local v21.0.0 Tauri build generated MSI/NSIS/exe and the smoke passed against `src-tauri/target/release/ai-launcher.exe`; local Authenticode status is expected to be unsigned unless CI signing secrets are configured.

### M8.3 Atomic release workflow

Files:

- `.github/workflows/quality.yml`
- `.github/workflows/build.yml`
- `.github/workflows/release.yml`
- `scripts/audit-release.sh`
- release documentation

Work:

1. Reuse one required quality workflow for PR, main and release candidates.
2. Assert tag/version consistency across npm, Cargo and Tauri manifests.
3. Build, sign, hash and generate SBOM/provenance before upload.
4. Create a draft GitHub release.
5. Audit the remote draft assets and manifest.
6. Publish only after all checks pass.

Acceptance:

- A failed audit never leaves a new public release.
- Stable releases cannot publish unsigned installers.

Status: ✅ Readiness contract wired, ⏳ remote publish now authorized and pending GitHub push/tag execution. Added `npm run release:readiness`, backed by `scripts/verify-v21-release-readiness.mjs`, to assert npm/Cargo/Tauri version consistency, release tag consistency when `RELEASE_TAG` is set, required scripts, MSI/NSIS targets, signing/audit/update-manifest workflow hooks, release docs and E2E breadth. `.github/workflows/quality.yml`, `build.yml` and `release.yml` now run this readiness contract before the heavier quality/build/release steps.

## Full local gate

Run at the end of every milestone:

```powershell
npm ci --legacy-peer-deps
npx tsc --noEmit
npm test
npm run build
npm run e2e
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo audit --file src-tauri/Cargo.lock
npm audit --omit=dev
```

Before a packaged smoke test, close every running `ai-launcher.exe` instance to avoid the known Windows file-lock/single-instance behavior.

## Execution checkpoints

After each milestone, report:

1. user-visible outcome;
2. files changed;
3. migrations or compatibility impact;
4. tests and audits run;
5. before/after screenshots for visual work;
6. remaining risks and the next milestone.

Do not create a branch, commit, push, tag or release unless the user explicitly requests that Git action.

## Recommended first execution slice

Start with M0 plus M1.1–M1.4. This removes the known security defects and vulnerable tooling before the visual refactor expands the changed surface. The first visual implementation begins only after the Trust Foundation gate is green.
