# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **New banner SVG** (`public/images/banner.svg`) — terminal-themed 1200×300
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

- `docs/VISUAL_SYSTEM.md` — design tokens, paleta, tipografia, referência de motion.
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
- Plano executável desta release: `docs/superpowers/plans/2026-04-20-v5.5-terminal-dramatico-plan.md`.

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
- Plano executável desta release: `docs/PLAN_v5.1.md` (no repo).

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
