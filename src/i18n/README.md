# i18n Key Catalog

react-i18next + i18next + browser-languagedetector setup for AI Launcher Pro.

## Locales

- `en` (fallback)
- `pt-BR` (source of truth for Portuguese; extracted verbatim from the codebase)

Detection order: `localStorage` > `navigator`. `pt*` detected languages are
normalized to `pt-BR`, anything else falls back to `en`. Selection is persisted
under `ai-launcher:locale`.

## Namespace / prefix map

Every key lives under the single `translation` namespace. Hierarchy per
component/feature:

| Prefix | Owner component(s) |
|--------|--------------------|
| `common.*`        | Generic labels reused across the app (`loading`, `cancel`, `default`, ...) |
| `header.*`        | `src/layout/HeaderBar.tsx` — tabs, brand, action buttons |
| `launcher.*`      | `src/tabs/LauncherTab.tsx` — CLI cards, directory/args, preview, empty state |
| `history.*`       | `src/tabs/HistoryTab.tsx` — filters, timeline, copy/re-run controls |
| `costs.*`         | `src/CostAggregator.tsx` (rendered via `src/tabs/CostsTab.tsx`) — hero stats, sections |
| `palette.*`       | `src/CommandPalette.tsx` — search input, groups, preview, footer, command labels |
| `statusbar.*`     | `src/layout/StatusBar.tsx` — tab indicator, update link |
| `helpModal.*`     | `src/layout/HelpModal.tsx` — keyboard shortcuts reference |
| `onboarding.*`    | `src/Onboarding.tsx` — four-step welcome tour |
| `admin.*`         | `src/providers/AdminPanel.tsx` — provider editor, reset, backup, toasts |
| `quickSwitch.*`   | `src/providers/QuickSwitchModal.tsx` — Ctrl+P switcher |
| `dryRun.*`        | `src/providers/DryRunModal.tsx` — launch preview modal |
| `appearance.*`    | `src/providers/AppearanceSection.tsx` — font picker |
| `empty.*`         | `src/EmptyState.tsx` (variant-based API) |
| `toasts.*`        | `src/App.tsx` — transient notifications (budget alerts, errors, confirmations) |
| `welcome.*`       | `src/App.tsx` welcome screen (first-run validation flow) |
| `installTab.*`    | `src/App.tsx` install tab content |
| `toolsTab.*`      | `src/App.tsx` tools tab content |
| `updatesTab.*`    | `src/App.tsx` updates tab content |
| `helpTab.*`       | `src/App.tsx` in-app help tab content |
| `footer.*`        | `src/App.tsx` footer signature |

## Interpolation contract

Keys that accept variables use double-curly placeholders (`{{name}}`). The most
common ones:

- `launcher.startCli` → `{{name}}`
- `launcher.startMulti` → `{{count}}`
- `launcher.removeEntry` → `{{name}}`
- `history.reRunLabel` / `history.copyArgsLabel` → `{{name}}`
- `helpModal.closeHint` → `{{key}}`
- `toasts.budgetExceeded` → `{{today}} / {{budget}} / {{name}}`
- `toasts.launchedWith` → `{{cli}} / {{provider}} / {{keys}}`
- `toasts.launchedPreset` → `{{emoji}} / {{name}}`
- `toasts.installed|updated|ready` → `{{name}}` or `{{key}}`
- `toasts.genericError|failed` → `{{error}}`
- `admin.form.editing` → `{{name}}`
- `admin.form.removeEnvLabel|deleteProfileLabel` → `{{key}}`/`{{name}}`
- `onboarding.launch.body` → `{{cmd}} {{k}}` (use Trans with `<1>`/`<2>` for `<kbd>` wrappers)
- `helpTab.currentVersion` → `{{version}}`
- `statusbar.tab` → `{{tab}}`
- `statusbar.updateAvailable` → `{{tag}}`
- `dryRun.noEnvs` → `{{cli}}`
- `installTab.logTitle` → `{{cli}}`
- `updatesTab.current|updateCliLabel|openDownloadLabel` → `{{version}}`/`{{cli}}`
- `toolsTab.lastCheck` → `{{time}}`
- `header.actions.activeProvider` → `{{name}}`

Pluralization: i18next supports `_one/_other` suffixes. Current catalogs use
formulaic text (e.g. `"atualização(ões)"`) — the refactor pass can split those
into proper plural keys if desired.

## Refactor checklist (for next agent)

Each component below must import `useTranslation` from `react-i18next` (or
`Trans` when rich elements are nested) and replace hardcoded strings with
`t('key.path')`. **None of these files were modified in this task** — only the
catalogs exist.

- [ ] `src/layout/HeaderBar.tsx` — keys: `header.tabs.*`, `header.actions.*`, `header.brand`, `header.nav`
- [ ] `src/layout/HelpModal.tsx` — keys: `helpModal.*`
- [ ] `src/layout/StatusBar.tsx` — keys: `statusbar.*`
- [ ] `src/tabs/LauncherTab.tsx` — keys: `launcher.*`, `common.loading`
- [ ] `src/tabs/HistoryTab.tsx` — keys: `history.*`
- [ ] `src/tabs/CostsTab.tsx` — thin wrapper; translation happens inside `CostAggregator`
- [ ] `src/tabs/AdminTab.tsx` — pass `t` down; thin wrapper over `AdminPanel`
- [ ] `src/CommandPalette.tsx` — keys: `palette.*`
- [ ] `src/EmptyState.tsx` — keys: `empty.history.*`, `empty.presets.*`, `empty.cli.*`, `launcher.emptyTitle/emptySub/emptyCta` (legacy branch)
- [ ] `src/Onboarding.tsx` — keys: `onboarding.*` (use `Trans` for the `<kbd>` pair in `onboarding.launch.body`)
- [ ] `src/CostAggregator.tsx` — keys: `costs.*`
- [ ] `src/App.tsx` — keys: `toasts.*`, `welcome.*`, `installTab.*`, `toolsTab.*`, `updatesTab.*`, `helpTab.*`, `footer.*`
- [ ] `src/providers/AdminPanel.tsx` — keys: `admin.*`
- [ ] `src/providers/AppearanceSection.tsx` — keys: `appearance.*` (or reuse `admin.appearance.*`)
- [ ] `src/providers/DryRunModal.tsx` — keys: `dryRun.*`
- [ ] `src/providers/QuickSwitchModal.tsx` — keys: `quickSwitch.*` (use `Trans` for the `hint` line with multiple `<kbd>`)
- [ ] `src/Orchestrator.tsx` — not audited in this task; likely needs a new `orchestrator.*` namespace when it gets strings

## Adding a new locale

1. Create `src/i18n/locales/<bcp47>.json` with the exact same key structure.
2. Extend `SUPPORTED_LOCALES`, `LOCALE_LABELS`, and the `convertDetectedLanguage`
   mapping in `src/i18n/index.ts`.
3. Import the JSON and register it under `resources` in the `init` call.

## Ambiguities and open questions

- A few UI toggles blend English + Portuguese (e.g. `"Admin mode ON — provider editing available"`).
  Keys are split so translators can localize both halves; current en/pt-BR
  values stay close to the original copy.
- Some strings mix prose with runtime code (e.g. the `confirmResetClaude`
  multi-line confirm in `AdminPanel.tsx`). Kept as single keys with `\n`
  separators — safe for `confirm()` dialogs.
- `helpTab.launchStep3` intentionally retains the literal forbidden-chars list
  inside prose; escaping is handled by React, no Trans needed.
- `onboarding.launch.body` and `quickSwitch.hint` contain markup (`<kbd>`),
  so the refactor pass must use `<Trans i18nKey="..." components={{...}} />`
  rather than plain `t(...)`.
- `palette.preview` / `palette.footer.*` deliberately match the existing
  terminal-style lowercase wording.
