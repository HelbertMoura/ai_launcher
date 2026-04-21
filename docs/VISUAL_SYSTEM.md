# Visual System — AI Launcher Pro (v5.5 "Terminal Dramático")

> Reference for the v5.5 visual language. Every new surface should trace back to tokens
> defined in `src/styles/tokens.css`, `src/styles/tokens-dark.css`, `src/styles/tokens-light.css`
> and motion primitives in `src/styles/motion.css`. No hardcoded colors, no emoji chrome.

---

## 1. Philosophy

**Terminal Dramático** is the aesthetic direction of AI Launcher Pro from v5.5 onwards.
The product is a developer tool for operating AI CLIs, so the UI borrows from the terminals
it orchestrates rather than from generic SaaS dashboards.

Principles:

- **Mono-first typography.** `JetBrains Mono` is the default for UI copy, not just code.
- **Prompt `>` motifs.** Section titles, empty states, and CTAs lean on the prompt glyph
  instead of decorative iconography.
- **Dark-first, light as an intentional variant.** The dark palette is the product;
  the light theme exists for users who need it, not as a toggle-of-the-week.
- **Zero emoji in product chrome.** Any `>` / `$` / `|` glyph in the UI is a deliberate
  typographic choice, never an emoji fallback.
- **Opinionated motion.** Page transitions and staggered children are part of the brand;
  they are always neutralized under `prefers-reduced-motion`.

---

## 2. Color palette

Palette is expressed in `oklch()` for perceptual consistency. Dark tokens live in
`src/styles/tokens-dark.css` (applied to `:root` by default). Light overrides live in
`src/styles/tokens-light.css` (opt-in via `[data-theme="light"]`).

### Surfaces

| Token                 | Dark (default)                | Light                         | Role                                  |
| --------------------- | ----------------------------- | ----------------------------- | ------------------------------------- |
| `--color-bg-0`        | `oklch(14% 0.005 260)`        | `oklch(98% 0.002 260)`        | App background (outermost)            |
| `--color-bg-1`        | `oklch(18% 0.008 260)`        | `oklch(100% 0 0)`             | Panels, cards, raised surfaces        |
| `--color-bg-2`        | `oklch(23% 0.010 260)`        | `oklch(96% 0.003 260)`        | Inputs, inner slots, toolbars         |
| `--bg-terminal`       | `oklch(16% 0.008 250)`        | `oklch(98% 0.005 80)`         | Terminal pane body (v5.5 launcher)    |
| `--bg-surface-raised` | `oklch(20% 0.010 250)`        | `oklch(100% 0 0)`             | Title bar of terminal panes           |
| `--bg-prompt`         | `oklch(14% 0.006 250)`        | `oklch(96% 0.005 80)`         | Prompt / inline input slot            |

### Borders

| Token                   | Dark                    | Light                   | Role                                  |
| ----------------------- | ----------------------- | ----------------------- | ------------------------------------- |
| `--color-border`        | `oklch(30% 0.012 260)`  | `oklch(88% 0.005 260)`  | Default card/panel border             |
| `--color-border-strong` | `oklch(38% 0.015 260)`  | `oklch(78% 0.008 260)`  | Active/hover state, focus outlines    |
| `--border-dim`          | `oklch(25% 0.010 250)`  | `oklch(88% 0.005 80)`   | Terminal dim chrome                   |
| `--border-bright`       | `oklch(40% 0.020 180)`  | `oklch(70% 0.030 180)`  | Floating panels, command palette rim  |

### Text

| Token                 | Dark                    | Light                   | Role                       |
| --------------------- | ----------------------- | ----------------------- | -------------------------- |
| `--color-text`        | `oklch(96% 0.003 260)`  | `oklch(18% 0.010 260)`  | Primary                    |
| `--color-text-soft`   | `oklch(82% 0.005 260)`  | `oklch(34% 0.010 260)`  | Secondary body             |
| `--color-text-muted`  | `oklch(66% 0.010 260)`  | `oklch(52% 0.012 260)`  | Captions, meta             |
| `--color-text-dim`    | `oklch(50% 0.010 260)`  | `oklch(68% 0.010 260)`  | Placeholder, disabled      |
| `--text-prompt`       | `oklch(72% 0.150 160)`  | `oklch(35% 0.150 160)`  | Prompt `>` glyph           |

### Brand dots (provider chips)

| Token                     | Dark                    | Light                   | Provider    |
| ------------------------- | ----------------------- | ----------------------- | ----------- |
| `--color-brand-anthropic` | `oklch(68% 0.155 52)`   | `oklch(55% 0.155 52)`   | Anthropic   |
| `--color-brand-google`    | `oklch(68% 0.170 235)`  | (inherited)             | Google      |
| `--color-brand-zai`       | `oklch(70% 0.130 288)`  | `oklch(50% 0.130 288)`  | Z.AI        |
| `--color-brand-minimax`   | `oklch(68% 0.165 16)`   | `oklch(52% 0.165 16)`   | MiniMax     |

### Semantic

| Token              | Dark (default)          | Role             |
| ------------------ | ----------------------- | ---------------- |
| `--color-accent`   | `oklch(70% 0.155 162)`  | Primary action (emerald) |
| `--color-success`  | `oklch(72% 0.165 145)`  | OK / installed   |
| `--color-warn`     | `oklch(78% 0.150 85)`   | Warning          |
| `--color-danger`   | `oklch(65% 0.225 25)`   | Error / destructive |
| `--color-info`     | `oklch(68% 0.140 230)`  | Neutral info     |

Brand dots are the **only** hardcoded color usage allowed outside tokens — they identify
a provider unambiguously and must stay recognizable across themes.

---

## 3. Typography

### Family

`JetBrains Mono` is self-hosted via `src/styles/fonts.css` in four faces
(Regular 400, Medium 500, Bold 700, Italic 400), served as `woff2` with `font-display: swap`.
Fallback stack:

```
'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Consolas', monospace
```

UI-only surfaces (marketing, headers) may opt into the sans stack via `--ff-ui`
(`system-ui, -apple-system, 'Segoe UI', sans-serif`), but the default for body and chrome
is mono.

### Scale

```css
--fs-xs:   11px;   /* captions, dense meta */
--fs-sm:   12px;   /* secondary labels */
--fs-base: 13px;   /* body */
--fs-md:   14px;   /* default button/label */
--fs-lg:   16px;   /* section title */
--fs-xl:   20px;
--fs-2xl:  24px;
--fs-3xl:  32px;

--fs-display-sm: clamp(1.5rem, 1.3rem + 0.8vw, 2rem);
--fs-display-md: clamp(2rem,   1.5rem + 2vw,   3rem);
--fs-display-lg: clamp(2.5rem, 2rem + 3vw,     4.5rem);
--fs-display-xl: clamp(3rem,   2rem + 5vw,     6rem);
```

### Weights and line-heights

| Token          | Value | Use                           |
| -------------- | ----- | ----------------------------- |
| `--fw-regular` | 400   | Body                          |
| `--fw-medium`  | 500   | Labels, emphasized inline     |
| `--fw-semibold`| 600   | Section titles, tab labels    |
| `--fw-bold`    | 700   | Numeric display (CostsTab)    |
| `--lh-tight`   | 1.2   | Display, cards                |
| `--lh-base`    | 1.5   | Body                          |
| `--lh-loose`   | 1.65  | Long-form modals              |

### Tracking

| Token         | Value      | Use                              |
| ------------- | ---------- | -------------------------------- |
| `--ls-tight`  | `-0.01em`  | Display headings                 |
| `--ls-base`   | `0`        | Default                          |
| `--ls-wide`   | `0.02em`   | Buttons                          |
| `--ls-caps`   | `0.08em`   | Section titles in ALLCAPS        |

### Casing convention

- UI copy: **lowercase**, except brand wordmark ("AI Launcher Pro", provider names).
- Section titles: lowercase + wide tracking (`--ls-caps`) when ALLCAPS is applied.
- Never sentence-case headings.

---

## 4. Spacing and radii

4px grid. `--space-0` = 0, then `2/4/8/12/16/24/32/48/64` px:

```css
--space-1: 2px;   --space-2: 4px;   --space-3: 8px;   --space-4: 12px;
--space-5: 16px;  --space-6: 24px;  --space-7: 32px;  --space-8: 48px;  --space-9: 64px;
```

Radii:

| Token           | Value    | Use                               |
| --------------- | -------- | --------------------------------- |
| `--radius-xs`   | 2px      | Micro chips, KeyCap corners       |
| `--radius-sm`   | 4px      | Inputs, toolbar buttons           |
| `--radius-md`   | 6px      | Default cards, tab triggers       |
| `--radius-lg`   | 10px     | Terminal panes, modals            |
| `--radius-xl`   | 16px     | Hero surface (CostsTab)           |
| `--radius-full` | 9999px   | Brand dots, badges                |

---

## 5. Motion

Motion tokens (in `src/styles/tokens.css`):

```css
--ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
--ease-std:      cubic-bezier(0.4, 0, 0.2, 1);
--ease-in:       cubic-bezier(0.4, 0, 1, 1);
--ease-terminal: cubic-bezier(0.22, 1, 0.36, 1);

--d-instant:     80ms;
--d-fast:        120ms;   /* hover, focus */
--d-base:        180ms;   /* default transition */
--d-enter:       260ms;   /* element enter */
--d-modal:       320ms;
--d-tab-switch:  180ms;
--d-page-enter:  240ms;   /* tab content fade-up */
--d-stagger:     40ms;    /* per child */
```

Choreography (in `src/styles/motion.css`):

- `.tab-content` fades + translates 8px on mount (`page-enter` keyframe).
- Direct children stagger in with 4px translate, `--d-stagger` increments per index
  (up to 6 nth-child selectors).
- `--ease-terminal` is the signature easing for the v5.5 direction.

### Reduced motion

A `prefers-reduced-motion: reduce` media query in `tokens.css` zeros every `--d-*`
duration token; `motion.css` additionally sets `animation: none !important` on
`.tab-content` and its children. Any new motion must rely on these tokens to inherit
the policy — never hardcode `250ms ease-in-out` inline.

---

## 6. Iconography

Icons come from `lucide-react` via curated re-exports in `src/icons/index.ts`.
Current inventory (40 exports, tree-shaken):

```
Terminal, Play, Square, Settings, History, DollarSign, Package, RefreshCw,
Moon, Sun, Command, ChevronRight, Check, X, AlertCircle, AlertTriangle,
Download, Upload, Bell, Server, Key, Edit3, Trash2, Copy, ExternalLink,
FolderOpen, Plus, Minus, Search, Filter, ArrowUpRight, Zap, Clock, Eye,
EyeOff, HelpCircle, Type, CheckCircle2
```

Conventions:

- Stroke width **1.5** (`DEFAULT_STROKE_WIDTH` in `src/icons/types.ts`).
- Default sizes: **14** (dense lists, status bar), **16** (buttons), **18** (tab triggers).
- Never import directly from `lucide-react` in feature code — always go through
  `src/icons/index.ts` to preserve the audit surface.
- Icon-only controls **must** carry an `aria-label`.

---

## 7. Components catalog

| Surface              | File(s)                                                | Motif                                           |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| HeaderBar            | `src/layout/HeaderBar.{tsx,css}`                       | Wordmark + tab strip + prompt-style actions      |
| StatusBar            | `src/layout/StatusBar.{tsx,css}`                       | Footer: env status, active provider, hotkey hint |
| HelpModal            | `src/layout/HelpModal.{tsx,css}`                       | Keyboard shortcuts grid                         |
| LauncherTab          | `src/tabs/LauncherTab.{tsx,css}`                       | Terminal panes per CLI (v5.5 redesign)          |
| HistoryTab           | `src/tabs/HistoryTab.{tsx,css}`                        | Vertical timeline with provider badges          |
| CostsTab             | `src/tabs/CostsTab.tsx`                                | Hero number + sparkline + breakdown             |
| AdminTab             | `src/tabs/AdminTab.tsx`                                | Gated by `isAdminMode()`; provider CRUD         |
| CommandPalette       | `src/CommandPalette.{tsx,css}`                         | `cmdk` modal, Ctrl/Cmd+K                        |
| Onboarding           | `src/Onboarding.{tsx,css}`                             | 4-step first-run walkthrough                    |
| EmptyState           | `src/EmptyState.{tsx,css,illustrations.tsx}`           | Variants: no-history, no-costs, no-presets      |
| Skeleton             | `src/Skeleton.{tsx,css}`                               | Variants: line, block, card                     |
| PromptLine (shared)  | `src/shared/PromptLine.tsx`                            | `>` prefix for section headings                 |
| TerminalFrame        | `src/shared/TerminalFrame.tsx`                         | Chrome wrapper used by LauncherTab panes        |
| Sparkline            | `src/shared/Sparkline.tsx`                             | SVG inline chart for cost trend                 |
| KeyCap               | `src/shared/KeyCap.{tsx,module.css}`                   | `[ctrl][k]` style key glyphs                    |
| PresetsBar           | `src/presets/PresetsBar.tsx` + `PresetIcon.tsx`        | Favorited launch configs                        |
| ProviderBadge/Sel.   | `src/providers/{ProviderBadge,ProviderSelector}.tsx`   | Active-provider chip + switcher                 |
| QuickSwitchModal     | `src/providers/QuickSwitchModal.tsx`                   | Ctrl/Cmd+P provider switch                      |
| DryRunModal          | `src/providers/DryRunModal.tsx`                        | Preview of env injection before launch          |
| AppearanceSection    | `src/providers/AppearanceSection.{tsx,css}`            | Font swap + theme toggle                        |

---

## 8. Smoke test per surface

Every new surface must pass this checklist before merge. Split across responsive and
accessibility concerns — both are non-negotiable.

**Responsive**

- [ ] Mobile width 360 — no horizontal overflow, no clipped controls.
- [ ] Mobile width 720 — spacing still reads.
- [ ] Desktop width 1280+ — content does not stretch into awkward line lengths.

**Theme**

- [ ] `[data-theme="dark"]` (default): looks intentional, not an inverted light design.
- [ ] `[data-theme="light"]`: contrast ratios intact, brand dots still readable.
- [ ] No color literal outside tokens (grep the diff for `#`, `rgb(`, `oklch(`).

**Motion**

- [ ] Animations use `--d-*` tokens and `--ease-terminal`.
- [ ] `prefers-reduced-motion: reduce` (DevTools Rendering tab) disables all motion.

**Keyboard & focus**

- [ ] Tab order is linear and reaches every actionable element.
- [ ] `:focus-visible` shows `--ring` outline on every focusable.
- [ ] Every `<button>` has `type="button"` unless it is a real submit.
- [ ] Icon-only buttons carry an `aria-label`.

**Screen reader**

- [ ] Headings use a real `<h1>..<h4>` tier, not styled spans.
- [ ] Status changes announce via `aria-live` where relevant.
- [ ] Links and buttons are not interchangeable — `<a href>` for navigation,
      `<button>` for actions.
