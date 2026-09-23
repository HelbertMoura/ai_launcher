# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Language note:** starting with the next release, new changelog entries are
> written in English, the repository's primary language. The existing pt-BR
> entries (15.x through 22.7) are kept below as-is, as a historical
> record — they were not translated.

## [Unreleased]

## [23.1.1] — 2026-09-23 — Bug fixes

The bug-fix release: top-bar dropdowns paint above the page again (they had been opening invisibly behind the main content since v22.5.0), MCP stdio health stops reporting "unavailable" for executables that resolve outside the GUI process PATH, switched-off MCP servers get an honest "Disabled" state with its own overview metric, MCP configuration failures show a friendly localized message instead of raw Zod output, and the MCP card layout stops squeezing server names and scrolling sideways.

### Fixed
- **Top-bar dropdowns painted behind the main content (since v22.5.0):** the notifications bell and quick-settings dropdowns opened invisible — clicks landed on the page and both buttons felt dead — because the top bar carried `contain: layout`, whose stacking context trapped the absolutely-positioned flyouts while the sibling main area (opaque background, its own stacking context) painted after it. The containment is removed so the flyouts' positive z-index paints above the page again, and a real hit-test regression guard now covers both panels in e2e: `document.elementFromPoint` at the open panel's center must return the panel or a descendant (`toBeVisible()` cannot catch paint-order bugs).
- **MCP stdio health no longer reports "unavailable" for executables outside the GUI process PATH:** path-form commands are validated by direct file existence after `%VAR%` expansion (trying `.exe`/`.cmd`/`.bat` variants), and bare names are additionally looked up in the common tool install dirs that never touch PATH — npm folders, `~\.local\bin`, `~\.cargo\bin`, scoop shims, and Python Scripts. Servers with `enabled == false` are never probed anymore: they answer a neutral "Disabled" state, which now shows as a fifth metric in the overview, and the health tooltip carries the exact failure reason. Honest scope, unchanged from the feature: stdio health verifies executable presence, not a protocol handshake.
- **MCP configuration load failures show a friendly localized banner** instead of the raw Zod issue list; the technical detail goes to the console (`console.warn`).
- **MCP card layout:** the server name sits alone on its own row (no longer squeezed to a few characters, with the badges moved to a second row), command boxes wrap with word-break instead of a horizontal scrollbar, and env/header lists scroll within a max height.

### CI and Dependencies
- e2e MCP seeds moved to the `{servers, warnings}` object contract — the visual baselines had photographed the raw-error screen as canonical — and the `wave-b-mcp` baselines were regenerated for the fixed card layout. All 8 README screenshots were re-captured on v23.1.1 (the MCP one shows the new layout).

## [23.1.0] — 2026-09-23 — Cost Governance 3.0

The cost-governance release: Budget Guard learns per-project budgets — calendar-month quotas with their own alert thresholds, created from reconciled usage projects — sitting beside the existing rolling-window provider limits. The Costs surface gains a month projection card that estimates end-of-month spend from the recent burn rate, with an honest insufficient-data state when there is not enough history to project. Usage state is centralized in one shared, zod-validated store, projects are reconciled across workspace labels into canonical keys, and existing budgets migrate loss-lessly to the new v3 storage schema. Budgets still only alert — they never block; enforcement remains future work.

### Added
- **Project budgets:** Budget Guard now has a Providers | Projects tab switch (WAI-ARIA tablist with arrow-key navigation). Each project gets a calendar-month quota ("Monthly (calendar)", with its own alert threshold), created from a dropdown of reconciled usage projects (canonical keys, deduplicated), with per-item removal alongside the existing rolling-window provider limits.
- **Month projection:** the Costs surface gains a projection card — month-to-date spend, end-of-month projection from the 14-day daily-burn average, 7- and 14-day burn windows, and an estimated overflow date ("~Sep 28") when an active budget is projected to burst within its period. Fewer than 3 days with data renders an honest "insufficient data" state instead of a number.
- **Canonical project ranking:** the top-projects ranking now groups usage by canonical project key (workspace-aware reconciliation), shows the reconciled display name once instead of one row per raw label, lists aggregated source labels in a tooltip, and gains a per-project budget column (percentage bar with ok/warning/over states) for projects with an active limit.
- **Budget-aware sidebar indicator:** the Analytics sidebar chip reflects budget health across provider AND project scopes (warning tone when near/over a limit, showing the worst percentage when there is no spend today), and project-scope inbox events use a dedicated `budget:project:<key>:<month>` id namespace.
- **Centralized usage state:** one shared, zod-validated usage store feeds the boot budget check, the status bar and every Costs surface (replacing four independent `read_usage_stats` invokes), with a manual refresh button on the Costs surface.
- All budget bars (dashboard and ranking column) are exposed as ARIA progressbars with `aria-valuenow/min/max` and accessible labels.

### Changed
- **Loss-less budget storage v15 → v3:** budget limits now carry an `id`, a `scope` (`provider` | `project`), a `period` (`rolling` | `calendar-month`) and a `createdAt`, stored under the same `ai-launcher:v15:budget` key. The v15 → v3 migration runs on the read path (`budget.ts`) and on old backup imports; v15 entries are never dropped — corrupt numerics fall back to safe defaults with a `console.warn` instead.
- **Usage export carries `project_path`:** usage entries now include the raw project directory when reliably known (Codex records its `cwd`; Claude leaves it empty), so the CSV export gained the column additively — existing consumers are unaffected. The report also exposes top projects aggregated by a canonical `key` with a stable `display_name`.

### Fixed
- **Backup imports now run schema migrations:** `importConfig` applied incoming values without calling the registry entry's `migrate`, so legacy backups skipped the v15 → v3 budget migration on import. Imports now apply the entry's declared migration structurally and idempotently (backups carry no per-key storage version, so `fromVersion` is treated as unknown).

### CI and Dependencies
- Playwright e2e coverage expanded: a new costs suite covers the month projection card, the honest insufficient-data guard, project-budget creation from the Projects tab, and warning/exceeded budget states (4 new tests).
- New UI strings shipped in English and pt-BR; the Analytics visual baselines were refreshed for the new projection hero (dark, light, and high-contrast).

## [23.0.0] — 2026-09-22 — Fleet Command

The fleet-command release: Race Mode puts up to three agents on the same task in parallel, each in its own isolated git worktree, and closes the loop with a Diff & Review Cockpit whose adoption is always atomic — a race lands as a branch or as an apply report, never partially. Navigation is regrouped around it (collapsible Run / Observe / Connect / System groups, a fused Maintenance surface) and the whole app got a fluidity pass (tab-switch jank, progressive rechecks, batched history).

### Added
- **Race Mode:** parallel multi-agent races — up to 3 agents tackle the same prompt simultaneously, each in an isolated git worktree branched from the repository's base SHA. The Race surface shows live per-agent columns (status polling with zod-validated contracts), the backend engine handles worktree lifecycle, guards, diff and adoption, and all commands go through the typed TS contract layer.
- **Diff & Review Cockpit:** a cockpit section below the agent columns lists each agent's changed files (tabular +adds/−dels) and renders the unified patch colorized by line kind with pure CSS (2 MB cap with an explicit truncation warning). Adoption is atomic: the safe default **Adopt (branch)** checks out the race branch, while **Adopt (apply)** applies changes with a per-file conflict report — a race is never landed partially, and apply-mode fails closed on rename entries.
- **Auto-commit of uncommitted agent work:** agents that edit files without committing are now visible to the three-dot diff — `race_diff` and `race_adopt` snapshot an unclean worktree (`git add -A` + a single commit on the race branch) first. A scope guard refuses any recorded worktree path outside the managed races root, so the auto-commit can never reach the user's own repository even with a tampered state file.
- **Race history, graveyard and crash recovery:** finished races persist newest-first with a `worktrees_present` flag separating restorable races from archived ones; a **7-day retention window** gates cleanup (worktrees + branches + a race-scoped metadata sweep that never reaps the user's own orphaned worktrees). Races within the window can be restored; when the app dies mid-race, a boot-time orphan scan detects the race, and recovery verifies the persisted process identity before killing anything — unverified PIDs are surfaced in the report instead of being killed blindly.
- **Regrouped navigation:** the sidebar now has Home fixed on top, a pinned-surfaces section and four collapsible groups — **Run / Observe / Connect / System** — with persisted collapse state and hover pin actions. Doctor + Prereqs + Updates are fused into a single **Maintenance** surface with three embedded sections (Diagnostics / Checks / Updates) and stable `Ctrl+8/9/0` shortcuts; legacy surface ids keep resolving. The command palette groups results like the sidebar, offers pin actions, and surfaces v22 names (Doctor / Prereqs / Updates) as marked legacy aliases.
- **Ko-fi support button** in Help's About card ("Support the project on Ko-fi", opening ko-fi.com/helbertmoura) beside the Dev Maniac's author credit.

### Performance
- **Tab-switch jank eliminated:** `backdrop-filter` removed from five surfaces (status bar, dialogs, command palette, launcher dropdown) that forced a GPU re-blur on every repaint beneath them; toggle thumbs now animate via `transform` instead of layout properties, and persistent `will-change` layers were dropped from tab panels.
- **Progressive environment recheck:** each check result streams to the UI via an `env-check-result` event as soon as its blocking probe finishes (zod-validated, memoized cards) — results appear one by one instead of all at once after ~15 subprocess probes.
- **Boot update scan deferred and deduped:** the automatic `check_all_updates` now waits for browser idle (4 s timeout) and is rate-limited module-wide; it used to fire immediately on mount and once per `useUpdates` mount (App + StatusBar), doubling ~15 subprocess probes plus npm/GitHub network calls during first paint. Explicit refreshes remain immediate.
- **History rendered in batches of 60** with a centered "show more" control, keeping the tab's first paint cheap (up to 200 stored rows were rendered at once).
- **MCP health checks merge progressively:** status pills and overview metrics fill in as each probe resolves instead of waiting for every 3 s-timeout HTTP probe; `list_mcp_servers` moved to the blocking thread pool.

### Fixed
- **WCAG AA contrast for the missing-status chip:** the 0.7 opacity blended `--text-dim` down to an effective 3.52:1 on dark surfaces; mixing toward `--text` measures 7.77:1 dark, 6.28:1 light and 11.17:1 high-contrast.
- **MCP tolerant to malformed configs:** unreadable or malformed per-CLI config files now surface a per-CLI warning and a page banner instead of being silently swallowed; the store validates leniently, so a single malformed server entry is skipped — never breaking the whole page.
- **CodeQL pointer guards in the Windows secrets path:** the DPAPI decryption output pointer is checked before `from_raw_parts`, and the Credential Manager blob read goes through a pointer `as_ref` (both flagged by CodeQL `rust/access-invalid-pointer`).
- **Race correctness:** the merge simulation takes "ours" from HEAD's blob instead of disk; live status polling resumes its cadence when the Race surface remounts mid-race; the Race keyboard shortcut is matched by key code so the macOS Option binding fires.
- **Scoped worktree prune resolves relative `gitdir` paths:** git ≥ 2.46 (`useRelativePaths`) can write the worktree metadata `gitdir` as a path relative to the metadata directory; the race-scoped sweep now resolves it (plus separator and case differences) so cleanup never stays partial on newer git, and out-of-scope or cross-drive entries are never reaped.

### CI and Dependencies
- The Vitest CI job runs on **Node 24** to satisfy the jsdom 30.1 engines requirement.
- Dependabot: `frontend-dev` group bumped across 10 dev dependencies.
- Playwright e2e coverage expanded: the race flow and the diff cockpit + branch adoption are covered with deterministic race stubs, plus grouped-sidebar layout contracts and run-button click scoping past sidebar group headers.
- Roadmap scopes distribution to GitHub Releases + the repository's Scoop bucket; winget and Chocolatey are explicitly deferred.

## [22.9.0] — 2026-09-21 — Hardened Trust & Release Pipeline

The trust-hardening release: the release pipeline now fails closed on missing updater signatures, the webview runs under a restrictive CSP, every GitHub Actions step is pinned by commit SHA, cargo audit denies warnings, and the full quality gate matrix runs before any bundle is built — plus the repository's own Scoop bucket and 27 pt-BR string fixes.

### Repository Infrastructure
- **Rotated updater signing key:** the OTA key pair was rotated and provisioned into the repository secrets (TAURI_SIGNING_PRIVATE_KEY + password). The original key (2026-08-10) had never been configured — the repo had zero secrets, which is why v22.8.0 shipped an empty-signature latest.json. v22.9.0 embeds the new public key (612BF794E7BF518A) and is the first release with a verifiably signed updater manifest.
- **Fixed SBOM generation:** the backend SBOM workflow called cargo-cyclonedx with `--override-filename-root`, a flag that does not exist in any released version, so the Rust SBOM job had failed on every run since its introduction. The workflow now uses supported flags and uploads the generated artifact with a fail-hard check.
- **Sponsor button:** `.github/FUNDING.yml` now enables Ko-fi (ko-fi.com/helbertmoura); GitHub Sponsors stays available for future activation.
- **Scoop bucket:** the repository doubles as its own Scoop bucket (`bucket/ai-launcher.json`) with a v22.8.0 manifest pinned to the published installer hash and GitHub-based autoupdate — `scoop bucket add ai-launcher https://github.com/HelbertMoura/ai_launcher`.

### Security
- **Fail-Closed Release Pipeline:** the `latest.json` updater step now hard-fails when `TAURI_SIGNING_PRIVATE_KEY` is not configured or when the NSIS `.sig` is absent, instead of silently publishing an unsigned manifest that the in-app updater would reject; `scripts/audit-release.sh` also verifies that `latest.json` carries a non-empty signature.
- **Restrictive CSP:** the Tauri app config now ships a restrictive Content Security Policy — production locks everything to `'self'` plus the Tauri IPC bridge, and the dev variant only additionally allows the Vite HMR endpoints on localhost.
- **Pinned CI:** every GitHub Actions workflow step is pinned to a full commit SHA, eliminating tag-repoint supply-chain risk on third-party actions.
- **cargo audit denies warnings:** the Rust dependency audit now runs with `--deny warnings`, with every ignored advisory explicitly documented in `.cargo/audit.toml`.
- **Quality before artifacts:** the release workflow runs the full quality gates before building any bundle, so a red gate can no longer produce installers.

### Fixed
- **27 pt-BR UI strings** were missing accents (e.g. `{{cli}} relancado` → `{{cli}} relançado`); all fixed in the pt-BR locale.
- **README install commands** no longer reference nonexistent `.deb`/`.dmg` asset names.
- **Broken navigation anchor** in the pt-BR README.
- **Governance docs** (CONTRIBUTING, SECURITY) no longer reference the removed `util.rs` and reflect the multi-platform bundles.

### Changed
- **README claims synced with the code:** 7 themes, 239 Vitest / 127 Rust test counts, 15 runtime checks, the full CLI list (including Windsurf and 5 new CLIs), 3-platform positioning, and the EN tech stack table pinned to TypeScript 7.
- **Backend user-facing error messages standardized to pt-BR**, including the remaining keyring errors.
- **Command deck label** no longer carries a hardcoded version suffix.
- **Automation texts** (issue templates, workflow comments) rephrased from colloquial to neutral wording.
- **Bug report template** example app version updated.

## [22.8.0] — 2026-09-19 — Cross-Platform Support, Hardened Core & Public Quality Gates

The multi-platform release: AI Launcher now builds and ships on Windows, macOS and Linux with native secure storage per OS, the Rust core is hardened against command-injection paths, and a 9-job quality gate matrix runs on every push.

### Multiplatform
- **Native Secure Storage per OS:** credential storage now uses the platform-native backend — Windows Credential Manager (existing), macOS Keychain and Linux Secret Service via the `keyring` crate — with fail-closed availability: when no secure backend is present, credential features report unavailable instead of silently degrading.
- **Conditional Rust Core:** platform-specific process, terminal and doctor paths are conditionalized per OS, so the same core compiles cleanly on Windows, macOS and Linux with Windows-only code gated behind `cfg`.
- **Fail-Closed UI:** credential features are gated in the interface when secure storage is unavailable, with explicit states instead of broken actions.
- **Six Bundles, Three OSes:** the release pipeline produces and attaches msi + nsis (Windows), dmg ×2 (macOS, Apple silicon and Intel) and AppImage + deb (Linux) to every GitHub release.

### Security
- **Command Injection Hardening:** `cmd.exe` fallback metacharacters are escaped and custom command tokens are gated, closing the `cmd /K` injection gaps surfaced by the safety audit.

### Performance
- **Non-Blocking Scans:** blocking network and filesystem scans moved off the command thread via `tokio::task::spawn_blocking`, keeping the UI responsive during MCP and update checks.
- **Real MCP HTTP Probe:** the MCP health check now performs an actual HTTP reachability probe against declared servers instead of relying on file-existence heuristics.

### Quality
- **~110 New Tests:** 127 Rust unit tests (`cargo test`), 239 Vitest unit tests and 62 Playwright e2e specs, all green.
- **9/9 CI Quality Matrix:** tsc, Vitest, npm audit, Rust fmt/clippy/test on Windows and Ubuntu, cargo-audit, Playwright e2e, build metrics and release readiness — all passing on the release commit.
- **Typed Command Layer:** all Tauri invocations routed through a typed command layer with `AppError` adopted across commands; WorkspacePage decomposed into section components and dedicated stores.

### Packaging
- **Winget, Scoop & Chocolatey:** official manifests for the three Windows package managers, with a generator script to keep them in sync with each release.

### Docs
- **Public Showcase:** new public ROADMAP (EN + pt-BR), Code of Conduct, version and quality-gates badges, multi-platform install instructions and a demo GIF recorded from the canonical workflow.

## [22.7.0] — 2026-08-16 — Ollama Local LLM Support, Doctor Cache Cleaner & Unified MCP Backup Bundle

Release com suporte de primeira classe para execução de modelos locais com Ollama, botão de limpeza profunda de cache e restauração de stubs no Doctor, e ferramenta unificada de exportação e restauração de bundle de servidores MCP.

### Ollama Local LLM Integration
- **Local AI Tool & Prerequisite (`ollama`):** Adicionado suporte completo para detecção e diagnóstico do Ollama no sistema operacional (verificação via `ollama --version`, paths padrão `%LOCALAPPDATA%\Programs\Ollama` e `%PROGRAMFILES%\Ollama`).
- **Parallel Health Check:** Integrado às verificações concorrentes em Tokio de pré-requisitos (`check_environment`) e atualizações de ferramentas (`check_tool_updates`).
- **One-Click Download:** Link direto de instalação e atualização apontando para o instalador oficial do Windows.

### Doctor Deep Cache Cleaning & Stub Repair
- **System Cache Cleanup (`cleanup_system_cache`):** Novo comando Rust que executa a faxina de arquivos temporários órfãos de instalação (`goose.zip`, `agy_install`, `ai-launcher-tmp`), pastas temporárias do npm (`.claude-code-*`) e executa autocura preventiva de executáveis.
- **Action Button no Doctor:** Botão visual `🧹 Limpar Cache & Reparar` no topo da página do Doctor com feedback instantâneo e re-execução de diagnósticos em ambiente limpo.

### Unified MCP Configuration Bundle
- **Full MCP Bundle Export & Restore (`export_all_mcp_configs` / `import_all_mcp_configs`):** Exportação em arquivo `.json` único de todas as configurações de servidores MCP ativas para Claude (`.mcp.json`), Codex (`config.toml`) e Gemini (`mcp_config.json`).
- **Safe Automatic Backup:** Criação de cópias de segurança automáticas (`.bak`) dos arquivos de configuração antes de qualquer restauração de bundle.
- **Dedicated Admin Section UI:** Novos cards na seção de Backup do Admin para backup/restore com 1 clique de MCP.

## [22.6.1] — 2026-08-16 — Claude Code Native Windows Fix & Self-Healing Installer

Correção definitiva para o erro de incompatibilidade do binário do Claude Code no Windows (`Esta versão de claude.exe não é compatível com a versão do Windows sendo executada`) e migração para o instalador nativo oficial da Anthropic.

### Claude Code Official Native Installer & Self-Healing
- **Anthropic Official Script Migration:** Atualizada a definição do Claude Code (`definitions.rs`) para usar o instalador PowerShell oficial nativo (`irm https://claude.ai/install.ps1 | iex`), instalando o executável nativo diretamente em `%USERPROFILE%\.local\bin\claude.exe`.
- **Automatic NPM Stub Self-Healing (`heal_claude_npm_stub_if_needed`):** Implementada autocura inteligente para instalações e atualizações via npm que deixavam o arquivo `bin/claude.exe` como um script de erro de 500 bytes (quando os scripts de ciclo de vida eram bloqueados pelo npm no Windows). O launcher detecta stubs inválidos e os restaura silenciosamente via `install.cjs` ou copiando o executável nativo de 64 bits.
- **Robust Path & Shell Resolution:** `resolve_cli_path_win` prioriza os binários nativos em `extra_paths` (`%USERPROFILE%\.local\bin\claude.exe` e `%LOCALAPPDATA%\Programs\claude\bin\claude.exe`) e executa scripts via `pwsh`/`powershell` com flags seguras de execução.
- **Support for Text/JSON Manifests:** `fetch_manifest_version` atualizado para processar manifestos em formato JSON e respostas de versão em texto simples.

## [22.6.0] — 2026-08-14 — Rust Tokio Concurrency, Zero-Lag Tab Navigation & Launch Marketing Kit

Release de aceleração assíncrona, paralelização massiva de checagens no Rust com Tokio, eliminação total de bloqueios nas transições de abas via cache Stale-While-Revalidate, transições não-bloqueantes no React 19 (`startTransition`) e kit oficial de divulgação e marketing da Dev Maniac's.

### Rust Backend Concurrency & OS Probing
- **Async Parallel Environment Checks (`check_environment`):** Todas as 14 verificações de binários e versões do sistema operacional (`node`, `npm`, `git`, `python`, `rustc`, `cargo`, `pnpm`, `yarn`, `bun`, `wt`, `pwsh`, `git-lfs`, `docker`, `code`, `tauri`) agora executam concorrentemente em threads paralelas via `tokio::task::spawn_blocking` e `tokio::join!`. O tempo total de resposta caiu de **~3.500ms para ~180ms**.
- **Parallel CLI & Tool Diagnostics:** `check_tools` e `check_clis` convertidos em comandos assíncronos que despacham inspeções individuais em paralelo.

### UI/UX & Stale-While-Revalidate Hydration
- **Unified `environmentStore`:** Store global com `useSyncExternalStore` e cache de 10 minutos em `sessionStorage`. As telas de **Pré-requisitos** e **Doctor** agora renderizam instantaneamente no primeiro frame (0ms), sincronizando atualizações suavemente em segundo plano.
- **Unified Doctor State:** `DoctorPage` sincronizado diretamente com `usePrerequisites` e `environmentStore`, eliminando telas em branco e diagnósticos duplicados.
- **Non-blocking Navigation (`startTransition`):** Navegação entre abas protegida com `startTransition` do React 19, garantindo 60 FPS contínuos e zero latência em cliques rápidos na Sidebar e na Command Palette (`Ctrl+K`).

### Marketing & Social Media Kit
- **Kit Oficial de Lançamento:** Criado `docs/marketing/social-media-kit.md` com materiais prontos para Twitter/X (posts e threads), Reddit (`r/LocalLLaMA`, `r/ChatGPTCoding`, `r/rust`, `r/tauri`), Show HN (Hacker News), LinkedIn e Discord.
- **Assets de Imagem Gerados:** Hero Banner 16:9 de lançamento e Feature Card 1:1 com a identidade visual oficial da Dev Maniac's.

### Validation
- `npm run typecheck` — 0 erros.
- `npm test` — 35 arquivos de teste e 217 testes passando com 100% de sucesso.

## [22.5.0] — 2026-08-14 — Performance Acceleration, Keep-Alive Navigation & Official Icons

Release de alta performance, otimização extrema de responsividade de UI, troca instantânea de abas com retenção de estado (`TabKeepAlive`), pré-carregamento assíncrono em segundo plano (`requestIdleCallback`), aceleração por hardware (GPU) e ícones oficiais de marca dos agentes de IA.

### Performance & UI Responsiveness
- **Instant Tab Switching (`TabKeepAlive`):** Eliminação completa do unmount/remount churn ao navegar entre abas. Abas visitadas permanecem em memória no DOM (`contain: layout paint`), permitindo transições instantâneas com 0ms de atraso e retenção total de rolagem e rascunhos.
- **Background Idle Module Preloader:** Pré-carregamento assíncrono de todos os chunks de páginas secundárias durante o tempo ocioso do navegador (`requestIdleCallback` com fallback seguro).
- **GPU-Accelerated Micro-Animations:** Animações de fade-in e translação suaves (`@keyframes cd-tab-fade-in`), aceleradas via GPU (`will-change: opacity, transform`), com suporte completo a `prefers-reduced-motion`.
- **Sidebar & Interactive Micro-Interactions:** Micro-movimento tátil nas abas laterais (`translateX(2px)` com feedback de escala ativa) e transições ágeis de 120ms com curvas de interpolação `cubic-bezier(0.16, 1, 0.3, 1)`.

### Official Vector Badge Icons
- **Aider (`aider.svg`):** Ícone oficial em gradiente roxo/índigo com letra "A" estilizada e cursor de terminal ciano.
- **Goose (`goose.svg`):** Mascote oficial do Block Goose com bico âmbar vibrante e plumagem vetorial sobre grafite escuro.
- **Cline (`cline.svg`):** Mascote robô oficial do Cline com capacete e visor digital ciano sobre azul elétrico.
- **Roo Code (`roocode.svg`):** Mascote canguru do Roo Code com óculos/visor de código `< >` sobre gradiente âmbar/laranja.
- **Continue, Cody & Copilot:** Badges vetoriais oficiais em resolução 128x128 integrados ao catálogo central.

### Validation & Suite
- `npm run typecheck` — 0 erros.
- `npm test` — 35 arquivos de teste e 217 testes passando.
- `cargo test` — 86 testes unitários Rust passando.
- `cargo clippy` — 0 avisos.
- `smoke:packaged` — 626ms boot nativo com zero regressões.

## [22.0.0] — 2026-08-14 — Multi-Agent Ecosystem & Modular Core

Release maior focada em modularização arquitetural nativa em Rust, suporte de primeira classe a novos agentes de IA (Aider, Goose, Cline, Roo Code, Cody, Copilot, Continue), novo sistema de Analytics e Custos com intervalos temporais dinâmicos, e identidade visual/rodapé oficial da Dev Maniac's.

### Added — Multi-Agent Ecosystem & Native CLIs
- Adicionados novos agentes ao ecossistema nativo: **Aider**, **Goose**, **Cline**, **Roo Code**, **Cody**, **Copilot** e **Continue**.
- Novos ícones vetoriais SVG customizados em `public/icons/cli/` para todos os novos agentes.
- Recomendações inteligentes no detector de stack para os novos agentes.

### Added — Modular Rust Core Architecture
- Desmembrado o arquivo monolítico `src-tauri/src/util.rs` (1.343 linhas) em submódulos dedicados em `src-tauri/src/util/`:
  - `definitions.rs` — Catálogo de CLIs, feeds e extras.
  - `process.rs` — Spawn, streaming, sanitização de argumentos e diretórios.
  - `terminal.rs` — Resolução de Windows Terminal e PE paths.
  - `versions.rs` — Extração de versão, semver comparison, cache registry e client ureq.
  - `tray_cfg.rs` — Configuração do tray e crash reporter.
  - `mod.rs` — Re-exports limpos e bateria de 79 testes unitários nativos.

### Added — Analytics & Budget Intelligence 2.0
- Seletor interativo de intervalo (7d, 14d, 30d, 90d) em `CostsPage.tsx` com recálculo instantâneo de séries temporais, ranking de projetos e modelos.
- Rollups de consumo por CLI com métricas detalhadas diárias e mensais.

### Added — Brand & Official Identity
- Rodapé e assinaturas oficiais "Desenvolvido à base de ☕ e ⚡ por Dev Maniac's · Redes e contatos" integrados na barra de status, tela de ajuda/sobre e onboarding tour com acionamento nativo de navegador externo.

### Added — Component Decomposition & Refactoring
- Decomposição de `CommandCenterPage.tsx` em subcomponentes isolados (`ProjectIntelligence.tsx`, `ReadinessCard.tsx`).
- Galeria de screenshots atualizada em `docs/screenshots/v22/`.

### Validation
- `npm run typecheck` — 0 erros
- `npm test` — 35 arquivos, 217 testes passando
- `cargo test` — 79 testes passando
- `cargo clippy` — 0 warnings
- `npm run build` — Vite production build PASS
- `npm run release:readiness` — 41 checks PASS

## [21.1.0] — 2026-08-10 — Trust & Polish / Updater Foundation

A security and infrastructure release. 5 critical security findings closed (SEC-001..005), 5 new Claude-compatible CLIs added (13 total), the in-app updater migrated to the official `tauri-plugin-updater`, and a vendor-chunking pass cut the main JS bundle by 57%. All deps brought current (0 npm audit). Zero breaking changes in the public contract.

### Security
- **SEC-001** — `open` 5.3.4 → **5.4.0** (CVE shell injection fix on Windows). Dependabot #44, merged.
- **SEC-002** — Supply chain unblocked. 7 Dependabot PRs merged (#39, #40, #44, #46, #47, #48, #49) closing every open security PR.
- **SEC-003** — `format_explorer_select_arg()` helper added to `src-tauri/src/commands/self_update.rs` (4 unit tests). Mitigates command-injection through the explorer's `select` argument by normalizing whitespace and shell metacharacters.
- **SEC-004** — `validate_directory` now rejects UNC paths (`\\` and `//`) in addition to the existing path-traversal guards (4 unit tests). Mitigates a class of Windows-only lateral-movement paths.
- **SEC-005** — Documented `CRED_PERSIST_LOCAL_MACHINE` semantics in `secrets.rs` so the persistence choice is auditable at review time.

### Added
- **Cody, Copilot CLI and Goose** (INT-001 cont.) — three additional Claude-compatible CLIs detected, installed and launched from the same surface as Claude/Codex. New total: 13 CLIs.
- **Vendor chunking** (REF-006) — main JS chunk reduced 57% (gzip 92.43 kB → 41.15 kB) by splitting `react`, `i18n`, `tauri`, `dnd` and `icons` into separate long-lived chunks. Improves Tauri webview cache reuse and isolates upgrade blast-radius.

### Changed
- README updated to list all 13 supported CLIs (was 10).
- **i18next 24.2 → 26.3** (Dependabot #52, major) and **react-i18next 15.7 → 17.0** (#54, major). react-i18next 17 declares i18next >= 26.2.0 as a peer; both upgrades landed together. No API changes required at call sites.
- **Vite 8.2.0 → 8.2.1** patch (#50).
- **base64 0.22 → 0.23** (Dependabot #55, minor). Bumps the direct `base64` dep; `tauri-codegen` transitively still pulls 0.22 (deferred to next Tauri major).
- **toml_edit 0.22 → 0.25** (Dependabot #56, minor).
- **Rust minor/patch group** (Dependabot #53): `tauri 2.10.3 → 2.11.5`, `tao 0.34.8 → 0.35.3`, `tray-icon 0.21.3 → 0.24.2`, `muda 0.17.2 → 0.19.3`, `open 5.4.0 → 5.4.1`, `tokio 1.53.0 → 1.53.1`.
- **TypeScript 6.0.3 → 7.0.2** (major, part of #51). Landed in isolation; no call-site changes required.
- **@testing-library/jest-dom 6.9.1 → 7.0.0** (major, part of #51). jsdom 30 picks up jest-dom 7 cleanly; both already pin Node ≥ 22.
- **jsdom 29.1.1 → 30.0.1** (major, part of #51). Brings the `@asamuzakjp/*` stack up two majors and `whatwg-url` 16→17.
- **undici override 7.28.0 → 7.29.0** closes the 5 high-severity dev advisories in the 7.0.0–7.28.0 range. Production runtime was already safe (Tauri's HTTP stack is not on undici).

### Skipped (next session)
- Dependabot #51 partial: **@types/node stays on 22.x (LTS)** by design (DEP-004). Skipping the bump to 26 in this batch.
- DEP-001/002: `windows-sys` (6 transitive versions) and `base64` (2 versions after this batch) still come from hard constraints in the Tauri/wry stack; `[patch.crates-io]` would risk binary compat.

### Validation
- 92 Rust tests + 217 Vitest passing.
- `cargo fmt`, `cargo clippy -D warnings`, `tsc --noEmit` and `vite build` all clean.
- `npm audit`: **0 vulnerabilities** (down from 1 high).

### FEAT-002 step 1/3 (tauri-plugin-updater)
- Added `tauri-plugin-updater = "2.0"` to `src-tauri/Cargo.toml` (resolved 2.10.1).
- Registered `updater:default` permission in `src-tauri/capabilities/default.json`.
- Initialized plugin via `Builder::new().build()` in `main.rs`.

**No behaviour change yet.** The plugin is wired but neither the frontend nor `self_update.rs` route through it. Next step is to migrate `check_app_update` / `download_verified_app_update` to the plugin (probably behind a feature flag so the legacy path stays as a safety net), then delete `self_update.rs` once the migration is observably stable.

**Why staged:** the plugin is opinionated (it requires a `latest.json` manifest hosted alongside the release, signing keys, and a release-workflow change). Doing it in one shot would mix infra (release workflow) with code (commands) and a config change (capabilities) — easy to miss a wiring step.

### FEAT-002 step 2/3 (commands migrated)
- New `src-tauri/src/commands/updater.rs` is a thin wrapper over `tauri-plugin-updater`. The frontend contract (`check_app_update` / `download_verified_app_update`, same return types) is preserved, so `useAppUpdate.ts` keeps working unchanged.
- Plugin is configured in `tauri.conf.json` under `plugins.updater` (single endpoint at the GitHub Releases `latest.json`, public key baked in from a freshly generated keypair stored locally at `.tauri/ai-launcher.key` — gitignored).
- Signature validation replaces the legacy SHA-256 checksum verification.

### FEAT-002 step 3/3 (legacy path deleted, release workflow updated)
- `src-tauri/src/commands/self_update.rs` moved to `.trash/` (not gitignored because of the existing `*.rs` rule; to be reaped on the next trash sweep).
- `util::download_agent` removed (no other consumers).
- Release workflow now signs the NSIS installer with `tauri signer sign` (uses `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets; step is opt-in, skipped silently if the secrets are missing) and emits `latest.json` in the tauri-plugin-updater schema (version / notes / pub_date / url / signature).
- Tests: 92 → 80. The 12 deleted tests were the legacy SHA-256 / asset-matching suite (`find_windows_asset`, `is_safe_asset_name`, etc.) — those guarantees now live inside the official plugin.

**Operator note for the next release:** the pubkey in `tauri.conf.json` is a freshly generated placeholder. To make the in-app updater work end-to-end:
1. Add the matching private key to GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if you keep the password on the key).
2. Rotate the keypair if you do not trust the local `.tauri/ai-launcher.key` file (kept under `.gitignore`).

Without the private key in secrets, the in-app updater rejects every manifest but the manual download still works — same as the legacy `download_verified_app_update` did when GitHub blocked the API.

### Cleanup
- `cli.rs:366` now uses `HashSet::default()` (was `Default::default()` — clippy::pedantic).
- `commands::updater` gained 2 unit tests (roundtrip Serialize/Deserialize for `AppUpdateInfo` and `VerifiedUpdateResult`) — `VerifiedUpdateResult` is now `Serialize + Deserialize` (was `Serialize` only). Total Rust tests: 80 → 82.
- `commands::updater` doc comment now wraps `CARGO_PKG_VERSION` in backticks (clippy::pedantic).
- Pedantic clippy warnings remain (~80 across `util.rs` and `cli.rs`); deferred because the diff would be ~hundreds of lines of `format!("{x}")` rewrites with no functional change. Re-evaluate on a future pedantic pass if desired.

### VIS-001 (marketing prep, drafts only)
- `docs/marketing/producthunt.md` — draft Product Hunt submission (tagline, description, first comment, gallery order, topics, launch-time, hunter notes).
- `docs/marketing/dev-to.md` — outline for a long-form dev.to article (~2,500 words, 9 sections).
- `docs/marketing/launch-checklist.md` — T-7d / T-3d / T-1d / T-zero / T+1d / T+1w checklist plus open items (macOS/Linux, Azure signing, Hub).

These are drafts the operator can review, edit and submit. They do not deploy anything, do not push to PH or dev.to, and do not require any external API. The first commit that actually publishes to PH/dev.to is a deliberate human action.

## [21.0.0] — 2026-07-13 — Trust & Flow / Command Deck

Release maior que transforma a fundação Command OS da v20 em um workbench mais seguro, legível e validável para uso diário. A v21 combina hardening de secrets/update/storage, uma evolução visual completa e uma esteira de release com smoke do app empacotado.

### Added — Trust Foundation
- Secrets de providers agora falham fechado e usam Windows Credential Manager no app empacotado, sem fallback persistente em plaintext.
- Migração legada de secrets com verificação de read-back antes de remover a origem antiga.
- Registry/audit de storage com validação Zod, migrações idempotentes e guardrail `npm run audit:storage`.
- Guardrail `npm run audit:capabilities` para impedir permissões shell amplas no capability principal do Tauri.

### Added — Command Deck visual system
- App Shell 2.0 com sidebar agrupada, topbar focada em comando, statusbar operacional e controles de tema/acento/densidade.
- Redesign visual de Command Center, Launcher, Workspaces, History, MCP, Updates, Admin, Analytics, Doctor, Prereqs, Onboarding e Help.
- Baselines Playwright para dark, light e high-contrast, com Axe em todas as matrizes visuais.
- Prints públicos v21 em `docs/screenshots/v21/`.

### Added — Command Center and Runbooks
- Command Center 2.0 com estados guiados, readiness do projeto, revisão segura de `.ailauncher.json`, sessões ativas e ações primárias protegidas.
- Runbooks 3.0 com dry-run, aprovações por modo de execução, retry/resume determinístico, stop real de processo e output limitado.
- Timeline de atividade do workspace sem persistir comandos/env/output sensíveis.

### Added — Release readiness
- Suite crítica E2E com onboarding, workspace CRUD, credenciais, project profile, launch/kill, runbooks, MCP, backup, updater e navegação por teclado.
- `npm run release:readiness` valida versão/tag, scripts, workflows, targets MSI/NSIS, signing/latest.json e breadth E2E.
- `npm run smoke:packaged` valida executável Windows já buildado, metadata PE, boot da janela principal e single-instance.
- Workflow de release roda readiness antes do build e publica MSI, NSIS, checksums e `latest.json`.

### Fixed
- Segunda instância empacotada no Windows agora sai imediatamente via named mutex nativo antes do Tauri Builder.
- Smoke de app empacotado aguarda janela real, não apenas PID, e faz cleanup resiliente do perfil WebView2 temporário.
- Snapshots visuais Wave A congelam o relógio do browser para evitar drift de tempos relativos.

### Validation
- `npx tsc --noEmit`
- `npm test` — 217 testes
- `npm run build`
- `npm run rust:fmt`
- `npm run rust:clippy`
- `npm run rust:test` — 78 testes
- `npm run audit:storage`
- `npm run audit:capabilities`
- `npm run audit:prod`
- `RELEASE_TAG=v21.0.0 npm run release:readiness`
- `npm run smoke:packaged -- --exe src-tauri/target/release/ai-launcher.exe --timeout-ms 45000 --json`
- `npx playwright test` — 60 testes

## [20.0.0] — 2026-07-07 — Command OS mega release

Release maior que transforma o AI Launcher em um centro operacional para agentes: home nova, inteligência por projeto, runbooks mais fortes, MCP por workspace, perfis de agente, sessões 2.0 e melhorias de confiança para backup/update/release.

### Added — Command Center
- Nova aba **Command Center** como tela inicial pós-onboarding, com resumo do workspace ativo, ação principal de launch, readiness cards, sessões ativas/recentes e ações rápidas reais.
- Atalhos reorganizados: Command Center `Ctrl+1`, Launcher `Ctrl+2`, Tools `Ctrl+3`, MCP `Ctrl+4`, History `Ctrl+5`, Analytics `Ctrl+6`, Workspace `Ctrl+7`, Doctor `Ctrl+8`, Updates `Ctrl+9`, Prereqs `Ctrl+0`.
- Launch/replay passa pelo helper compartilhado `launchCliSession`, preservando provider, env de workspace, `.ailauncher.json`, histórico, recent dirs e toasts.

### Added — Project Intelligence
- Detector seguro de stack para Node/React/Vite/Tauri/Rust/Python/Go/Docker/MCP, com evidências e sugestões de CLI/runbook.
- Backend `scan_project_stack(directory)` lê apenas manifests permitidos, com cap de tamanho e sem tocar `.env`.
- Criação assistida de `.ailauncher.json` com preview validado e escrita fixa/segura na raiz do projeto.

### Added — Runbooks 2.0
- Presets locais para Node/Vite, Tauri/Rust, Rust, Python, Go, Docker e MCP, sugeridos pela stack detectada.
- Condições por step (`fileExists`, `commandExists`, `envExists`, `previousSucceeded`) com avaliação segura no backend quando aplicável.
- Histórico persistido de execuções com run id, status, duração, outputs capados e timeline recente por runbook.

### Added — Agents + MCP Hub
- MCP por projeto: `.ailauncher.json.mcp` resolve servidores esperados, resume faltantes e roda health checks apenas nos MCPs relevantes ao workspace.
- Catálogo MCP ganhou validação antes de aplicar presets e reforço visual de backup.
- **Agent Profiles**: CRUD local de perfis de agente, perfil ativo por workspace e launch preparado por CLI/args/provider do agente.

### Added — Sessions 2.0 + Trust
- History agora tem dashboard com sessões ativas, falhas, duração média, workspaces vinculados e filtros persistidos.
- Replay de sessão usa o fluxo compartilhado de launch; kill de sessão ativa exige confirmação.
- Backup/export/import ganhou manifest, redaction recursiva de secrets e preview de restore antes de escrever no localStorage.
- Updater mostra cadeia de confiança (`latest.json`, SHA-256, GitHub Release) e o script `audit-release.sh` valida o conteúdo do `latest.json`, não só os nomes dos assets.

### Changed
- Workspaces agora centralizam Agent Profiles e continuam como base para runbooks, budgets, doctor e sessões.
- UI e i18n atualizados para Command Center, Project Intelligence, Runbooks 2.0, MCP por projeto, Agent Profiles e Backup.
- Release checklist v20 consolidado no processo de release e nos notes de `docs/releases/v20.0.0.md`.

### Validation
- `npx tsc --noEmit`
- `npm test` — 21 arquivos, 184 testes
- `npm run build`
- `C:\Program Files\Git\bin\bash.exe -n scripts/audit-release.sh`

## [16.0.1] — 2026-07-07 — Launch Flow, Workspace UX e release hygiene

Patch release focada em polimento operacional pós-v16: lança templates/quick launch com o mesmo contrato do diálogo principal, melhora a experiência de Workspaces e reduz o bundle inicial.

### Fixed
- **Templates salvos e quick launch** agora usam o mesmo fluxo do `LaunchDialog`: provider ativo, env do workspace, `.ailauncher.json`, histórico, recent dirs e toast de erro/sucesso.
- **Modo Vite/browser** não mostra mais erro visual `Cannot read properties of undefined (reading 'invoke')` ao abrir fora do WebView Tauri; leituras não críticas usam fallback local.
- **Workspace delete** agora exige confirmação antes de remover o perfil.
- **Import de Workspaces** mostra toast de erro quando o JSON é inválido, em vez de falhar silenciosamente.

### Changed
- **Code splitting por página** com `React.lazy`: chunk principal caiu de ~634 kB minificado para ~325 kB.
- Empty state da Launcher ganhou ações diretas para adicionar CLI, rodar Doctor e abrir Pré-requisitos.
- README/README.pt-BR atualizados para v16 e notas atuais.
- Workflow de release limpa bundles antigos antes do build, evitando anexar assets de versões anteriores quando o cache do Cargo é reaproveitado.

## [16.0.0] — 2026-06-11 — Analytics, Inbox, Acessibilidade AA e fundações v16

Release maior consolidando quatro fases (alpha → beta1 → beta2 → 16.0). Distribuição assinada (Authenticode + winget/choco) ficou para uma fase própria pós-release — a infraestrutura já existe (`release.yml` com signing opt-in, manifests em `dist/`), pendente apenas do certificado.

### Added — Agent Analytics
- A aba **Costs virou Analytics**: série temporal de custo/dia (30 dias), ranking de top projetos e breakdown por modelo, cards de resumo com tendência vs período anterior.
- Módulo puro de agregação (`dailySeries`, `byProject`, `byModel`, `trend`) com testes unitários completos; buckets "outros" mesclados sem duplicação.
- Componentes de gráfico **SVG próprios** (`AreaChart`, `BarList`) tematizados via Theme Foundry — zero dependência nova no bundle.

### Added — Agent Inbox
- **Sino com badge de não-lidas na TopBar** e painel dropdown acessível (Esc fecha com retorno de foco, navegação por setas, click-outside).
- Quatro fontes de eventos: fim de sessão (com CLI e duração), alertas de budget por provider, updates de CLI disponíveis e falhas do Doctor.
- Store persistido com **dedup por chave estável** (`update:<cli>:<versão>`, `budget:<provider>:<mês>`...): re-push idêntico preserva o estado de lido (sem re-notificar a cada boot); Doctor notifica apenas na transição ok→falha; cap de 50 eventos descartando lidos primeiro.

### Added — Beta2 (MCP, Runbooks, Perfis, Temas)
- **MCP Manager**: aba com CRUD de servidores MCP nas configs do Claude (`.mcp.json`), Codex (`config.toml`) e Gemini (`mcp_config.json`), com backup automático antes de escrever, mais catálogo de servidores.
- **Runbooks reais**: execução de steps via backend (`run_runbook_step` com timeout e sanitização) e UI cabeada na Workspace.
- **Perfis por projeto**: `.ailauncher.json` na raiz do projeto pré-configura CLI/provider/env; merge de env com precedência projeto > workspace > default (corrige workspace "decorativo").
- **Theme Foundry**: contrato de tema com teste anti-regressão + 3 temas novos (Phosphor, Midnight, High Contrast) — total de 7 temas.

### Added — Beta1 (Engines)
- **Usage Engine real**: parsing da telemetria do Claude (`~/.claude/projects/**/*.jsonl`) e Codex (`~/.codex/sessions/**/rollout-*.jsonl`) com cache por mtime; provider lógico por entrada.
- **Budget por provider**: limites com período e threshold de alerta, dashboard e alertas no boot.
- **Session Engine**: eventos `session-ended` do backend (status, exit code, duração real); launches via Windows Terminal marcados como `detached`.
- **Persistência unificada**: registry central com validação zod em todas as chaves (`src/lib/storage`); backups de config gerados a partir do registry.

### Accessibility (épico AA)
- **Dívida de contraste paga**: tokens `--text-dim`/`--ok`/`--warn` ajustados para WCAG AA (≥4.5:1) nos 7 temas; trava de regressão programática no teste de contrato (cálculo de luminância das CSS vars).
- Regra **`color-contrast` do axe reativada** no e2e (rodava desabilitada desde a v16-alpha); única exclusão: marca d'água decorativa da StatusBar (exceção WCAG 1.4.3, documentada).
- **Command Palette com padrão ARIA combobox completo** (`aria-activedescendant`, listbox/option/group) e retorno de foco ao fechar.
- **Um `<h1>` por página** nas 11 abas com hierarquia h1→h2 coerente.

### Security (alpha)
- Fechamento de injeção de comando e hardening de spawns de processo (`sanitize_args`, validação de env-keys, `kill_on_drop`).
- Cadeia de integridade de updates reforçada (checksum obrigatório); links externos via `open::that`.

### Fixed
- StatusBar populando no boot (subscribe do store de CLIs), sessões eternamente "starting" → status real, alertas de budget mortos reativados, ConfirmDialog sem handler global de Enter.
- Duplicação do bucket "outros" no ranking de projetos quando havia projetos sem nome no top-N.

### Changed
- Limpeza: `lucide-react` removido (ícones via Phosphor), módulos mortos deletados (presets, sessionTemplates, appSettings).
- `prefers-reduced-motion` respeitado nas animações.

### Removed
- Telemetria do Gemini no Usage Engine (CLI removido na v15.2.0, sem fonte de dados).

## [15.2.6] — 2026-05-20 — Fixes críticos: Antigravity auto-launch + Temas quebrados

Dois bugs sérios descobertos no smoke test final.

### Fixed
- **Antigravity IDE abria sozinho ao clicar na aba Ferramentas** (CRÍTICO). Causa: `check_tools` executava o binário Electron com `--version` quando `find_tool_path` o encontrava fora do PATH, e Electron apps abrem a janela ao receberem flags desconhecidas. Fix: pular direto para `read_exe_product_version` (PE metadata, não executa) quando o comando não está no PATH. Aplica-se a Antigravity, Cursor e Windsurf.
- **Tema salvo não era aplicado no início da sessão** — `useTheme` definia o state mas só aplicava `data-theme` no DOM ao clicar pra mudar; o tema visível no primeiro frame era sempre o padrão (dark). Fix: `useEffect` aplica o atributo no mount.
- **Temas claros (Light, Glacier) tinham accents do dark**. Vermelho `#ff3131` gritava sobre fundo branco; alphas de superfície `--surface-1-alpha` e `--surface-2-alpha` continuavam com transparência preta, quebrando o glass blur de TopBar/StatusBar.
- **Tema Glacier não tinha override de grid-dot** (pontinhos invisíveis ou pretos demais).

### Changed
- `theme-light.css` e `theme-glacier.css` ganham overrides explícitos de `--surface-*-alpha` e `--accent` mais escuros (`#d62929` no light, `#2c8de6` no glacier) compatíveis com fundo claro.
- `theme-amber.css` ganha `--surface-*-alpha` em tons quentes.
- `accents.css` ganha overrides escurecidos para os 5 accents (red/amber/green/blue/violet) quando usados em temas claros (light + glacier).
- `tokens.css` aplica `--grid-dot-color` claro em `light` E `glacier`.

### Internal
- Comentário de **PERIGO** em `check_tools` documenta o anti-padrão de executar binário Electron via path direto.
- `useTheme` adiciona dependência `useEffect` no React.

## [15.2.5] — 2026-05-20 — Unificação visual das demais abas

Polish final aplicando o padrão visual da Launcher/Tools às outras páginas (Pré-reqs, Doctor, Workspaces). Headers, botões e paddings consistentes em todo o app.

### Changed
- **Pré-reqs**: header migrado para padrão `cd-page__head` (▎ título 22px + sub uppercase). Botão "RUN" do card de Pré-req agora é ghost com accent border (sóbrio, mesmo padrão CLI/Tools).
- **Doctor**: header migrado para padrão. Botão "RUN DIAGNOSIS" agora ghost-accent. Removido padding duplicado.
- **Workspaces**: header migrado para padrão. Botões "Novo/Exportar/Importar" todos no novo padrão ghost-accent com hover preenchido.
- Removidos paddings de container duplicados (eram redundantes com `cd-page`).

### Internal
- 3 páginas (`Prereqs`, `Doctor`, `Workspaces`) agora importam `../page.css` e seguem o sistema unificado de heading.
- CSS legado de header próprio (`cd-prereqs__head`, `cd-doc__head`, `cd-ws__head`, etc.) removido. Marcadores `▎` accent agora consistentes em TODAS as páginas.

## [15.2.4] — 2026-05-20 — Fix Dashboard (após screenshot) — Botão sóbrio + Altura fixa

Correção honesta de problemas visíveis em screenshot do app rodando: botão "Lançar" estava gritando vermelho saturado em cada card; cards COM diretórios recentes ficavam mais altos que cards SEM (apesar do `min-height`); drag handle ⋮⋮ ficava invisível.

### Fixed
- **Botão "Lançar/Install" mais sóbrio** — variant primary dentro dos cards (Launcher e Tools) agora usa **ghost com borda accent**, fundo transparente. Em hover, preenche com accent. O accent volta a ser destaque, não inundação.
- **Cards com altura realmente fixa** — `min-height: 168px` → **`height: 200px`** no `.cd-draggable-item` e `.cd-page__grid > .cd-card:has(.cd-tool-card__head)`. Tools cards também alinhados.
- **Drag handle ⋮⋮ sempre visível** — opacidade base de **0.35** (antes 0), sobe pra 0.7 no hover do card e 1.0 no hover do handle. Fantasma resolvido.
- **Sub-text do header com peso** — agora `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 1px`. Identifica como sistema de status, não nota soltinha.

### Changed
- Recents/Pinned dirs com altura cap menor (`max-height: 48px`) e ícones ▷/◆ em coluna fixa de 12px — alinhamento visual previsível.
- `cd-cli-card__launch-btn` (Custom CLIs) padronizado com o mesmo padrão ghost-accent do `cd-btn--primary` em card.
- Skeletons em **200px** (antes 168) para corresponder à altura real.

## [15.2.3] — 2026-05-20 — Polish v2 — Templates, Header, Stagger e EmptyState

Continuação do redesign visual. Foca em consistência de detalhes: cabeçalho de página, chip de status, templates salvos, animações de entrada e elementos de estado vazio.

### Added
- **Stagger animation** ao abrir as grids do Launcher e Tools — cards entram com fade-up escalonado (50 ms entre cada, até 8º card). Respeita `prefers-reduced-motion`.
- **Templates ("Saved templates") redesenhados** — mesma `surface-2 + border + radius` dos cards principais; hover com elevação; nome em `font-display 700`; meta em mono 10px.
- **Section title com marcador accent** (`▎`) — identifica seções de página com hierarquia visual.

### Changed
- **Header da página** (`cd-page__head`): título de 18px → 22px, weight 700; underline sutil separando do conteúdo; sub-text em mono 11px.
- **Chip de status** com `min-width: 64px`, `height: 22px` fixa, `justify-content: center` — chips de versão (ex: `1.0.0`, `MISSING`) agora têm tamanhos coerentes entre cards.
- **StatusBar** ganha `backdrop-filter: blur(12px)` igual à TopBar (efeito glass consistente top/bottom).
- **EmptyState** com border tracejada, gradient sutil, arte ASCII em accent com glow + pulse animation 3s. Título de 18px/700.
- **Skeletons** do Launcher e Tools agora têm `height: 168` (antes 92) — combinam com a altura real dos cards, sem "salto" no carregamento.

### Internal
- Stagger genérico em `.cd-page__grid > .cd-card` para Tools, Overrides etc. via `:nth-child` + `animation-delay`.

## [15.2.2] — 2026-05-19 — Dashboard Premium + Fix Ícone Antigravity

Polimento visual de toda a Dashboard (Launcher + Tools + CLI Overrides) e correção do ícone do Antigravity em Tools (typo no nome do arquivo).

### Fixed
- **Ícone do Antigravity em Tools** — arquivo `public/icons/tool/antgravity.svg` (sem o "i") renomeado para `antigravity.svg`. `TOOL_KEYS` em `src/icons/registry.ts` agora registra `"antigravity"`.

### Changed — Dashboard layout (Launcher, Tools, CLI Overrides)
- **Cards uniformes**: `min-height: 168px` no wrapper, `display: flex; flex-direction: column; height: 100%` no `.cd-card`. Cards ficam alinhados verticalmente, ações sempre na base via `margin-top: auto`.
- **Grid mais arejada**: gap de `s-3` → `s-4` (~12px → 16px), `minmax(240px, 1fr)` → `minmax(260px, 1fr)`.
- **Ícones maiores**: 22×22 → 32×32 (CLI/Tools), 32×32 → 40×40 (Override row). Mais legíveis e impactantes.
- **Tipografia consistente**: `font-display` (com fallback `font-mono`) para nomes a 14px/700; comandos em mono 10px com `letter-spacing`.
- **Truncate rígido**: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` em todos os textos críticos. Nada mais emolando.
- **Hover premium**: card eleva 1px + sombra suave + glow accent. Transições em `var(--dur-fast)`.
- **Recents/Pinned dirs**: altura fixa por item (24px) + `max-height: 60px` no container — limita visualmente a 2 itens sem cortar abruptamente.
- **Drag handle** opacidade 0 por padrão, sobe para 0.6 no hover do card e 1.0 no hover do próprio handle (mais sutil até precisar).

### Internal
- `Card.css` agora estrutura o card como flex column com `height: 100%` — necessário para alinhamento na grid.
- `LauncherPage.css` e `ToolsPage.css` ficaram com estrutura visual paralela (mesmo padding, mesma altura, mesmo hover).

## [15.2.1] — 2026-05-19 — Drag-and-Drop com @dnd-kit

Patch que troca o HTML5 native drag pelo `@dnd-kit` (pointer events). O gesto nativo não disparava em alguns ambientes Windows + WebView2; pointer events são universais.

### Added
- **`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`** (~22 kB gzipped) substituem o handler HTML5.
- `PointerSensor` com `activationConstraint: { distance: 8 }` — cliques em botões filhos continuam funcionando normalmente (precisa de 8 px de movimento para o gesto começar).
- `KeyboardSensor` — agora dá pra reordenar pelo teclado (espaço para pegar, setas para mover, espaço de novo para soltar).

### Changed
- Hook `useDraggable` removido (substituído pelo `useSortable` da lib).
- `LauncherPage` envolve a grid em `<DndContext>` + `<SortableContext>`.
- `CliCard`/`CustomCliCard` consomem `dndId` opcional e chamam `useSortable` internamente; o handle ⋮⋮ recebe os `listeners` da lib.

### Fixed
- **Drag-and-drop não funcionava** em ambiente Windows + WebView2 com HTML5 native drag.

## [15.2.0] — 2026-05-19 — Antigravity CLI Real + Electron Versioning + DnD Fix

Release focada em três correções convergentes: a detecção real do Antigravity CLI, a versão do IDE Electron e a usabilidade do drag-and-drop na Dashboard.

### Added
- **Antigravity CLI (`agy`)** — Detecção via `%LOCALAPPDATA%\agy\bin\agy.exe`, instalação por script PowerShell oficial (`iwr https://antigravity.google/cli/install.ps1 -useb | iex`) e checagem de updates pelo manifesto JSON público do Google.
- **`extra_paths` e `update_manifest_url`** — Novos campos opcionais em `CliInfo` permitindo CLIs script-installed sem hardcode (preparação para futuros casos similares).
- **`read_exe_product_version`** — Lê `ProductVersion` do PE para IDEs Electron (Antigravity, Cursor, Windsurf) que não respondem a `--version`.
- **Drag handle dedicado (⋮⋮)** — Elemento no cabeçalho dos CLI cards com cursor `grab`, opacidade animada e outline tracejado no drop target.
- **Hook `useDraggable`** — Lógica reutilizável de DnD entre cards.

### Changed
- **Antigravity CLI** migrado do pacote npm fake `@google/antigravity` (404) para o binário oficial `agy` com flag `--dangerously-skip-permissions`.
- **`check_tools` e `check_tool_updates`** caem em `ProductVersion` quando `--version` não retorna versão extraível — beneficia também Cursor e Windsurf.
- **DnD desacoplado do `<Card>`** — só o handle dispara `dragStart`, eliminando o conflito com `mousedown` dos botões filhos.

### Removed
- **Gemini CLI** — Descontinuado pelo Google; substituído pelo Antigravity em todas as listas, registries e copy.
- **Hardcode `antigravity`** em `resolve_windows_cmd` (binário real é `.exe`, não `.cmd`).
- **Ícones `gemini.svg` e `gemini.png`** em `public/icons/cli/`.

### Fixed
- **Antigravity não detectado** — comando real é `agy`, não `antigravity`; pacote `@google/antigravity` retorna 404 no npm.
- **Versão do Antigravity IDE ausente** — Electron apps não respondem a `--version`; agora lemos `ProductVersion` (Google v2.0.0).
- **Drag-and-drop não iniciava** — `<Button>`/`<Chip>` consumiam `mousedown` antes do gesture; handle dedicado resolve.

### Internal
- Clippy 1.94 — `manual_is_multiple_of` em `self_update.rs` corrigido (pre-existente desde v15.0).
- 15 testes unitários Rust passando (3 novos: `extra_paths`, `no-gemini`, `agy-command`).

## [15.1.0] — 2026-05-19 — Antigravity Integration & Glassmorphism

Release focada na integração oficial do Antigravity CLI e refinamento visual premium.

### Added
- **Antigravity CLI Official Integration** — Migrado de Tool para CLI com suporte completo a updates via NPM (`@google/antigravity`).
- **Auto-Approval Flag** — Configurada flag `--yolo` para o Antigravity, consistente com o fluxo do Gemini CLI.
- **Glassmorphism UI** — Efeito de desfoque (`backdrop-filter`) aplicado na Sidebar e TopBar para uma estética mais moderna e premium.
- **Clipboard Prompt Support** — Antigravity agora suporta a flag de prompt inicial a partir do clipboard.

### Changed
- **Version bumped** to 15.1.0 em `package.json`, `tauri.conf.json` e `Cargo.toml`.
- **Icon Registry** atualizado para refletir a nova categoria do Antigravity.
- **README** atualizado com Antigravity na lista de funcionalidades principais.

## [15.0.0] — 2026-04-24 — AI Ops Command Center

Maior release desde a v1: 16 features do PRD + 11 melhorias visuais + correções críticas dos botões de instalar.

### Added — Core (16 features)

- **FEAT-15.1: Updates Reliability** — Backend `check_all_updates` agora inclui tool_updates no total. Frontend usa chaves canônicas (`u.key ?? u.cli`) em vez de nome exibido para todas as chamadas invoke de update/install.
- **FEAT-15.2: Unified Presets & Templates** — Modelo unificado `LaunchProfile` substitui `LaunchPreset` (Admin) e `SessionTemplate` (Launcher). Migração automática com backup.
- **FEAT-15.3: Custom Tools Runtime** — Custom CLIs e IDEs integrados ao fluxo principal como cidadãos de primeira classe com badge `Custom`.
- **FEAT-15.4: Session Lifecycle** — Sessões agora têm estados reais (`starting`/`running`/`completed`/`failed`/`unknown`). Histórico não mente sobre status.
- **FEAT-15.5: Provider Adapter Matrix** — Providers definem protocolo (`anthropic_messages`/`openai_chat`/`openai_responses`/`custom`). Teste de conexão usa payload correto por protocolo.
- **FEAT-15.6: Secure Secrets** — API keys movidas para storage nativo seguro (DPAPI no Windows). Fallback transparente com aviso quando indisponível.
- **FEAT-15.7: Command Deck 2.0** — Tokens CSS consolidados, componentes de dialog/toast/confirmação próprios, zero `alert()`/`confirm()`/`prompt()` nativos.
- **FEAT-15.8: GitHub & Release Reliability** — Scripts `audit-release.sh` e `generate-latest-json.sh` para validar assets por versão no CI.
- **FEAT-15.9: Workspace Profiles** — Grupos por repo/time/contexto com troca rápida de diretório, CLI e provider.
- **FEAT-15.10: Agent Runbooks** — Sequências de passos para preparar ambiente e iniciar agentes. Execução com log por passo.
- **FEAT-15.11: Provider Budget Guard** — Limites locais de custo/uso por provider com alerta ao atingir 80%.
- **FEAT-15.12: Environment Doctor** — Diagnóstico e reparo de Node, Git, Rust, Python, Bun, CLIs e IDEs com severidade (crítico/aviso/info) e ação recomendada.
- **FEAT-15.13: Safe Command Preview** — Preview de comandos customizados com classificação de risco (safe/caution/dangerous), dry-run e confirmação obrigatória.
- **FEAT-15.14: Self-Updater** — Verificação, download e validação de update do AI Launcher separado de update de ferramentas.
- **FEAT-15.15: Windows Distribution** — Scripts de assinatura + docs para Winget/Chocolatey publishing.
- **FEAT-15.16: Accessibility** — Labels descritivos, estados de foco consistentes, navegação completa por teclado, focus trap em dialogs.

### Added — Visual (Tier 1/2/3)

- **Dotted grid background** no main (radial-gradient 24px, opacity 0.06 dark / 0.08 light) — reforça identidade terminal-native.
- **Elaborate focus ring** — outline 1px + offset 3px + 4px accent-soft + 12px glow.
- **Density toggle** (comfortable / compact) via `[data-density]` tokens — shortcut no TopBar.
- **Sidebar mini-indicadores** — badges contextuais em History (sessões hoje), Costs ($), Workspaces (pinned), Updates (pending).
- **StatusBar expandida** — última sessão recente + provider latency dot (green/yellow/red).
- **EmptyState component** com 5 ASCII art presets (terminal/toolbox/clock/chart/check) — wired em Launcher, Tools, Updates, Costs.
- **Bento grid Workspace** — CSS Grid com 5 cards (Profiles, Budget, Doctor, Runbooks, Recent Sessions) e navegação click-through.
- **History timeline waterfall** — bars horizontais com status dots, toggle 24h/7d, waterfall terminal-native.
- **Rich Command Palette** — categorias (Navigate/Actions/Recent/Theme), ícones, shortcut chips, fuzzy highlight com `<mark>`, recent sessions relaunchable.
- **4 theme variants** — dark (default) / light / amber (CRT retro, #ffb000) / glacier (cool blue, #4da6ff) com cycle toggle.
- **Space Grotesk** — nova `--font-display` para títulos de página via `.cd-page__title`.
- **Phosphor Icons** foundation — `@phosphor-icons/react` instalado, `Icon.tsx` wrapper + `icons.ts` curated exports.

### Changed

- **Version bumped** to 15.0.0 across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- **DevUrl** changed from `localhost:5173` to `127.0.0.1:5173` (Windows `getaddrinfo EAI_FAIL` fix).
- **E2E config** uses `127.0.0.1` instead of `localhost`.
- **CSS tokens** consolidated — removed undefined `var(--surface)` references, aligned font selector with `--font-mono`.
- **App.tsx chrome** consolidated — single `ChromeConnector` shares `useUsage` + `useUpdates` across sidebar + statusbar.
- **Theme cycle** — toggle agora cicla 4 temas em vez de 2 (dark → light → amber → glacier).

### Fixed

- **🔥 Install buttons completamente quebrados** — botões de "Instalar" e "Corrigir" em Pré-reqs, Doctor e Updates não faziam nada ao clicar. Causa raiz: frontend enviava `{ name }` mas backend esperava `{ key }`, e o `CheckResult` nunca retornava chave canônica (só nome de exibição como "Node.js / npm" que não casava com os match arms do `install_prerequisite`). `PrereqCard` também não tinha botão, só mostrava o comando como texto. **Fix**: campo `key: String` adicionado em `CheckResult`, populado em todos os 14 prereqs, `PrereqCard` ganhou botão real, classify() do Doctor agora casa por key em vez de name.
- **Updates total bug** — `check_all_updates` now includes `tool_updates` in `total_with_updates` count.
- **Key vs display name** (CLI updates) — CLI and tool update actions now use canonical keys instead of display names.
- **E2E localhost failure** — Playwright and Vite dev server now use `127.0.0.1` instead of `localhost`.
- **Undefined CSS tokens** — `var(--surface)` references replaced with existing tokens.
- **Font selector broken** — `appearance.ts` now writes to `--font-mono` (actual token) instead of `--ff-mono` (orphan).
- **Doctor classify()** — was matching lowercase names ("node.js / npm") against a Set of keys ("node"), never matching. Now classifies by canonical key.

### Security

- API keys no longer persist in plaintext `localStorage` by default. Migration runs in background on boot.
- `exportData` continues to redact `apiKey`, `Authorization`, `token`, `secret` fields.
- Safe Command Preview required for all custom commands — dangerous risk level requires double confirmation.

### Stats

- 16 features across 5 milestones + 11 visual improvements
- 5 commits on `release/v15` branch (backup preserved on `backup/pre-v15-main`)
- Tests: 61/61 passing (7 files)
- Build: 459 KB JS (131 KB gzip), 84 KB CSS (13 KB gzip)
- Dependencies added: `@phosphor-icons/react` (tree-shaken: ~30 bytes gzip for used icons)

## [14.0.0] — 2026-04-23 — Major Release

### Added
- **Autostart with Windows** (opt-in in Admin → Appearance) — launches minimized to tray via `tauri-plugin-autostart`.
- **Global hotkey UI** — Admin → Appearance now exposes the tray hotkey as editable text; backend `set_tray_hotkey` re-registers atomically.
- **Pinned directories** — pin up to 3 favorite dirs per CLI; pins render above recent-dirs on every CliCard.
- **Session templates** — save a full launch config (CLI + dir + args + toggle + provider) as a named, reusable template.
- **Native desktop notifications** (opt-in) — toasts for `install_cli`/`update_cli`/`install_tool` completion and at launch time.
- **History filters** — filter by CLI, provider, and date range (today / 7d / 30d / all).
- **Export usage stats** — download costs as CSV or JSON with ISO-dated filenames.
- **Clipboard → initial prompt** — optional toggle for claude/codex/gemini that appends `-p "<clipboard>"` at launch.
- **Free-form accent color picker** — any hex in addition to the 5 preset swatches. Stored in `ai-launcher:accent-custom`.
- **Error Boundary** — global React boundary with i18n (EN + pt-BR). UI crashes now show a retry fallback instead of a blank screen.
- **Zod schema validation** — `importConfig` rejects malformed exports with field-path error messages.
- **Vitest + smoke coverage** — 34 tests across recent-dirs, pinnedDirs, sessionTemplates, configIO, exportData, useAccent.
- **Rust unit tests** — 8 tests in `util.rs` covering `strip_ansi`, `parse_version`, arg sanitization.
- **Playwright E2E** — 2 smoke tests with stubbed Tauri invoke.
- **CI quality gates** — new `.github/workflows/quality.yml` with tsc, vitest, clippy, cargo audit, e2e (parallel, concurrency-controlled).
- **thiserror** + `errors::AppError` infrastructure for typed error propagation.

### Changed
- **`main.rs` modularized** — 3.105 → ~120 lines. 34 commands split across `commands/{cli,tools,updates,config,system}.rs`. Tray moved to `tray.rs`. Shared helpers in `util.rs`.
- **`LaunchDialog`** refactored from 9 `useState` to a single `useReducer`.
- **`tauri-plugin-single-instance`** added — reopening the app now focuses the existing window instead of spawning new processes.
- Archived `docs/PRD-v12.md` → `docs/archive/`. `.playwright-mcp/` added to `.gitignore`.

### Fixed
- **Multiple tray icons** — resolved by single-instance guard.
- **Recent dirs dropdown bleed-through** — parent field now establishes stacking context (`z-index: 20`), dropdown bumped to `z-index: 100` with solid `--surface-1` background and backdrop-filter.
- **Provider select unreadable in dark theme** — invalid `var(--surface)` token replaced with `var(--surface-1)`, explicit `<option>` styling added.

### Deferred to v14.1
- **Self-updater** via `tauri-plugin-updater` (requires signing key generation + `release.yml` changes).
- **Session-end notifications** for `launch_cli` (requires retaining child-process handles + async monitor tasks).

## [13.5.0] — 2026-04-23 — Feature Release

### Added
- **Provider badge in history** — Each history row now shows which provider (Anthropic, Z.AI, MiniMax, etc.) was used for Claude sessions. Deleted providers display a warning badge.
- **Quick-access recent directories on CLI cards** — Last 3 opened directories appear directly on each installed CLI card in the Launch tab. Click to relaunch instantly without opening the dialog.
- **Relaunch provider guard** — Reopening a history entry whose provider was deleted now prompts for confirmation before falling back to the default.

### Changed
- **Version bumped** to 13.5.0 across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.

## [13.0.0] — 2026-04-23 — Major Release

### Added
- **New minimalist icon** — Hex Hub design in red (`#ff4757`), clean at all sizes. Replaces rocket+terminal icon across installer, desktop, taskbar, navbar and app.
- **Provider persistence in history** — `HistoryItem` now stores `providerId`. Reopening a Claude session restores the exact provider used (not the default).
- **Recent directories dropdown** — Last 10 unique directories per CLI stored in `ai-launcher:recent-dirs`. Shown on directory input focus for quick selection.
- **Screenshots gallery** — 11 screenshots added to `docs/screenshots/` and embedded in both README.md and README.pt-BR.md.

### Changed
- **Icon regeneration** — All 17 icon sizes in `src-tauri/icons/` regenerated from new SVG (1024px base, ICO, Windows Store tiles).
- **README redesign** — Both EN and pt-BR READMEs updated with screenshot gallery, v13 section, and collapsible v12.5 highlights.

## [12.5.0] — 2026-04-23 — Feature Release

### Added
- **Updates tab** — Dedicated surface for CLI, tool and prerequisite updates with Update All button, per-item update/install, and manual refresh. `Ctrl+5` shortcut.
- **Install from cards** — Install missing CLIs and tools directly from Launch and Tools tabs via inline button.
- **History improvements** — Reopen sessions (re-launches with same args), add inline descriptions, status badges (running/finished/error with pulse animation), duration tracking, remember last directory per CLI (`ai-launcher:last-dir`).
- **Test API button** — Test provider connections directly from Admin with latency display and success/error indicators.
- **Official brand icons** — Real vendor logos from LobeHub Icons (claude, codex, gemini, qwen, opencode, cursor, windsurf, antgravity) and devicons (vscode, jetbrains). All visible in both dark and light themes.
- **Welcome screen reformulation** — DevManiacs branding with animated terminal, guided tour, "always show on startup" toggle saved in localStorage.
- **New app icon** — Rocket + terminal design for installer, taskbar and desktop shortcut.
- **NSIS language selector** — Installer now offers pt-BR / English selection on setup.
- **i18n keys** — Full `updates` section, `admin.providers.test*`, and `onboarding.step2ShowOnStartup` keys in both EN and pt-BR locales.

### Changed
- **Icon registry** — `src/icons/registry.ts` now serves PNG for LobeHub-sourced icons and SVG for devicons/custom, ensuring correct light/dark visibility. `lib/iconRegistry.ts` delegates to it.
- **README.md / README.pt-BR.md** — Redesigned with realistic terminal ASCII art showing live Command Deck output.
- **Version bumped** to 12.5.0 across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.

### Fixed
- **Icons invisible in dark/light mode** — Replaced all `fill="currentColor"` SVGs with fixed-color versions; removed dark-mode-only PNGs.
- **CLI overrides icons broken** — `iconRegistry.ts` had stale paths (`.svg` instead of `.png` for LobeHub icons, `kilo.svg` instead of `kilocode.svg`). Now delegates to `icons/registry.ts`.
- **Accent color selector bugged** — TopBar swatches used `var(--accent)` making all colors change together. Fixed with static oklch colors per swatch.
- **Costs page `formatUsd` NaN** — Added `Number.isFinite` guard before formatting.
- **Costs page i18n key** — `costs.entries` replaced with `costs.entriesTracked` (key that actually exists).
- **Costs page text overflow** — Added `overflow: hidden; text-overflow: ellipsis` on CLI names and hero amount.
- **Welcome screen version hardcoded** — Now reads from `package.json` dynamically.
- **LaunchDialog directory** — Now remembers last used directory per CLI across sessions.

## [12.0.0] — 2026-04-23 — Evolution Release

### Added
- **Keyboard shortcuts** — `Ctrl+1-5` for tab navigation, `Ctrl+,` for Admin, `?` for Help. Global `keydown` listener in App.tsx with input/textarea guard.
- **Prerequisites page** — Dedicated tab checking 13 tools: Node.js, npm, Python, pip, Git, Rust, Cargo, pnpm, yarn, Bun, Windows Terminal, PowerShell 7+, Git LFS, Docker, VS Code, Tauri CLI. Grid layout with install hints for missing tools.
- **Update detection** — `useUpdates` hook with automatic background check + manual refresh. 1-hour sessionStorage cache. Checks CLI, tool and environment updates via `check_all_updates` Tauri command.
- **Update badges** — ⬆ indicator on CliCard and ToolCard when newer versions are available.
- **Rich StatusBar** — Real data from stores (online/total, today's spend), live clock, DevManiac's branding, updates count with warn color, refresh button.
- **Terminal animation** — Improved animated terminal on Help page showing realistic AI Launcher session (scan → launch → costs).

### Fixed
- **StatusBar disconnected** — `online={0} total={0}` hardcoded in App.tsx. Now reads from `clisStore` and `useUsage`.
- **pt-BR translation** — `nav.launcher` was "Launch" (English). Changed to "Lançar".
- **TopBar accent tokens** — Accent color buttons used hardcoded hex values instead of CSS variables.
- **Unused imports** — Removed `SUPPORTED_LOCALES` from TopBar.tsx, `TAB_ORDER` from App.tsx.

### Changed
- **TabId** — Added `prereqs` tab with `Ctrl+5` shortcut.
- **Sidebar** — Added Prereqs tab in workspace group.
- **i18n** — Added `prereqs` and `statusBar` sections to both locales.
- **README** — Complete redesign with centered header, badges, feature table, surfaces guide, tech stack table. Both EN and pt-BR.
- **Version bumped** to 12.0.0 across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.

## [11.0.0] — 2026-04-22 — Localization & Polish

### Added
- **Language selector in TopBar** — PT/EN toggle button between accent swatches and theme toggle. One-click language switch without navigating to Admin.
- **Animated Terminal component** (`src/features/help/AnimatedTerminal.tsx`) — typing-effect terminal showing `ai-launcher --scan`, CLI detection results, launch command and version output. Traffic-light dots, blinking cursor, dark background.
- **Tools scan cache** (`src/features/tools/toolsStore.ts`) — module-level singleton with `sessionStorage` TTL 10 min via `useSyncExternalStore`. Subsequent visits to the Tools tab hydrate instantly instead of re-invoking backend scan on every tab switch.
- **Help page expansion** — Getting Started guide, keyboard shortcuts table, FAQ/Troubleshooting section, replay tour button, GitHub links (GitHub, README, Issues, Changelog), About card with DevManiac's branding and version info.
- **GitHub links** in Help page — direct buttons to GitHub repo, README, Issues and Changelog, opened via Tauri `open_external_url`.

### Changed
- **i18next config fix** — removed `supportedLngs`, `nonExplicitSupportedLngs` and `load: "currentOnly"` from init config to fix i18next v24 bug where `isSupportedCode('pt-BR')` returned false, causing all pt-BR translations to resolve as raw keys.
- **Version bumped** to 11.0.0 across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- **README.md and README.pt-BR.md** — removed screenshots (placeholder SVGs), updated version badges and ASCII art to v11.0.0, updated "What's new" section to v11.

### Preserved
- Rust backend (`src-tauri/`) and all `invoke` contracts.
- All localStorage keys and shapes from v10.1 (providers, presets, custom IDEs, CLI overrides, history, appearance).

## [10.1.0] — 2026-04-22 — Command Deck Refinement

### Added
- **Português (Brasil) locale** — i18next + LanguageDetector with pt-BR as default and English fallback. Switcher in Admin → Appearance. Locale persists in `localStorage["ai-launcher:locale"]`.
- **Language switcher** button group in Admin → Appearance (pt-BR | en).
- **CLI scan cache** (`src/features/launcher/clisStore.ts`) — module-level singleton with `sessionStorage` TTL 10 min. Subsequent visits to the Launcher hydrate instantly instead of re-invoking `check_clis` on every tab switch.
- **Rescan button** in the Launcher header — forces a fresh backend scan and invalidates the cache.
- **Replay welcome tour** button in Help page with confirmation dialog — clears `ai-launcher:onboarding-done` and reloads; settings (theme/accent/providers) preserved.
- **Permission toggle** in Launch Dialog — `--dangerously-skip-permissions` is now user-facing per launch (previously hardcoded on).
- **Provider selector** in Launch Dialog (Claude Code only) — pre-selected to the active provider; dropdown with all saved profiles (Anthropic official, z.ai, MiniMax, Moonshot, Qwen, OpenRouter, custom). Env vars are built on the fly via `buildLaunchEnv()`.

### Changed
- **Icons redesigned** — all 8 CLI glyphs and 5 Tool glyphs redrawn with distinctive line-art identity at 24×24/stroke 1.5 (`claude` radial sun, `codex` codex manuscript, `gemini` 4-point star, `qwen` magnifier, `crush` diamond, `droid` robot with antenna, `kilocode` K-profile + bullseye, `opencode` paired braces, `vscode` ribbon chevron, `cursor` classic pointer, `windsurf` sail + water, `antgravity` 3-axis orbit, `jetbrains-ai` framed J+A).
- **Card placeholder** (CLI + Tool) now renders a filled `◆` glyph in `--text-dim` instead of a grey block.
- **Release + build CI** use `npm ci --legacy-peer-deps` so the i18next peer vs. TS 6 conflict no longer aborts the workflow.

### Fixed
- **Kilocode icon never rendered** — backend key `kilocode` was looking up `/icons/cli/kilocode.svg` but the file was named `kilo.svg`. Renamed.
- **Release workflow failing on every tag since v9.0** — peer-dep resolution error is now bypassed in CI.

### Removed
- Orphan CLI icons (`aider.svg`, `copilot.svg`, `minimax.svg`) — these CLIs have no backend counterpart, so the icons were dead paths that created confusion.

### Preserved
- Rust backend (`src-tauri/`) and all `invoke` contracts.
- All localStorage keys and shapes from v10.0 (providers, presets, custom IDEs, CLI overrides, history, appearance).

## [10.0.0] — 2026-04-22 — Command Deck

### Changed (breaking visual rewrite)
- Entire frontend rewritten from scratch in the **Command Deck** visual direction — dark-first monospace terminal aesthetic with vermelho LED accent.
- New architecture: `src/app/`, `src/ui/`, `src/features/`, `src/theme/`, `src/icons/`, `src/hooks/`.
- Theme system: dark (default) + Hard Light, attribute-based (`data-theme`), with pre-paint restore to prevent FOUC.
- Accent system: 5 selectable colors (red default, amber, green, blue, violet) via `data-accent` + `useAccent` hook.
- Typography: self-hosted JetBrains Mono + Inter (SIL OFL 1.1).
- Tools tab restored — IDE management surface is back as a first-class tab.
- Admin mode unified — no more toggle; one build, always full access (`--dangerously-skip-permissions` by default).
- Icon set rewritten — 16 coherent 24×24 line-art glyphs using `currentColor`, stroke-width 1.5.
- Command palette (⌘K / Ctrl+K) with Navigate / Theme / Accent groups.

### Added
- Onboarding flow (welcome → personalize → scan CLIs).
- Per-CLI name/icon overrides editor with image upload.
- Custom IDEs CRUD in Admin.
- Platform-aware keyboard shortcut labels (⌘ on macOS, Ctrl elsewhere).
- ARIA-compliant Dialog with focus trap, `aria-current` on active nav item, role-based live regions on Banner.

### Removed
- v9 "Soft Workbench" components, styles, and tabs.
- `adminMode` toggle and all conditional non-admin code paths.
- Bilingual i18n runtime (temporarily English-only in v10; returns in a later release).
- External Google Fonts request (fully self-hosted now).

### Preserved
- Rust backend (`src-tauri/`) and all `invoke` contracts.
- localStorage keys and shapes for providers, presets, custom IDEs, CLI overrides, launch history (stored inside `ai-launcher-config`).

## [9.1.0] — 2026-04-22

### 🎨 "Soft Workbench 2.0" — Complete Visual Overhaul

Major visual reformulation following Figma-style minimalist modern design with warm terracotta accents.

### Added

- **Dark mode**: Full dark theme with Figma-style surface hierarchy (`#1a1a1a` bg, `#242424` surface)
- **Official brand icons**: SVG icons for Claude, VS Code, Cursor, Gemini from brand CDN/custom designs
- **Custom icons**: Kilo Code, OpenCode, Crush, Droid with flat branded designs
- **Theme toggle**: Sun/moon switch in HeaderBar, persisted in localStorage
- **Accent color picker**: 5 warm presets (Terracotta, Coral, Amber, Sage, Slate) + custom color via native picker

### Changed

- **Admin unification**: All users have full admin access — removed `VITE_ADMIN_MODE` split and `isAdminMode()` gate
- **LauncherTab cards**: New Figma-style design without `>` prompt, shadows and hover lift, accent ring on selection
- **Onboarding**: Clean centered card without TerminalFrame decoration, slide-up animation
- **HeaderBar**: Minimalist redesign — 56px height, logo left, nav center, theme toggle + help button right
- **Color tokens**: Full Figma-style light/dark token system (`--bg`, `--surface`, `--text`, `--accent`, etc.)
- **README**: ASCII terminal art + updated description

### Fixed

- **Visual uniformity**: Replaced generic card grid with intentional component design
- **Terminal aesthetic removal**: No more fake terminal frames as decoration

## [9.0.0] — 2026-04-22

### 🎨 "Soft Workbench" — Reformulação total de UI, aparência e iconografia

Release major dedicada a substituir a estética terminal/futurista herdada da v8 por uma linguagem visual mais amigável e madura. A v9 também formaliza a camada de aparência e a lógica de ícones para permitir personalização real e manutenção mais limpa.

### Added

- **Presets de destaque no Admin** com persistência local e aplicação global na interface.
- **Registry central de ícones built-in** em `src/lib/iconRegistry.ts`.
- **Overrides de ícones com imagem local** para itens embutidos.
- **Suporte a imagem de ícone em CLIs/IDEs customizadas**.
- **Documentação operacional de troca manual** em `docs/ICON_OVERRIDES.md`.
- **Spec e plano da v9** foram preservados no histórico Git, mas removidos da árvore pública atual na limpeza de docs.

### Changed

- **UI shell** refeita com nova direção `Soft Workbench`.
- **Theme defaults** migrados para uma identidade light-first mais quente.
- **Header, status bar, launcher cards e superfícies administrativas** atualizados para a nova linguagem visual.
- **Família oficial de ícones** refeita para CLIs e tools built-in.
- **README público** reescrito sem banner/prints antigos.
- **README pt-BR** reescrito sem mockups antigos.

### Fixed

- **Personalização superficial de ícones**: built-ins não dependem mais apenas de emoji para override.
- **Dívida visual da v8**: reduzida a partir de tokens, shell e cards centrais alinhados à nova identidade.

## [8.0.0] — 2026-04-21

### 🎨 "Friendly Dashboard" — Complete UI/UX Redesign & Robust i18n

Major release transforming the user experience from the strict "Terminal Dramático" to a modern, accessible, and clean "Data-Dense Dashboard" (Friendly Dashboard). This update also brings flawless internationalization (i18n) support and advanced custom icon management.

### Added

- **Advanced Custom CLI/IDE Icons** — Users can now upload PNG/JPG images for custom tools. Includes an integrated crop and resize tool to ensure custom icons look perfect alongside built-in ones.
- **Friendly Dashboard Design System** — A completely new visual language replacing the dense dark terminal look. Features a softer slate/blue color palette, 4.5:1 WCAG AA contrast ratio, and generous spacing for better readability.
- **Fluid i18n Typography & Layouts** — The entire layout is now flex-wrapped and fluid, preventing text clipping or overflow when switching between English and Portuguese.
- **Redesigned Official Icons** — Built-in CLIs now feature colorful, recognizable icons, retiring the previous minimalist 32x32 wireframe glyphs.

### Changed

- **UI Typography** — Shifted from 100% monospace to a hybrid approach: Fira Code for terminals and data, Fira Sans for general UI elements.
- **100% i18n Coverage** — Eliminated all hardcoded strings. Every single text element in the app now runs through `useTranslation()` with strict validation.
- **Improved Hover States & Hitboxes** — Increased touch targets (minimum 44x44px) and added smooth 150-300ms transitions for better interactivity.

### Fixed

- **i18n Translation Leaks** — Fixed issues where English and Portuguese texts would mix or fail to update instantly upon language switch.
- **UI Overflow** — Fixed horizontal scrolling bugs caused by long translation strings in the Brazilian Portuguese locale.

---

## [7.1.0] — 2026-04-21

### 🎨 "Polish & Wire" — Bug fixes + custom launches + built-in overrides

Minor release focused on fixing v7.0 rough edges and closing the custom-launch loop.
Zero schema breaking; all v7.0 data carries over.

### Added

- **Custom CLI launch wiring** — `launch_custom_cli` Rust command mirrors
  the built-in `launch_cli` spawn style (Windows Terminal → pwsh →
  powershell → cmd fallback chain, PS-encoded args, env injection).
  LauncherTab extracts binary from `installCmd` and invokes.
- **Custom IDE launch wiring** — `launch_custom_ide` Rust command resolves
  `<dir>` placeholder in `launchCmd`. Tools tab gets "Launch" button per
  custom IDE row.
- **Override built-in CLI/IDE name + icon** — hover reveals ✎ edit button
  on each built-in card. Change display name + icon (emoji/text).
  Storage: `ai-launcher:cli-overrides` / `ai-launcher:ide-overrides`.
  Empty override auto-cleans (no stub keys). Reset restores defaults.
- **Same-tab settings state sync** — `appSettings`, `customClis`,
  `customIdes`, `cliOverrides`, `ideOverrides` all dispatch CustomEvents
  on save. Consumers subscribe and update reactively — **no more reload
  required** after Admin changes.
- **`commandTimeout` wired to Rust** — `install_cli` and `update_cli`
  wrapped with `tokio::time::timeout`. Default 300s, overridable via
  `timeout_sec` arg. Frontend passes `appSettings.commandTimeout`.
- **12 redesigned icons** — 8 CLI + 4 IDE SVGs under 500 B each,
  minimalist 32×32 glyphs with brand colors preserved.
- **Upgraded banner SVG** — realistic terminal mock: traffic lights with
  glow, filename tab `ai-launcher — terminal — pt-BR`, 6-row prompt flow
  with syntax-like coloring, cursor block, scanlines pattern, provider
  badge, bottom status strip. 7.8 KB (was 4.2 KB).

### Fixed

- **Scroll in all tabs** — `.app` was missing `overflow: hidden`, and
  `.tab-content` had no `flex:1` / `overflow-y:auto` / `min-height:0`.
  All tabs now scroll independently with HeaderBar/StatusBar pinned.
  Affected: Launcher, Install, Tools, History, Costs, Help, Updates.
- **Language switcher not applying pt-BR** — root cause: react-i18next's
  default `useSuspense: true` was silently swallowing `languageChanged`
  events before child consumers re-rendered. Fix: `useSuspense: false`
  + `bindI18n: 'languageChanged loaded'` + defensive force-rerender
  listener in App.tsx. `setLocale` now awaits `changeLanguage` and
  dispatches a custom event.
- **HeaderBar reactive language display** — was imperative `getLocale()`,
  now `i18n.resolvedLanguage` via `useTranslation()` subscription.

### Changed

- **Accent color token** — `--text-prompt` swapped from terminal-green
  (`oklch(72% 0.15 160)`) to warm-red (`oklch(62% 0.210 25)`) in both
  dark + light themes. Banner SVG prompt glyphs updated `#58D68D` →
  `#E5514F`. Brand colors untouched.
- Banner references `.svg` instead of `.png` (v7.0 leftover).

### Notes

- Windows-only launch commands for now. macOS/Linux return an error;
  full platform support tracked for v7.2.
- Override affects display only; CLI key/install command unchanged.
- Custom CLI launch uses heuristic to extract binary from `installCmd`
  (strips `npm install -g ` / `pip install ` prefix). Users with exotic
  install patterns (cargo, winget) should use the key as binary name.
  A dedicated `launchCmd` field is tracked for v7.2.

---

## [7.0.0] — 2026-04-21

### 🧩 "Extensible" — Onboarding + FAQ + Custom CLIs/IDEs + Preferences

Major release focused on user extensibility. You can now add your own CLIs and
IDEs, search the FAQ, tune preferences, and take a 9-slide tour on first run.
**Zero schema breaking changes.** New banner SVG. Windows-only today; macOS &
Linux planned.

### Added

- **Onboarding v7** — 5 steps (was 4):
  - Typing-caret animation on welcome tagline (respects `prefers-reduced-motion`)
  - New `autoDetect` step reading `VITE_ANTHROPIC_API_KEY` from env
  - New 9-slide `tour` carousel covering every tab (launcher/install/tools/
    history/costs/palette/admin/help/updates) with arrow-key nav
- **HelpTab refactor** — extracted from App.tsx into `src/tabs/HelpTab.tsx`:
  - 2-pane layout (sidebar sections + content accordion)
  - Global FAQ search filters across all Q&A items
  - 10 Q&A entries across 5 sections (Getting Started / Providers /
    Shortcuts / Troubleshooting / Privacy)
  - Inline actions: reopen onboarding, re-enable welcome, reset all
  - App.tsx loses ~185 lines of inline help JSX
- **Custom CLI add** (Admin → Add Custom CLI):
  - New `src/lib/customClis.ts` with localStorage persistence
  - `CustomCliModal` form (name, key, installCmd, versionCmd, launchArgs,
    docsUrl, iconEmoji) with per-field validation
  - Rendered in LauncherTab with dashed border variant
  - Storage key `ai-launcher:custom-clis` (additive)
  - Launch wiring deferred to v7.1 (currently alert placeholder)
- **Custom IDE add** (Tools tab → Add Custom IDE):
  - New `src/lib/customIdes.ts` mirroring CustomCli pattern
  - `CustomIdeModal` form (name, key, detectCmd, launchCmd, docsUrl, iconEmoji)
  - Storage key `ai-launcher:custom-ides`
  - Placeholder `<dir>` in launch command (was `{{dir}}` — escaped to avoid
    i18next interpolation)
- **Admin Preferences section** — 3 new settings:
  - `maxHistory` (default: 50) — limits history array size
  - `refreshInterval` (seconds, default: 0 = manual) — auto re-check CLIs
  - `commandTimeout` (seconds, default: 30) — persisted for v7.1 Rust wiring
  - Reset-to-defaults button
  - `src/lib/appSettings.ts` + localStorage key `ai-launcher:app-settings`
- **New banner SVG** — terminal-themed 1200×300
  vector with prompt mock, mono wordmark, dual-language tagline hint
- **Platform notice in READMEs** — Windows ✅ · macOS 🔜 · Linux 🔜
- **~100 new i18n keys** — 520 total per locale (en + pt-BR), parity 0

### Changed

- `App.tsx` — 1672 → ~1470 lines after HelpTab extraction (net -200)
- `Onboarding.tsx` — STEPS tuple now 5 entries; dropped static `provider` step
  (tour's `admin` slide covers it)
- Banner reference in READMEs switched from `.png` to `.svg`
- History slice logic now consumes `appSettings.maxHistory` across 3 call sites
  (launch, launchFromPreset, CommandPalette onLaunchCli)

### Notes

- Custom CLI / IDE launch wiring pending for v7.1 (backend changes needed)
- Same-tab settings state sync pending for v7.1 (cross-tab works via `storage`)
- macOS and Linux builds planned — follow the releases page for announcements
- Provider seeds from v6.1 (Moonshot, Qwen beta, OpenRouter) carry over
- Runtime admin toggle from v5.5.1 continues to work (`⌘⇧A`)
- Bilingual UI from v6.0 continues to work (`⌘⇧L`, globe dropdown)

---

## [6.1.0] — 2026-04-21

### 🌍 "More Providers" — Moonshot, Qwen (beta), OpenRouter

Três novos provider seeds built-in. Expande `ProviderKind` de 4 para 7 membros.
Zero breaking changes — usuários atuais mantêm seus perfis.

### Added

- **Moonshot / Kimi (oficial)** — `https://api.moonshot.ai/anthropic` (intl) +
  `api.moonshot.cn/anthropic` (CN). Modelos: `kimi-k2-0905-preview` (main),
  `kimi-k2-turbo-preview` (fast). Contexto: 256K. Tem plano "Kimi for Code"
  oficial com suporte Claude Code.
- **Qwen / DashScope (Alibaba)** ⚠️ **BETA** —
  `https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code` (intl) +
  endpoint CN. Modelos: `qwen3-coder-plus` (main), `qwen-plus` (fast).
  Contexto: 256K. Integração Anthropic-compat ainda em rollout pela Alibaba;
  endpoint pode sofrer ajuste.
- **OpenRouter** (aggregator) — `https://openrouter.ai/api/v1`. Uma chave dá
  acesso a dezenas de modelos (Anthropic, Moonshot, Qwen, GLM, Gemini, GPT,
  Llama). Padrão configurado com slugs Anthropic (`anthropic/claude-sonnet-4`
  + `anthropic/claude-haiku-4-5`); substituível por qualquer modelo suportado.
- **Brand color tokens** — `--color-brand-moonshot/qwen/openrouter` em ambos
  dark + light.
- **HeaderBar dot colors + HistoryTab provider accents** — 3 novas classes.

### Changed

- **`ProviderKind` union** — agora com 7 membros (`anthropic | zai | minimax |
  moonshot | qwen | openrouter | custom`). `docsLinks.ts` + `modelCatalog.ts`
  expandidos para cobrir exhaustive Record<ProviderKind>.
- **READMEs (EN + pt-BR)** — tabela de providers expandida pra 7 linhas,
  seções "Regions / CN endpoints" e "API keys" com portals oficiais.

### Notes

- Env vars novas suportadas no build: `VITE_MOONSHOT_API_KEY`,
  `VITE_QWEN_API_KEY`, `VITE_OPENROUTER_API_KEY` (todos opcionais).
- Qwen endpoint flagged como ⚠️ BETA tanto no seed note quanto no README.
  Alibaba ainda não documentou publicamente o path Anthropic-compat em inglês.
- OpenRouter cobra pass-through + ~5% markup; tokens/context variam por slug.

---

## [6.0.0] — 2026-04-21

### 🌐 "Bilingual" — Full internationalization (EN / pt-BR)

Major release. All UI strings now flow through `react-i18next` with complete
English and Portuguese (Brazil) catalogs. Language auto-detects from browser,
persists in `localStorage`, and can be switched at runtime via HeaderBar
dropdown or `⌘⇧L` chord. **Zero schema migrations.**

### Added

- **react-i18next integration** — `i18next@^24` + `react-i18next@^15` +
  `i18next-browser-languagedetector@^8`. Library overhead ~25 KB gzipped.
- **Complete translation catalogs** — 410 keys each in `en.json` and
  `pt-BR.json`, covering every visible string (tabs, tabs inline content,
  modals, toasts, providers, onboarding, help).
- **Language auto-detection** — reads navigator.language (pt*  → pt-BR,
  else → en). Persisted in `localStorage['ai-launcher:locale']`.
- **HeaderBar language switcher** — globe icon dropdown with `> current`
  prompt indicator and native/short labels (English / EN, Português / PT).
- **Global chord `⌘⇧L` / `Ctrl+Shift+L`** — cycles EN ↔ pt-BR with
  confirmation toast. Guards against typing in inputs.
- **`README.pt-BR.md`** — Portuguese README mirror alongside the English
  primary `README.md`. Language switcher link at top of each.

### Changed

- **README.md** — rewritten for v6 bilingual. Primary English with link to
  Portuguese counterpart. Features list includes v5.5.1 runtime admin +
  v6.0 bilingual.
- All UI components now use `t()` from `useTranslation()`. 300+ hardcoded
  strings replaced; no invented keys (everything flows through the catalogs).
- `onboarding.launch.body` and `quickSwitch.hint` use `<Trans>` with
  `<kbd>` component slots to preserve inline markup.
- HeaderBar tab labels derived from `header.tabs.*` keys (no hardcoded labels).

### Notes

- English is the primary language for new strings going forward. pt-BR
  catalog preserves original Portuguese copy verbatim for continuity.
- Custom user content (preset names, history entries, provider display
  names the user typed) is NOT translated — stays as entered.
- Browser locale detection supports `pt`, `pt-BR`, `pt-br`, `pt-PT` — all
  resolve to `pt-BR`. Any other → `en` fallback.
- Admin toggle, font picker, command palette, help modal, onboarding,
  history filters, cost aggregation — all bilingual.

### Known follow-ups

- Translate CHANGELOG descriptions for pt-BR readers (low priority — release
  notes stay static in their era's dominant language).
- Date/number formatting currently uses hardcoded locale strings — future
  release can route through `Intl.DateTimeFormat(currentLocale)`.
- Pluralization keys (e.g., `"{{n}} update(s)"`) use formulaic `_one/_other`
  patterns in pt-BR; full i18next plural rules would be a cleanup task.

---

## [5.5.1] — 2026-04-21

### 🔓 Runtime Admin Toggle

Admin mode passa a ser alternável em runtime — qualquer usuário do release pode
ativar sem recompilar. Tokens continuam local-only; admin UI só edita `localStorage`.

### Added

- **Runtime admin toggle** — atalho global `⌘⇧A` (ou `Ctrl+Shift+A`) alterna
  o admin mode; estado persistido em `localStorage['ai-launcher:admin-mode']`.
- **URL param override** — `?admin=1` / `?admin=0` na URL liga/desliga e persiste.
- **Toast feedback** — ao alternar, toast confirma `Admin mode ON/OFF`.
- **HelpModal** — entrada `⌘⇧A — Alternar admin mode (runtime)` adicionada.

### Changed

- `isAdminMode()` agora lê de três fontes em ordem de precedência:
  1. Build flag `VITE_ADMIN_MODE=1` (vence sempre — admin-full build)
  2. URL query `?admin=1|0` (persiste em localStorage)
  3. `localStorage['ai-launcher:admin-mode'] === '1'`
- `App.tsx` — `adminMode` agora é `useState` reativo em vez de constante de render.

### Notes

- Release binários publicados desta versão (`.msi`/`.exe`) permitem ativar admin
  sem rebuild. Build local com `VITE_ADMIN_MODE=1` continua funcionando como
  "admin-full" (não pode ser desligado via toggle).
- Schema de localStorage inalterado (nova chave é aditiva).

---

## [5.5.0] — 2026-04-21

### 🖥️ "Terminal Dramático" — redesign visual completo para estética terminal-native

Redesign visual completo de brand-centric para terminal-native. Tipografia mono,
abas com prefixo de prompt, histórico estilo git-log, sparklines de custo,
command palette atualizada e navegação keyboard-first. **Zero migrações de schema.**

### Added

- **HeaderBar** — header sticky terminal-themed com wordmark mono, dot de provider,
  keycaps `⌘⇧1-4` nas abas primárias, badge de update preservado.
- **LauncherTab cards** — redesenhados como painéis de terminal: prompt `>`, ícone,
  nome em uppercase, versão, dot de status, descrição, botões Launch + Docs.
- **HistoryTab timeline** — estilo git-log com rail vertical tracejado + marcadores `●`,
  linhas `CLI @ provider`, re-run e copy args inline, multi-select de CLIs + filtros
  de provider.
- **CostsTab hero + sparklines** — valor grande do total de hoje, barra de progresso
  do orçamento, sparkline 7 dias por CLI.
- **CommandPalette preview pane** — pane lateral de preview do comando selecionado,
  seções pinned/recent/all, ícones lucide, footer com keycaps.
- **AppearanceSection** — font picker (JetBrains Mono, IBM Plex, Cascadia, Berkeley,
  System) com preview ao vivo + restore no boot.
- **StatusBar** — footer com versão, provider, aba ativa, link de update disponível
  via GitHub (cache de 6h).
- **HelpModal** — atalho global `⌘/` abre cheatsheet de shortcuts.
- **Onboarding** — fluxo de 4 passos terminal-themed (welcome / detect / provider /
  launch) com progress dots.
- **EmptyState illustrations** — 3 variantes SVG inline (history / presets / cli)
  com prop `variant`.
- **Skeleton variants** — `SkeletonCliCard`, `SkeletonHistoryRow`, `SkeletonCostBar`.
- **Sparkline** — novo componente SVG inline zero-dep em `src/shared/`.
- **KeyCap** — componente compartilhado usado em HeaderBar/HelpModal/CommandPalette/etc.
- **TerminalFrame + PromptLine** — surfaces terminais compartilhados.
- **Motion** — page-enter + staggered children no troca de aba, respeita
  `prefers-reduced-motion`.
- **Config export/import** — seção Admin → Backup, dump JSON com secrets redacted.
- **Comando Rust `check_latest_release`** — consulta GitHub Releases API via `ureq`.
- **Brand color tokens** — `--color-brand-anthropic/zai/minimax` adicionados nos
  dois temas (dark + light).

### Changed

- **Vite 5 → 8, React 18 → 19** — upgrade das foundations.
- **Tipografia** — JetBrains Mono self-hosted (4 weights subset-latin woff2, ~87 KB
  total), sem CDN de fontes externas.
- **Ícones** — migração de emoji inline para `lucide-react` (37 exports curados em
  `src/icons/index.ts`).
- **Tokens** — split em `tokens.css` (compartilhados), `tokens-dark.css`, `tokens-light.css`.
- **Split de tabs** — extraídos `LauncherTab`, `HistoryTab`, `CostsTab`, `AdminTab`,
  `HeaderBar` do `App.tsx` (1754 → 1552 linhas).
- **Tab shortcuts** — `Ctrl+Shift+1-4` troca de aba; handler de preset `Ctrl+1-9`
  preservado.

### Fixed

- Tipagem do prop `activeTab` apertada de `string` para `HeaderTabId` (safety em
  compile-time).
- Keyboard guards agora cobrem `HTMLSelectElement` e elementos `contenteditable`.
- Feedback de clipboard no copy args do histórico (estado visível `copied!` / `failed`).
- Keys React estáveis em entries de histórico (`timestamp|cliKey|directory`).
- Rings `focus-visible` em abas, chip de provider, chips de filtro, botões de ação.
- Semântica `aria-current` corrigida em tabs de navegação.
- Accent colors de provider usam tokens `--color-brand-*` (consistente dark + light).

### Docs

- Visual system docs — design tokens, paleta, tipografia, referência de motion; arquivo histórico removido da árvore pública atual.
- `docs/ARCHITECTURE.md` — stack, mapa de diretórios, data flow, comandos Rust,
  chaves de localStorage.
- `CONTRIBUTING.md` — setup, build modes, convenções, processo de PR.
- `README.md` — reescrito para v5.5.

### Guardrails

- JS bundle gzip: **~113 KB** (budget 300 KB).
- CSS bundle gzip: ~21 KB.
- `npx tsc --noEmit`: clean.
- `cargo clippy -- -D warnings`: clean.
- Schema do localStorage: inalterado (zero migrações).
- Zero secrets no diff.

### Notes

- **Não quebra nada da v5.1.** Perfis, presets, históricos e budgets salvos em
  `localStorage` continuam funcionando identicamente.
- Plano executável desta release foi preservado no histórico Git, mas removido da árvore pública atual na limpeza de docs.

---

## [5.1.0] — 2026-04-20

### 🎨 "Terminal Refinado" — fix MiniMax + refatoração visual completa

Release consolidada: remove **todas** as causas do `Auth conflict` / `Failed to fetch`
do MiniMax (diagnóstico revelou 3 bugs independentes no launcher, não só um),
substitui a paleta `#8B1E2A` vermelho-vinho por tokens `oklch` com accent
esmeralda perceptivamente uniforme, e adiciona a primeira camada responsiva do app.

### Fixed

#### MiniMax `Auth conflict` — causa raiz real (nunca era só envs herdadas)
- **Injeção dupla de chave em `storage.ts:buildLaunchEnv`** — o launcher setava
  `ANTHROPIC_AUTH_TOKEN` E `ANTHROPIC_API_KEY` com o mesmo valor. Claude Code
  detectava os dois e emitia o erro. Agora injeta só `AUTH_TOKEN` (padrão da spec).
- **Defense-in-depth em `launch_cli` (`main.rs:1680`)** — script PowerShell agora
  limpa `ANTHROPIC_*`, `CLAUDE_CODE_*` e `API_TIMEOUT_MS` herdados do shell pai
  **antes** de injetar os novos valores. Recomendação oficial da MiniMax
  ("Clear the following Anthropic-related environment variables to avoid conflicts").

#### MiniMax `Failed to fetch` no teste de conexão
- **`testConnection.ts` era bloqueado por CORS no webview do Tauri** (origin
  `tauri://localhost` contra `api.minimax.io` que não retorna
  `Access-Control-Allow-Origin`). Movido para comando Rust
  `test_provider_connection` (via `ureq`) — backend faz a chamada direta, sem
  política CORS. Mensagens de erro agora são específicas por status (401/403/404/429).

#### Envs oficiais Anthropic-compatible faltando
- `buildLaunchEnv` agora injeta, para qualquer provider ≠ anthropic:
  `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`,
  `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `API_TIMEOUT_MS=3000000`,
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. Sem esses, Claude Code tentava
  resolver aliases que não existem nos endpoints de terceiros.

### Added

- **Botão "🧹 Reset Claude state"** no Admin Panel — comando Rust `reset_claude_state`
  limpa `customApiKeyResponses`, `oauthAccount` e `model` custom do
  `~/.claude.json` (faz backup em `.claude.json.bak` antes). Útil quando o CLI
  fica "travado" em provider antigo.
- **`src/styles/tokens.css`** — fonte única de verdade para cores/spacing/typography/
  radius/motion/shadows. Paleta oklch com accent esmeralda (substitui vermelho-vinho
  `#8B1E2A` que conflitava com verdes de status). Aliases legados mapeados pra
  não quebrar nenhum selector existente.
- **Primeira camada responsiva** — media queries `@max-width:1100px` e `@max-width:720px`
  em `providers.css` (o app tinha ZERO media queries até agora). Grid admin colapsa,
  modais ocupam 95vw, header empilha.
- **Monogramas SVG (`PresetIcon.tsx`)** — 12 ícones vetoriais substituem os emojis
  do `PresetsBar`. Rendering consistente entre Win10/11/Linux/macOS. Backward-compat
  via `LEGACY_EMOJI_MAP` (presets antigos com emoji continuam funcionando).
- **Reduced motion** — `tokens.css` zera durations quando `prefers-reduced-motion:reduce`
  (WCAG 2.3.3).

### Changed

- **Base tipográfica 12px → 13px** (body). Escala completa em tokens
  (`--fs-xs` 11px até `--fs-3xl` 32px). Abolidos valores <11px. Section titles
  recebem `text-transform: uppercase` + `letter-spacing: 0.08em`.
- **Providers.css tokenizado** — todas as cores `#8B1E2A`, `#4285F4`, `#4ade80`,
  `#ffa500`, `#ff8a80`, e `rgba(...)` de brands substituídas por
  `color-mix(in oklch, var(--color-*) X%, transparent)`. Radius consistente
  (`--radius-sm/md/lg/full`), spacing em grade 4px.
- **CommandPalette harmonizado** — mesmos tokens, mesmos radius, mesma accent.
  Hover/selected usam `color-mix` oklch.
- **Selected state do `.preset-emoji`** — borda 2px + bg 20% + accent, em vez do
  fill opaco que destoava dos cards não selecionados.

### Accessibility

- `aria-label` adicionado em botões icon-only: refresh CLIs, theme toggle,
  delete profile, remove env var, fechar preview.
- `role="radiogroup"` + `role="radio"` + `aria-checked` no seletor de ícones de preset.

### Notes

- **Zero breaking.** Perfis salvos em `localStorage` pela v5.0/v5.0.1 continuam
  funcionando identicamente (schema inalterado). Presets com emoji legado
  renderizam via fallback SVG.
- Cargo.lock bump automático 5.0.1 → 5.1.0.
- Plano executável desta release foi removido do repositório público na limpeza de documentação histórica.

---

## [5.0.1] — 2026-04-20

### 🔧 Hotfix: MiniMax provider (URL + model)

O provider MiniMax pré-cadastrado vinha com endpoint e modelo desatualizados,
resultando em falha 100% das tentativas de uso. Corrigido para o formato atual
da documentação oficial.

### Fixed

- **MiniMax baseUrl**: `api.minimaxi.chat/v1/anthropic` ❌ → `api.minimax.io/anthropic` ✅
  (endpoint Anthropic-compatible internacional).
- **MiniMax model**: `MiniMax-M2` ❌ → `MiniMax-M2.7` ✅ em `seeds.ts` (main + fast)
  e `modelCatalog.ts` (primeiro da lista; `MiniMax-M2` mantido como fallback).
- **Nota do seed MiniMax**: agora inclui instrução para trocar p/ `api.minimaxi.com/anthropic`
  em contas chinesas, e link direto para a doc oficial.

### Docs

- README/FAQ: seção sobre regiões (Internacional vs China) do MiniMax.

### Notes

- Nenhuma mudança de API, dados ou schema. Usuários da v5.0.0 podem atualizar
  sem perda de configuração (perfis custom permanecem no `localStorage`).
- Após instalar, entre no **Admin Panel** e, se você tinha um perfil MiniMax
  customizado, atualize manualmente. Os **seeds built-in** já vêm corrigidos.

---

## [5.0.0] — 2026-04-20

### 🎉 Major: Alternative Providers & Launch Presets

Claude Code agora pode ser lançado apontando para providers Anthropic-compatible
alternativos (Z.AI / GLM, MiniMax) com um clique. Opt-in via flag
`VITE_ADMIN_MODE=1` em `.env.local` — sem afetar o fluxo padrão.

### Added

#### Provider system (opt-in, admin mode)
- **Admin Panel** (`⚙️ Admin`) — CRUD completo de perfis Anthropic-compatible
  com teste de conexão, editor de env vars extras, import/export JSON.
- **Seeds pré-cadastrados**: Anthropic (oficial), Z.AI (`glm-5.1` / `glm-4.7`),
  MiniMax (`MiniMax-M2`).
- **Provider Selector** na aba Lançar — dropdown + aviso de context cap quando
  o provider ativo tem janela menor que Anthropic.
- **Provider Badge** no header mostrando provider ativo + modelo principal.
- **Override de modelo por launch** — sobrescreve main/fast só pra próxima
  execução sem editar perfil.
- **Test de conexão** com `max_tokens:1` (zero custo) + latência + eco do modelo.
- **Env vars custom por perfil** — campos livres adicionados às envs do launch.
- **Autocomplete de modelos por kind** (`<datalist>`): glm-\*, MiniMax-\*,
  claude-\*.
- **Estimador de custo** por sessão típica + comparativo vs. Anthropic.
- **Budget diário** por perfil com alerta quando gasto do dia ultrapassa.
- **Docs link** por perfil abre documentação oficial do provider.

#### Launch presets
- **Presets bar** na aba Lançar — salva combinação atual (CLI + provider +
  diretório + args + noPerms) como chip clicável.
- **Atalhos Ctrl+1..9** para disparar presets diretamente.
- Renomear, excluir e reordenar presets inline.

#### Quick-switch
- **Ctrl+P** abre modal de busca de provider (setas + Enter para ativar).
- **Submenu "Provider Claude" no tray** com radio pros 3 built-ins
  (Anthropic / Z.AI / MiniMax).

#### Preview & observabilidade
- **🔬 Preview button** no Lançar — mostra CMD + envs (redacted) + copia
  script `.bat` equivalente.
- **Histórico enriquecido** — cada launch grava o provider usado (`via Z.AI ·
  glm-5.1`).
- **Cost Aggregator provider-aware** — reestima custos usando preços do Admin
  quando o modelo não é reconhecido pela tabela padrão.

#### Backend (Rust)
- `open_external_url` command com validação http(s) only.
- Submenu `Provider Claude` no tray + evento `tray-set-provider`.

### Privacy & security
- Admin mode é 100% opt-in (`VITE_ADMIN_MODE=1` em `.env.local` ignorado pelo
  git). Sem a flag, o app se comporta como na v4.
- Chaves API ficam no `localStorage` (plain text, escopo local) e são
  redacted em todos os toasts/logs da UI.
- `.env.local`, `.env.*` (exceto `.env.example`) permanecem no `.gitignore`.

### Notes
- **Não quebra nada da v4**: usuários sem admin mode continuam com o app
  exatamente como antes.
- Changelog v4.1.0 preservado abaixo.

---

## [4.1.0] — 2026-04-17

First public release.
