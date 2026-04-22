# AI Launcher v10 — Command Deck

**Date:** 2026-04-22
**Status:** Approved (brainstorming phase complete)
**Scope:** Full visual rewrite of the frontend layer; preserve Rust backend and persistence contracts.

---

## 1. Context

AI Launcher Pro is a Tauri v2 desktop app (React 19 + TypeScript) that manages AI coding CLIs (Claude Code, Codex, Gemini, Qwen, Aider, Copilot, MiniMax, etc.) and IDEs (VSCode, Cursor, Windsurf, JetBrains AI). Through v9.1, the visual layer was iterated piecemeal — from a colorful "Friendly Dashboard" (v8) to a "Soft Workbench" (v9/9.1) — and the end result lacks coherence, hierarchy, and a point of view.

v10 abandons the current design completely. The frontend is rewritten from scratch on top of the stable Rust backend and persistence layer. Features do not change. The app becomes opinionated, disciplined, and single-minded about its identity: a serious command deck for developers who run AI CLIs all day.

## 2. Goals

- Ship a single, consistent visual language across every surface (onboarding, launcher, tools, history, costs, admin, help, modals, empty states, errors).
- Functional theme selector (dark / light) and accent color selector (5 options).
- Restore the Tools tab (IDE management surface) that was hidden since v3.2.6. The Rust backend for it (`get_all_tools`, `ToolInfo`) already exists.
- Unify admin: remove the non-admin mode entirely. One build, always full access.
- Replace the current icon set with a coherent system: official logos where available, line-style custom SVGs where not.
- Cut a clean v10.0.0 release: bumped version, new changelog, rewritten bilingual README with an ASCII terminal banner, local Windows build, GitHub release with artifacts.

## 3. Non-goals

- New product features or behaviors. Every existing feature is preserved.
- Changes to the Rust command surface (`invoke` contracts).
- i18n framework changes. Existing translations are preserved and extended.
- Code signing, `winget` publishing, or store submission. These can be follow-up issues.
- Migration shims for the v9 UI. There is no dual-render path. The v9 components are deleted.

## 4. Visual direction (decided via brainstorm)

| Decision | Choice |
|---|---|
| Style | **Command Deck** — dark-first, monoespaced UI chrome, vermelho LED como accent, bordas afiadas, vibe de cockpit de dev. |
| Navigation | **Left sidebar** fixa (~175 px) com seções agrupadas (Workspace / System / Support). ⌘K palette fica como atalho, não como navegação principal. |
| Accent palette | **Core 5**: red (default) + amber + green + blue + violet. User-switchable, persisted. |
| Light theme | **Hard Light** — papel branco puro, bordas 1 px pretas, vermelho LED mantém o DNA do dark. Sem variante "soft". |
| Typography | **JetBrains Mono** (chrome, dígitos, código, navegação) + **Inter** (prose, descrições longas, onboarding). Ambas open-source. |
| Icons | Oficiais onde disponíveis (Anthropic / OpenAI / Google / Alibaba / GitHub / Aider / MiniMax / VSCode / Cursor / Windsurf / JetBrains). Line-style 1.5 px monocromático custom para o restante, com glow do accent em hover. |

## 5. Information architecture

### 5.1 Tabs (sidebar)

```
WORKSPACE
  Launch        ⌘1     — grid de CLIs detectadas (primary surface)
  Tools         ⌘2     — grid de IDEs detectados (restored)
  History       ⌘3     — launches passados
  Costs         ⌘4     — gastos por provedor, orçamento diário

SYSTEM
  Admin         ⌘,     — providers, presets, appearance, overrides, custom IDEs
  (Admin contém: Providers / Presets / Appearance / CLI Overrides / Custom IDEs como sub-seções)

SUPPORT
  Help          ?      — docs curtas + links
```

### 5.2 Chrome persistente

- **Sidebar** (esquerda, fixa): brand mark, grupos de nav, chip `● ADMIN`, versão
- **Top bar** (slim, acima da main): busca ⌘K inline + theme switcher + accent switcher
- **Status bar** (base, fina): `5/8 online · ADMIN · $0.42 today · v10.0.0`

### 5.3 Modais

Todos reescritos: CommandPalette (⌘K), QuickSwitchModal, DryRunModal, CustomIdeModal, CliOverrideModal, HelpModal, Onboarding.

## 6. Architecture — folder layout

Reescrita completa. Organização por feature, não por tipo. Arquivos focados (<200 linhas típico, limite duro 400).

```
src/
├── app/
│   ├── App.tsx                 # root composition
│   ├── main.tsx                # bootstrap + theme init
│   └── layout/
│       ├── Sidebar.tsx
│       ├── TopBar.tsx
│       └── StatusBar.tsx
├── features/
│   ├── onboarding/             # first-run flow
│   ├── launcher/               # CLIs grid + launch flow
│   ├── tools/                  # IDEs grid (restored)
│   ├── history/
│   ├── costs/
│   ├── admin/
│   │   ├── AdminPage.tsx       # tab shell + sub-nav
│   │   ├── providers/
│   │   ├── presets/
│   │   ├── appearance/         # theme/accent/font pickers
│   │   ├── cli-overrides/
│   │   └── custom-ides/
│   └── help/
├── ui/                         # primitives, zero feature knowledge
│   ├── Button.tsx
│   ├── Chip.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Dialog.tsx
│   ├── Toggle.tsx
│   ├── Tooltip.tsx
│   ├── Skeleton.tsx
│   ├── Banner.tsx
│   └── CommandPalette.tsx
├── icons/
│   ├── cli/                    # official SVGs per-CLI
│   ├── tool/                   # official SVGs per-IDE
│   ├── ui/                     # line-style custom icons
│   └── registry.ts             # id → SVG URL/component
├── theme/
│   ├── tokens.css              # single source of truth for CSS custom properties
│   ├── theme-dark.css
│   ├── theme-light.css
│   ├── accents.css             # 5 accent palettes via [data-accent]
│   └── fonts.css               # JetBrains Mono + Inter @font-face
├── lib/                        # preserved: providers/, presets/, customIdes, clisOverrides, appSettings, appearance
├── i18n/                       # preserved + new strings for v10 chrome
└── hooks/
    ├── useTheme.ts
    ├── useAccent.ts
    ├── useTauriEvent.ts
    └── useDebounce.ts
```

**Preserved from v9 (data / logic / contracts):**
- Everything under `src-tauri/` (Rust backend).
- `src/lib/` — full folder: `providers/*`, `presets/`, `customIdes.ts`, `clisOverrides.ts`, `appSettings.ts`, `appearance.ts`, `iconRegistry.ts`, budget helpers.
- `src/i18n/` (locales + loader). New strings added for v10 chrome, nothing removed without replacement.
- `src/presets/storage.ts`, `src/presets/types.ts`.
- `src/providers/storage.ts`, `src/providers/types.ts`, `src/providers/budget.ts`.
- The `FontId` type and `applyFontStack` helper currently living in `src/providers/AppearanceSection.tsx` — **migrate them** to `src/lib/appearance.ts` (pure logic, no JSX) before deleting the component.

**Deleted from v9 (visual layer only):**
- Every `.tsx` and `.css` under `src/tabs/*`, `src/layout/*`.
- Root-level visual components: `Orchestrator.*`, `CommandPalette.*`, `EmptyState.*`, `Onboarding.*`, `Skeleton.*`, `ErrorBoundary.*`, `CostAggregator.*`.
- `src/styles/*` (tokens, motion, fonts — replaced by `src/theme/*`).
- All `.tsx` UI wrappers under `src/providers/` (`AppearanceSection.tsx`, `QuickSwitchModal.tsx`, `DryRunModal.tsx`, `CustomIdeModal.tsx`, `CliOverrideModal.tsx`). The non-`.tsx` files in the same folder are preserved.

## 7. Design tokens — single source of truth

`src/theme/tokens.css` holds every visible value. Zero hardcoded hex/px in components.

```css
:root {
  --bg: #0a0a0b;
  --surface-1: #0d0d0f;
  --surface-2: #111114;
  --border: #1a1a1d;
  --border-strong: #2a2a2d;

  --text: #e6e6e8;
  --text-muted: #9a9aa3;
  --text-dim: #6b6b74;

  --accent: #ff3131;
  --accent-glow: rgba(255,49,49,.4);
  --accent-ink: #0a0a0b;

  --ok: var(--accent);
  --warn: #ff9f1c;
  --err: #ff3131;

  --font-mono: "JetBrains Mono", Menlo, ui-monospace, monospace;
  --font-sans: "Inter", "Segoe UI", system-ui, sans-serif;

  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px;

  --r-sm: 3px; --r-md: 5px; --r-lg: 8px;

  --dur-fast: 120ms; --dur: 200ms; --dur-slow: 400ms;
  --ease: cubic-bezier(.2,.8,.2,1);
}

[data-theme="light"] {
  --bg: #ffffff;
  --surface-1: #ffffff;
  --surface-2: #ffffff;
  --border: #1a1a1a;
  --border-strong: #1a1a1a;
  --text: #1a1a1a;
  --text-muted: #555555;
  --text-dim: #888888;
  --accent-ink: #ffffff;
}

[data-accent="amber"]  { --accent: #ff9f1c; --accent-glow: rgba(255,159,28,.4); }
[data-accent="green"]  { --accent: #35d07f; --accent-glow: rgba(53,208,127,.4); }
[data-accent="blue"]   { --accent: #4ea1ff; --accent-glow: rgba(78,161,255,.4); }
[data-accent="violet"] { --accent: #b982ff; --accent-glow: rgba(185,130,255,.4); }
```

Theme and accent are applied by toggling attributes on `<html>`. Zero JS re-render required — the browser's CSS engine handles the flip. State persisted in `localStorage` under keys `ai-launcher:theme` and `ai-launcher:accent`, restored on boot before first paint (inlined in `index.html` to prevent FOUC).

## 8. Components — primitives (`src/ui/`)

Every primitive: TypeScript, named export, typed props, accessibility-first. No feature imports.

| Component | Variants / key props | Notes |
|---|---|---|
| `Button` | `variant: primary \| ghost \| danger`, `size: sm \| md \| lg`, `icon?` | `aria-busy` when loading. Mono label. |
| `Chip` | `variant: online \| offline \| missing \| update \| admin \| neutral`, `size: sm \| md` | LED-dot prefix for status. |
| `Card` | `interactive?`, `as: div \| button` | Borda 1px, radius `--r-md`, hover glow do accent. |
| `Input` | `type`, `prefix?`, `suffix?`, `monospace: true default` | Focus ring é `--accent-glow`. |
| `Dialog` | `open`, `onClose`, `title`, `size: sm \| md \| lg` | Backdrop blur 8px, focus trap, esc to close. |
| `Toggle` | `checked`, `onChange`, `label` | Visual mono, track afiado. |
| `Tooltip` | `content`, `side: top\|bottom\|left\|right` | Caps mono, delay 400ms. |
| `Skeleton` | `width`, `height`, `variant: line \| card` | Shimmer respeita `prefers-reduced-motion`. |
| `Banner` | `variant: info \| warn \| err \| admin` | Inline nas telas; admin banner é fixo na StatusBar. |
| `CommandPalette` | wraps `cmdk`; surfaces: launch, navigate, theme/accent, providers, presets | Keyboard-first, fuzzy match. |

## 9. Icons — pipeline

1. **Official logos:** fetch SVG from each vendor's brand page or official repo. Normalize to 24×24 viewBox. Preserve official colors in dark mode; in light mode, dark backgrounds of some logos get a 1px outline to stay visible.
2. **License check:** verify each vendor allows usage. If restricted (unusual for a dev launcher), fall back to line-style custom.
3. **Line-style custom (`icons/cli/*.svg`, `icons/tool/*.svg`):** 24×24, stroke 1.5 px, stroke-current, no fill. Sharp rectangles, straight lines, no organic curves — coherent with Command Deck.
4. **UI icons (`icons/ui/*.svg`):** Lucide (already installed) for the common set + custom line-style for app-specific glyphs.
5. **Registry:** `icons/registry.ts` exports `getCliIcon(key)`, `getToolIcon(key)`, `getUiIcon(id)` returning React components or SVG URLs. Single lookup point.

Existing icon files under `public/icons/cli` and `public/icons/tool` are replaced 1:1.

## 10. Theming & accents — runtime behavior

- Boot sequence (`main.tsx`): read `localStorage["ai-launcher:theme"]` and `localStorage["ai-launcher:accent"]`, set `document.documentElement.dataset.theme` / `.dataset.accent` **before** React mounts.
- `index.html` inlines a synchronous script that applies the saved theme+accent before stylesheet parse, preventing flash.
- Admin appearance panel offers:
  - Theme selector: `dark` / `light` (radio with preview swatches)
  - Accent selector: 5 color buttons (red/amber/green/blue/violet)
  - Font selector: reuse the `FontId` values + `applyFontStack` helper (migrated to `src/lib/appearance.ts`), with Mono / Sans / Mixed options rendered in the new design
- Changes are applied instantly (attribute flip), saved to `localStorage`, mirrored to `appSettings` for future exports.

## 11. Admin unification

- Remove `appSettings.adminMode` boolean. All guards `if (admin)` in the frontend are deleted — features are always available.
- Backend launch defaults set `--dangerously-skip-permissions` as the default launch flag (was conditional on admin toggle). This aligns with "admin always on".
- Sidebar shows a persistent `● ADMIN · full access` chip as an identity marker, not a toggle.
- Onboarding step one acknowledges the admin posture in plain language: "This launcher runs with full system access — keep your credentials secure."

## 12. Release plan (v10.0.0)

Each step is a discrete deliverable; `writing-plans` will sequence them.

1. `package.json` and `src-tauri/tauri.conf.json` → `10.0.0`.
2. `CHANGELOG.md` new section **[10.0.0] — 2026-04-22 — Command Deck** listing:
   - Complete frontend rewrite
   - Command Deck visual direction
   - Functional dark/light theme + 5-accent selector
   - Tools tab restored
   - Admin mode unified
   - New icon set
   - Rewritten bilingual README with ASCII banner
3. `README.md` and `README.pt-BR.md`:
   - ASCII terminal banner (Command Deck themed, with vermelho LED elements)
   - New hero SVG screenshot
   - "What's new in v10" section
   - Install / usage / customize sections refreshed
   - Screenshots gallery (4 SVG mockups editoriais + 3 real PNGs from built app)
4. Local build: `npm run tauri build` (Windows `.msi`), smoke test launch.
5. Commit `feat(v10.0.0): command deck visual rewrite`.
6. Tag `v10.0.0`, push, `gh release create v10.0.0 --notes-file CHANGELOG-v10.md --discussion-category releases` attaching the `.msi`.
7. Fix any stale git state: `gh pr list --state open` currently empty (verified), so there is nothing pending to close. If dependabot re-opens PRs between now and release, triage them — do not merge anything that conflicts with the rewrite.

## 13. Testing & quality gates

- `tsc --noEmit` zero errors.
- `npm run build` zero warnings.
- Manual smoke-test checklist:
  - App boots in dark mode with red accent (defaults).
  - Switch to light mode — all surfaces legible, Hard Light palette applies cleanly.
  - Switch accent to amber / green / blue / violet — all status chips, focus rings, and LED dots update.
  - Onboarding flow completes.
  - Launcher: detect a CLI, launch it (dry-run), see entry in History, cost registered in Costs.
  - Tools: detect VSCode/Cursor/Windsurf if installed.
  - Admin: edit a provider, save, persisted across reload.
  - ⌘K palette: navigate to each tab, run a launch.
  - All modals open, close, trap focus, respect esc.
- Optional Playwright smoke: boot → toggle theme → toggle accent → open Launcher → open Admin. Non-blocking if environment flakes.

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Icon licensing — some vendors restrict logo use | Verify per vendor; fall back to line-style custom when restricted; note attribution in `docs/icons-attribution.md`. |
| Font bundling size (JetBrains Mono + Inter) | Subset to Latin + Latin-Ext; ship only 400 + 700 weights per family. Target total font payload < 200 KB. |
| Preserving `localStorage` user data across the rewrite | `appSettings`, providers, presets, customIdes, clisOverrides all keep the same keys and shapes. Smoke-test with a populated v9.1 localStorage snapshot. |
| Windows `.msi` build regression | Run `tauri build` once on a clean checkout before tagging the release. |
| Hard Light causing eye strain in long sessions | User can switch to dark mode in one click (selector is always accessible in TopBar). Light is opt-in, dark is default. |

## 15. Out of scope

- Adding or renaming product features.
- Introducing a state management library (React state + localStorage suffices).
- Migrating away from `cmdk` for the palette.
- Rewriting the Rust command layer.
- Code signing, `winget` / Chocolatey publishing, auto-update channels.

## 16. Deliverables checklist

- [ ] All files under `src/` (except `lib/`, `i18n/`, `presets/`, `providers/storage|types|budget.ts`) rewritten.
- [ ] `src/theme/tokens.css` is the only source of visible values.
- [ ] Dark + Light themes both fully usable.
- [ ] 5 accent colors switchable at runtime.
- [ ] Tools tab restored and wired to `get_all_tools`.
- [ ] Admin mode is unconditional; non-admin paths removed.
- [ ] All 14+ CLI/IDE icons replaced per icon pipeline.
- [ ] Version `10.0.0` in both manifests.
- [ ] CHANGELOG v10.0.0 entry written.
- [ ] README.md and README.pt-BR.md rewritten with ASCII banner and screenshots.
- [ ] Windows `.msi` built locally.
- [ ] `v10.0.0` tag + GitHub release published with `.msi` attached.

---

**Approval:** User confirmed brainstorm decisions on 2026-04-22. Ready for `writing-plans` once this document is reviewed.
