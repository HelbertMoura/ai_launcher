# AI Launcher v10 — Command Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the entire AI Launcher Pro frontend in the Command Deck visual direction (dark-first monoespaced UI, red LED accent, sharp borders), preserving all Rust backend contracts and persistence data, and ship v10.0.0.

**Architecture:** React 19 + TypeScript on Tauri v2. Fresh `src/` organized by feature (`features/*`), with a primitives layer (`ui/*`), design tokens in CSS custom properties (`theme/*`), an icon registry (`icons/*`), and preserved data/logic modules (`lib/*`, `i18n/*`, `src-tauri/*`). Themes and accents are applied by flipping `data-theme` / `data-accent` attributes on `<html>`, with persistence restored pre-paint via an inline boot script.

**Tech Stack:** Tauri 2, React 19, TypeScript 6, Vite 8, `cmdk` (command palette), `i18next`, Lucide icons, JetBrains Mono + Inter fonts, Playwright for smoke tests.

**Reference spec:** `docs/superpowers/specs/2026-04-22-v10-command-deck-design.md`

---

## Working agreements

- **Commit cadence:** Every task ends with a commit. Small commits are preferred.
- **Branch:** Work directly on `main` (this is a solo rewrite; no long-lived PR).
- **Verification gates between phases:**
  - `npx tsc --noEmit` returns zero errors.
  - `npm run build` completes with no warnings.
- **Manual smoke-test checkpoints:** after Phase 3, Phase 6, and before Phase 11 release.
- **UI tasks** don't follow strict RED-GREEN TDD because visual correctness can't be unit-tested reliably. Instead: (a) the type system + build are the continuous gates, (b) Playwright smoke tests guard the critical flows, (c) manual checkpoints verify look & feel.
- **Existing data preserved:** `localStorage` keys keep their names and shapes.
- Keep files focused: target <300 lines, hard ceiling 400.

---

## Phase map

| Phase | Purpose |
|---|---|
| 1 | Foundation — theme tokens, fonts, accent system, boot sequence |
| 2 | UI primitives (`src/ui/*`) |
| 3 | Layout shell (Sidebar, TopBar, StatusBar) + minimal `App.tsx` |
| 4 | Icon pipeline — fetch/regenerate all CLI/IDE icons, line-style custom set |
| 5 | Persistence helper migrations + icon registry rewrite |
| 6 | Feature pages — Onboarding, Launcher, Tools, History, Costs, Admin, Help |
| 7 | Modals rewrite — CommandPalette, QuickSwitch, DryRun, CustomIde, CliOverride, HelpModal |
| 8 | Admin unification — remove the `adminMode` state and guards |
| 9 | Delete v9 dead files |
| 10 | Quality gates — tsc, build, Playwright smoke |
| 11 | Documentation — README, CHANGELOG, ASCII banner, screenshots |
| 12 | Release — version bump, build, tag, GitHub release |

---

## Phase 1 — Foundation

### Task 1.1: Create theme token files

**Files:**
- Create: `src/theme/tokens.css`
- Create: `src/theme/theme-dark.css`
- Create: `src/theme/theme-light.css`
- Create: `src/theme/accents.css`
- Create: `src/theme/fonts.css`
- Create: `src/theme/index.css` (imports the others in order)

- [ ] **Step 1: Write `src/theme/tokens.css`**

```css
/* Command Deck — base tokens (dark default) */
:root {
  /* surfaces */
  --bg: #0a0a0b;
  --surface-1: #0d0d0f;
  --surface-2: #111114;
  --surface-hover: #15151a;
  --border: #1a1a1d;
  --border-strong: #2a2a2d;

  /* text */
  --text: #e6e6e8;
  --text-muted: #9a9aa3;
  --text-dim: #6b6b74;

  /* accent (default: red) */
  --accent: #ff3131;
  --accent-glow: rgba(255, 49, 49, 0.4);
  --accent-soft: rgba(255, 49, 49, 0.12);
  --accent-ink: #0a0a0b;

  /* semantic */
  --ok: #35d07f;
  --warn: #ff9f1c;
  --err: #ff3131;

  /* typography */
  --font-mono: "JetBrains Mono", Menlo, ui-monospace, monospace;
  --font-sans: "Inter", "Segoe UI", system-ui, sans-serif;

  --text-xs: 11px;
  --text-sm: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 28px;

  /* spacing — base 4 */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 32px;
  --s-7: 48px;

  /* radii — Command Deck é afiado */
  --r-sm: 3px;
  --r-md: 5px;
  --r-lg: 8px;

  /* motion */
  --dur-fast: 120ms;
  --dur: 200ms;
  --dur-slow: 400ms;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* chrome */
  --sidebar-w: 184px;
  --topbar-h: 44px;
  --statusbar-h: 26px;
}
```

- [ ] **Step 2: Write `src/theme/theme-dark.css`**

```css
/* Dark is the default in tokens.css — this file is a no-op placeholder
   kept for symmetry with theme-light.css and future dark variants. */
[data-theme="dark"] {
  color-scheme: dark;
}
```

- [ ] **Step 3: Write `src/theme/theme-light.css` (Hard Light)**

```css
[data-theme="light"] {
  color-scheme: light;

  --bg: #ffffff;
  --surface-1: #ffffff;
  --surface-2: #ffffff;
  --surface-hover: #f4f2ec;

  --border: #1a1a1a;
  --border-strong: #1a1a1a;

  --text: #1a1a1a;
  --text-muted: #555555;
  --text-dim: #888888;

  --accent-ink: #ffffff;
  --accent-soft: rgba(255, 49, 49, 0.08);
}
```

- [ ] **Step 4: Write `src/theme/accents.css`**

```css
[data-accent="red"] {
  --accent: #ff3131;
  --accent-glow: rgba(255, 49, 49, 0.4);
  --accent-soft: rgba(255, 49, 49, 0.12);
}
[data-accent="amber"] {
  --accent: #ff9f1c;
  --accent-glow: rgba(255, 159, 28, 0.4);
  --accent-soft: rgba(255, 159, 28, 0.12);
}
[data-accent="green"] {
  --accent: #35d07f;
  --accent-glow: rgba(53, 208, 127, 0.4);
  --accent-soft: rgba(53, 208, 127, 0.12);
}
[data-accent="blue"] {
  --accent: #4ea1ff;
  --accent-glow: rgba(78, 161, 255, 0.4);
  --accent-soft: rgba(78, 161, 255, 0.12);
}
[data-accent="violet"] {
  --accent: #b982ff;
  --accent-glow: rgba(185, 130, 255, 0.4);
  --accent-soft: rgba(185, 130, 255, 0.12);
}
[data-theme="light"][data-accent] {
  --accent-soft: rgba(0, 0, 0, 0.04);
}
```

- [ ] **Step 5: Write `src/theme/fonts.css`**

```css
/* JetBrains Mono — self-hosted from /public/fonts */
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/JetBrainsMono-Regular.woff2") format("woff2");
}
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/fonts/JetBrainsMono-Bold.woff2") format("woff2");
}

/* Inter */
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/Inter-Regular.woff2") format("woff2");
}
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/fonts/Inter-SemiBold.woff2") format("woff2");
}
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/fonts/Inter-Bold.woff2") format("woff2");
}
```

- [ ] **Step 6: Write `src/theme/index.css`**

```css
@import "./fonts.css";
@import "./tokens.css";
@import "./theme-dark.css";
@import "./theme-light.css";
@import "./accents.css";

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button {
  font-family: inherit;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/theme
git commit -m "feat(v10): theme tokens and font stack"
```

### Task 1.2: Download and add fonts

**Files:**
- Create: `public/fonts/JetBrainsMono-Regular.woff2`
- Create: `public/fonts/JetBrainsMono-Bold.woff2`
- Create: `public/fonts/Inter-Regular.woff2`
- Create: `public/fonts/Inter-SemiBold.woff2`
- Create: `public/fonts/Inter-Bold.woff2`
- Create: `docs/fonts-attribution.md`

- [ ] **Step 1: Create fonts directory**

```bash
mkdir -p public/fonts
```

- [ ] **Step 2: Download JetBrains Mono (Latin subset) from official GitHub**

Fetch from https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/webfonts/JetBrainsMono-Regular.woff2 and https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/webfonts/JetBrainsMono-Bold.woff2 and save to `public/fonts/`.

Use `curl -L -o public/fonts/JetBrainsMono-Regular.woff2 <url>` on each URL.

- [ ] **Step 3: Download Inter (Latin subset) from rsms/inter releases**

Fetch Inter-Regular.woff2, Inter-SemiBold.woff2, Inter-Bold.woff2 from the latest Inter release (https://github.com/rsms/inter/releases) and save to `public/fonts/`.

- [ ] **Step 4: Write `docs/fonts-attribution.md`**

```markdown
# Fonts

- **JetBrains Mono** — © JetBrains s.r.o., SIL Open Font License 1.1 — https://www.jetbrains.com/lp/mono/
- **Inter** — © The Inter Project Authors, SIL Open Font License 1.1 — https://rsms.me/inter/

Files located in `public/fonts/`.
```

- [ ] **Step 5: Verify fonts load**

Check that each `.woff2` is > 10 KB (sanity check for non-truncated download).

```bash
ls -la public/fonts/
```

Expected: five files, each between 20 KB and 200 KB.

- [ ] **Step 6: Commit**

```bash
git add public/fonts docs/fonts-attribution.md
git commit -m "feat(v10): self-hosted JetBrains Mono + Inter fonts"
```

### Task 1.3: Add FOUC-prevention inline script

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Read current `index.html`**

```bash
cat index.html
```

- [ ] **Step 2: Insert theme restore script in `<head>`**

Add this `<script>` as the first element after the existing `<meta>` tags and before any `<link>` to stylesheets:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem("ai-launcher:theme") || "dark";
      var a = localStorage.getItem("ai-launcher:accent") || "red";
      document.documentElement.setAttribute("data-theme", t);
      document.documentElement.setAttribute("data-accent", a);
    } catch (e) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.setAttribute("data-accent", "red");
    }
  })();
</script>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(v10): pre-paint theme restore in index.html"
```

### Task 1.4: Create hooks for theme and accent

**Files:**
- Create: `src/hooks/useTheme.ts`
- Create: `src/hooks/useAccent.ts`

- [ ] **Step 1: Write `src/hooks/useTheme.ts`**

```ts
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "ai-launcher:theme";

function readSaved(): Theme {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(readSaved);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (private mode)
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
```

- [ ] **Step 2: Write `src/hooks/useAccent.ts`**

```ts
import { useCallback, useEffect, useState } from "react";

export type Accent = "red" | "amber" | "green" | "blue" | "violet";

export const ACCENTS: Accent[] = ["red", "amber", "green", "blue", "violet"];

const STORAGE_KEY = "ai-launcher:accent";

function readSaved(): Accent {
  if (typeof window === "undefined") return "red";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return ACCENTS.includes(v as Accent) ? (v as Accent) : "red";
}

export function useAccent(): { accent: Accent; setAccent: (a: Accent) => void } {
  const [accent, setAccentState] = useState<Accent>(readSaved);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    document.documentElement.setAttribute("data-accent", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  return { accent, setAccent };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks
git commit -m "feat(v10): useTheme and useAccent hooks"
```

---

## Phase 2 — UI primitives (`src/ui/*`)

### Task 2.1: Button, Chip, Card

**Files:**
- Create: `src/ui/Button.tsx`
- Create: `src/ui/Button.css`
- Create: `src/ui/Chip.tsx`
- Create: `src/ui/Chip.css`
- Create: `src/ui/Card.tsx`
- Create: `src/ui/Card.css`

- [ ] **Step 1: Write `src/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = ["cd-btn", `cd-btn--${variant}`, `cd-btn--${size}`];
  if (className) cls.push(className);
  return (
    <button
      {...rest}
      className={cls.join(" ")}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
    >
      {icon && <span className="cd-btn__icon">{icon}</span>}
      <span className="cd-btn__label">{children}</span>
    </button>
  );
}
```

- [ ] **Step 2: Write `src/ui/Button.css`**

```css
.cd-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease);
  border: 1px solid transparent;
}
.cd-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.cd-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.cd-btn--sm {
  font-size: var(--text-xs);
  padding: 4px 10px;
}
.cd-btn--md {
  font-size: var(--text-sm);
  padding: 6px 14px;
}
.cd-btn--lg {
  font-size: var(--text-md);
  padding: 10px 18px;
}

.cd-btn--primary {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
}
.cd-btn--primary:hover:not(:disabled) {
  box-shadow: 0 0 18px var(--accent-glow);
}

.cd-btn--ghost {
  background: transparent;
  color: var(--text);
  border-color: var(--border-strong);
}
.cd-btn--ghost:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.cd-btn--danger {
  background: transparent;
  color: var(--err);
  border-color: var(--err);
}
.cd-btn--danger:hover:not(:disabled) {
  background: var(--err);
  color: var(--accent-ink);
}
```

- [ ] **Step 3: Write `src/ui/Chip.tsx`**

```tsx
import type { HTMLAttributes, ReactNode } from "react";
import "./Chip.css";

type ChipVariant =
  | "neutral"
  | "online"
  | "offline"
  | "missing"
  | "update"
  | "admin"
  | "warn";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  dot?: boolean;
  children: ReactNode;
}

export function Chip({
  variant = "neutral",
  dot = false,
  className,
  children,
  ...rest
}: ChipProps) {
  const cls = ["cd-chip", `cd-chip--${variant}`];
  if (className) cls.push(className);
  return (
    <span {...rest} className={cls.join(" ")}>
      {dot && <span className="cd-chip__dot" aria-hidden />}
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Write `src/ui/Chip.css`**

```css
.cd-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  background: transparent;
}

.cd-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.cd-chip--online {
  color: var(--accent);
  border-color: var(--accent);
}
.cd-chip--offline {
  color: var(--text-dim);
  border-color: var(--border);
}
.cd-chip--missing {
  color: var(--text-dim);
  border-color: var(--border);
  opacity: 0.7;
}
.cd-chip--update {
  color: var(--warn);
  border-color: var(--warn);
}
.cd-chip--warn {
  color: var(--warn);
  border-color: var(--warn);
}
.cd-chip--admin {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
}
.cd-chip--admin .cd-chip__dot {
  background: var(--accent-ink);
  box-shadow: none;
}
```

- [ ] **Step 5: Write `src/ui/Card.tsx`**

```tsx
import type { HTMLAttributes, ReactNode } from "react";
import "./Card.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  active?: boolean;
  children: ReactNode;
}

export function Card({
  interactive = false,
  active = false,
  className,
  children,
  ...rest
}: CardProps) {
  const cls = ["cd-card"];
  if (interactive) cls.push("cd-card--interactive");
  if (active) cls.push("cd-card--active");
  if (className) cls.push(className);
  return (
    <div {...rest} className={cls.join(" ")}>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Write `src/ui/Card.css`**

```css
.cd-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--s-3);
  transition: border-color var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease);
}

.cd-card--interactive {
  cursor: pointer;
}
.cd-card--interactive:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-soft);
}

.cd-card--active {
  border-color: var(--accent);
  box-shadow: inset 3px 0 0 var(--accent);
}
```

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc --noEmit
```

Expected: zero errors.

```bash
git add src/ui
git commit -m "feat(v10): Button, Chip, Card primitives"
```

### Task 2.2: Input, Toggle, Tooltip

**Files:**
- Create: `src/ui/Input.tsx`
- Create: `src/ui/Input.css`
- Create: `src/ui/Toggle.tsx`
- Create: `src/ui/Toggle.css`
- Create: `src/ui/Tooltip.tsx`
- Create: `src/ui/Tooltip.css`

- [ ] **Step 1: Write `src/ui/Input.tsx`**

```tsx
import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import "./Input.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, invalid, className, ...rest },
  ref,
) {
  const wrapCls = ["cd-input"];
  if (invalid) wrapCls.push("cd-input--invalid");
  if (className) wrapCls.push(className);
  return (
    <label className={wrapCls.join(" ")}>
      {prefix && <span className="cd-input__prefix">{prefix}</span>}
      <input ref={ref} {...rest} />
      {suffix && <span className="cd-input__suffix">{suffix}</span>}
    </label>
  );
});
```

- [ ] **Step 2: Write `src/ui/Input.css`**

```css
.cd-input {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  padding: 6px 10px;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text);
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}
.cd-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.cd-input input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 0;
  outline: 0;
  color: inherit;
  font: inherit;
}
.cd-input input::placeholder {
  color: var(--text-dim);
}
.cd-input__prefix,
.cd-input__suffix {
  color: var(--text-dim);
  font-weight: 700;
}
.cd-input--invalid {
  border-color: var(--err);
}
```

- [ ] **Step 3: Write `src/ui/Toggle.tsx`**

```tsx
import type { ChangeEvent, ReactNode } from "react";
import "./Toggle.css";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };
  return (
    <label className={`cd-toggle${disabled ? " cd-toggle--disabled" : ""}`}>
      <input type="checkbox" checked={checked} onChange={handle} disabled={disabled} />
      <span className="cd-toggle__track">
        <span className="cd-toggle__thumb" />
      </span>
      {label && <span className="cd-toggle__label">{label}</span>}
    </label>
  );
}
```

- [ ] **Step 4: Write `src/ui/Toggle.css`**

```css
.cd-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}
.cd-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.cd-toggle__track {
  position: relative;
  width: 34px;
  height: 18px;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  transition: background var(--dur-fast), border-color var(--dur-fast);
}
.cd-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: left var(--dur), background var(--dur);
}
.cd-toggle input:checked + .cd-toggle__track {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.cd-toggle input:checked + .cd-toggle__track .cd-toggle__thumb {
  left: 18px;
  background: var(--accent);
}
.cd-toggle--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cd-toggle__label {
  color: var(--text);
}
```

- [ ] **Step 5: Write `src/ui/Tooltip.tsx`**

```tsx
import type { ReactNode } from "react";
import "./Tooltip.css";

interface TooltipProps {
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}

export function Tooltip({ content, side = "top", children }: TooltipProps) {
  return (
    <span className="cd-tip" data-side={side}>
      {children}
      <span role="tooltip" className="cd-tip__content">
        {content}
      </span>
    </span>
  );
}
```

- [ ] **Step 6: Write `src/ui/Tooltip.css`**

```css
.cd-tip {
  position: relative;
  display: inline-flex;
}
.cd-tip__content {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--dur), transform var(--dur);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text);
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  white-space: nowrap;
  z-index: 50;
}
.cd-tip:hover .cd-tip__content,
.cd-tip:focus-within .cd-tip__content {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 400ms;
}
.cd-tip[data-side="top"] .cd-tip__content { bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(4px); }
.cd-tip[data-side="top"]:hover .cd-tip__content { transform: translateX(-50%) translateY(0); }
.cd-tip[data-side="bottom"] .cd-tip__content { top: calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(-4px); }
.cd-tip[data-side="bottom"]:hover .cd-tip__content { transform: translateX(-50%) translateY(0); }
.cd-tip[data-side="left"] .cd-tip__content { right: calc(100% + 6px); top: 50%; transform: translateY(-50%) translateX(4px); }
.cd-tip[data-side="left"]:hover .cd-tip__content { transform: translateY(-50%) translateX(0); }
.cd-tip[data-side="right"] .cd-tip__content { left: calc(100% + 6px); top: 50%; transform: translateY(-50%) translateX(-4px); }
.cd-tip[data-side="right"]:hover .cd-tip__content { transform: translateY(-50%) translateX(0); }
```

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc --noEmit
git add src/ui
git commit -m "feat(v10): Input, Toggle, Tooltip primitives"
```

### Task 2.3: Dialog, Skeleton, Banner

**Files:**
- Create: `src/ui/Dialog.tsx`
- Create: `src/ui/Dialog.css`
- Create: `src/ui/Skeleton.tsx`
- Create: `src/ui/Skeleton.css`
- Create: `src/ui/Banner.tsx`
- Create: `src/ui/Banner.css`

- [ ] **Step 1: Write `src/ui/Dialog.tsx`**

```tsx
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import "./Dialog.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, size = "md", children, footer }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cd-dialog__backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={ref}
        tabIndex={-1}
        className={`cd-dialog cd-dialog--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cd-dialog__header">
          <h2 className="cd-dialog__title">{title}</h2>
          <button
            type="button"
            className="cd-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="cd-dialog__body">{children}</div>
        {footer && <footer className="cd-dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/ui/Dialog.css`**

```css
.cd-dialog__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--s-5);
}
.cd-dialog {
  background: var(--surface-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  max-width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
.cd-dialog--sm { width: 360px; }
.cd-dialog--md { width: 560px; }
.cd-dialog--lg { width: 860px; }

.cd-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--s-3) var(--s-4);
  border-bottom: 1px solid var(--border);
}
.cd-dialog__title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-md);
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text);
}
.cd-dialog__close {
  background: transparent;
  border: 0;
  color: var(--text-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
}
.cd-dialog__close:hover { color: var(--accent); }

.cd-dialog__body {
  padding: var(--s-4);
  overflow-y: auto;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--text);
}
.cd-dialog__footer {
  padding: var(--s-3) var(--s-4);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: var(--s-2);
}
```

- [ ] **Step 3: Write `src/ui/Skeleton.tsx`**

```tsx
import "./Skeleton.css";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: "line" | "card";
}

export function Skeleton({ width = "100%", height = 14, variant = "line" }: SkeletonProps) {
  return (
    <div
      className={`cd-skel cd-skel--${variant}`}
      style={{ width, height }}
      aria-busy="true"
    />
  );
}
```

- [ ] **Step 4: Write `src/ui/Skeleton.css`**

```css
.cd-skel {
  background: linear-gradient(
    90deg,
    var(--surface-2) 0%,
    var(--surface-hover) 50%,
    var(--surface-2) 100%
  );
  background-size: 200% 100%;
  animation: cd-skel-shim 1.2s infinite linear;
  border-radius: var(--r-sm);
}
.cd-skel--card { border-radius: var(--r-md); }

@keyframes cd-skel-shim {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .cd-skel { animation: none; }
}
```

- [ ] **Step 5: Write `src/ui/Banner.tsx`**

```tsx
import type { ReactNode } from "react";
import "./Banner.css";

interface BannerProps {
  variant?: "info" | "warn" | "err" | "admin";
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function Banner({ variant = "info", icon, children, actions }: BannerProps) {
  return (
    <div className={`cd-banner cd-banner--${variant}`}>
      {icon && <span className="cd-banner__icon">{icon}</span>}
      <span className="cd-banner__content">{children}</span>
      {actions && <span className="cd-banner__actions">{actions}</span>}
    </div>
  );
}
```

- [ ] **Step 6: Write `src/ui/Banner.css`**

```css
.cd-banner {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--text);
}
.cd-banner__content { flex: 1; }
.cd-banner--info { border-color: var(--border-strong); color: var(--text-muted); }
.cd-banner--warn { border-color: var(--warn); color: var(--warn); }
.cd-banner--err  { border-color: var(--err);  color: var(--err); }
.cd-banner--admin { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
```

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc --noEmit
git add src/ui
git commit -m "feat(v10): Dialog, Skeleton, Banner primitives"
```

---

## Phase 3 — Layout shell

### Task 3.1: Sidebar, TopBar, StatusBar

**Files:**
- Create: `src/app/layout/Sidebar.tsx`
- Create: `src/app/layout/Sidebar.css`
- Create: `src/app/layout/TopBar.tsx`
- Create: `src/app/layout/TopBar.css`
- Create: `src/app/layout/StatusBar.tsx`
- Create: `src/app/layout/StatusBar.css`
- Create: `src/app/layout/TabId.ts`

- [ ] **Step 1: Write `src/app/layout/TabId.ts`**

```ts
export type TabId =
  | "launcher"
  | "tools"
  | "history"
  | "costs"
  | "admin"
  | "help";

export const TAB_ORDER: TabId[] = ["launcher", "tools", "history", "costs", "admin", "help"];

export const TAB_LABELS: Record<TabId, string> = {
  launcher: "Launch",
  tools: "Tools",
  history: "History",
  costs: "Costs",
  admin: "Admin",
  help: "Help",
};

export const TAB_KEYS: Record<TabId, string> = {
  launcher: "⌘1",
  tools: "⌘2",
  history: "⌘3",
  costs: "⌘4",
  admin: "⌘,",
  help: "?",
};
```

- [ ] **Step 2: Write `src/app/layout/Sidebar.tsx`**

```tsx
import { Chip } from "../../ui/Chip";
import { TAB_KEYS, TAB_LABELS, type TabId } from "./TabId";
import "./Sidebar.css";

interface SidebarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  version: string;
}

export function Sidebar({ active, onSelect, version }: SidebarProps) {
  return (
    <aside className="cd-side">
      <div className="cd-side__brand">
        <span className="cd-side__led" aria-hidden />
        <span className="cd-side__name">AI LAUNCHER</span>
      </div>

      <nav className="cd-side__nav">
        <div className="cd-side__group">
          <div className="cd-side__label">Workspace</div>
          <Item id="launcher" active={active} onSelect={onSelect} />
          <Item id="tools" active={active} onSelect={onSelect} />
          <Item id="history" active={active} onSelect={onSelect} />
          <Item id="costs" active={active} onSelect={onSelect} />
        </div>

        <div className="cd-side__group">
          <div className="cd-side__label">System</div>
          <Item id="admin" active={active} onSelect={onSelect} />
        </div>

        <div className="cd-side__group">
          <div className="cd-side__label">Support</div>
          <Item id="help" active={active} onSelect={onSelect} />
        </div>
      </nav>

      <div className="cd-side__foot">
        <Chip variant="admin" dot>Admin · full access</Chip>
        <div className="cd-side__ver">v{version}</div>
      </div>
    </aside>
  );
}

function Item({
  id,
  active,
  onSelect,
}: {
  id: TabId;
  active: TabId;
  onSelect: (id: TabId) => void;
}) {
  const isOn = id === active;
  return (
    <button
      type="button"
      className={`cd-side__item${isOn ? " cd-side__item--on" : ""}`}
      onClick={() => onSelect(id)}
    >
      <span className="cd-side__item-name">{TAB_LABELS[id]}</span>
      <span className="cd-side__item-key">{TAB_KEYS[id]}</span>
    </button>
  );
}
```

- [ ] **Step 3: Write `src/app/layout/Sidebar.css`**

```css
.cd-side {
  width: var(--sidebar-w);
  background: var(--surface-1);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: var(--s-3) var(--s-2);
  font-family: var(--font-mono);
}

.cd-side__brand {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-2) var(--s-3) var(--s-3);
  font-weight: 800;
  letter-spacing: 1.2px;
  font-size: var(--text-sm);
  border-bottom: 1px dashed var(--border);
  margin-bottom: var(--s-3);
}
.cd-side__led {
  width: 9px;
  height: 9px;
  background: var(--accent);
  border-radius: 2px;
  box-shadow: 0 0 10px var(--accent);
}

.cd-side__nav { flex: 1; display: flex; flex-direction: column; gap: var(--s-3); }
.cd-side__group { display: flex; flex-direction: column; gap: 2px; }
.cd-side__label {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--text-dim);
  padding: 4px var(--s-3);
  text-transform: uppercase;
}

.cd-side__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px var(--s-3);
  background: transparent;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--text-sm);
  text-align: left;
  transition: background var(--dur-fast), color var(--dur-fast);
}
.cd-side__item:hover { background: var(--surface-hover); color: var(--text); }
.cd-side__item--on {
  background: var(--accent-soft);
  border-left-color: var(--accent);
  color: var(--text);
  font-weight: 700;
}
.cd-side__item-key { font-size: 10px; color: var(--text-dim); letter-spacing: 1px; }

.cd-side__foot {
  border-top: 1px dashed var(--border);
  padding: var(--s-3);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  font-size: 10px;
  color: var(--text-dim);
}
.cd-side__ver { letter-spacing: 1.5px; }
```

- [ ] **Step 4: Write `src/app/layout/TopBar.tsx`**

```tsx
import { Input } from "../../ui/Input";
import { ACCENTS, type Accent } from "../../hooks/useAccent";
import type { Theme } from "../../hooks/useTheme";
import "./TopBar.css";

interface TopBarProps {
  onCommand: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  accent: Accent;
  onAccent: (a: Accent) => void;
}

export function TopBar({ onCommand, theme, onToggleTheme, accent, onAccent }: TopBarProps) {
  return (
    <header className="cd-top">
      <button className="cd-top__cmd" type="button" onClick={onCommand}>
        <span className="cd-top__cmd-icon">⌘</span>
        <span>search commands, CLIs, presets…</span>
        <span className="cd-top__cmd-key">⌘K</span>
      </button>

      <div className="cd-top__right">
        <div className="cd-top__accents" role="radiogroup" aria-label="Accent color">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={a === accent}
              className={`cd-top__acc cd-top__acc--${a}${a === accent ? " is-on" : ""}`}
              onClick={() => onAccent(a)}
              title={a}
            />
          ))}
        </div>

        <button
          type="button"
          className="cd-top__theme"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? "☾" : "☀"}
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Write `src/app/layout/TopBar.css`**

```css
.cd-top {
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-4);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.cd-top__cmd {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--s-2);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  padding: 5px var(--s-3);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  cursor: pointer;
  text-align: left;
}
.cd-top__cmd:hover { border-color: var(--accent); }
.cd-top__cmd-icon { color: var(--accent); font-weight: 700; }
.cd-top__cmd-key { margin-left: auto; color: var(--text-dim); font-size: 10px; letter-spacing: 1px; }

.cd-top__right { display: flex; align-items: center; gap: var(--s-3); }

.cd-top__accents { display: flex; gap: 4px; }
.cd-top__acc {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  border: 1px solid var(--border-strong);
  background: var(--bg);
  cursor: pointer;
  padding: 0;
  transition: transform var(--dur-fast);
}
.cd-top__acc:hover { transform: scale(1.15); }
.cd-top__acc.is-on { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px currentColor; }
.cd-top__acc--red    { color: #ff3131; background: #ff3131; }
.cd-top__acc--amber  { color: #ff9f1c; background: #ff9f1c; }
.cd-top__acc--green  { color: #35d07f; background: #35d07f; }
.cd-top__acc--blue   { color: #4ea1ff; background: #4ea1ff; }
.cd-top__acc--violet { color: #b982ff; background: #b982ff; }

.cd-top__theme {
  background: transparent;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  color: var(--text);
  font-size: var(--text-md);
  width: 28px;
  height: 24px;
  cursor: pointer;
  padding: 0;
}
.cd-top__theme:hover { border-color: var(--accent); }
```

- [ ] **Step 6: Write `src/app/layout/StatusBar.tsx`**

```tsx
import "./StatusBar.css";

interface StatusBarProps {
  online: number;
  total: number;
  todaySpend: string;
  version: string;
}

export function StatusBar({ online, total, todaySpend, version }: StatusBarProps) {
  return (
    <footer className="cd-status">
      <span className="cd-status__cell">▎ {online}/{total} online</span>
      <span className="cd-status__cell cd-status__cell--accent">● ADMIN</span>
      <span className="cd-status__cell">{todaySpend} today</span>
      <span className="cd-status__cell cd-status__cell--muted">v{version}</span>
    </footer>
  );
}
```

- [ ] **Step 7: Write `src/app/layout/StatusBar.css`**

```css
.cd-status {
  height: var(--statusbar-h);
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: 0 var(--s-4);
  border-top: 1px solid var(--border);
  background: var(--surface-1);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-dim);
}
.cd-status__cell--accent { color: var(--accent); font-weight: 700; }
.cd-status__cell--muted { margin-left: auto; }
```

- [ ] **Step 8: Type-check and commit**

```bash
npx tsc --noEmit
git add src/app/layout src/hooks
git commit -m "feat(v10): sidebar, topbar, statusbar layout shell"
```

### Task 3.2: Minimal `App.tsx` + `main.tsx` wiring

**Files:**
- Move/Rename old: `src/App.tsx` → `src/App.v9.tsx.bak` (kept out of build; `.bak` suffix not picked up by Vite)
- Move/Rename old: `src/main.tsx` → `src/main.v9.tsx.bak`
- Create: `src/app/App.tsx`
- Create: `src/app/App.css`
- Create: `src/app/main.tsx`
- Modify: `index.html` (entry point path)

- [ ] **Step 1: Back up v9 entry files**

```bash
mv src/App.tsx src/App.v9.tsx.bak
mv src/main.tsx src/main.v9.tsx.bak
```

- [ ] **Step 2: Write `src/app/App.css`**

```css
.cd-app {
  height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  grid-template-rows: var(--topbar-h) 1fr var(--statusbar-h);
  grid-template-areas:
    "side top"
    "side main"
    "side status";
  background: var(--bg);
}
.cd-app__top { grid-area: top; }
.cd-app__side { grid-area: side; }
.cd-app__main { grid-area: main; overflow: auto; padding: var(--s-5); }
.cd-app__status { grid-area: status; }
```

- [ ] **Step 3: Write `src/app/App.tsx`**

```tsx
import { useState } from "react";
import pkg from "../../package.json";
import { useAccent } from "../hooks/useAccent";
import { useTheme } from "../hooks/useTheme";
import { Sidebar } from "./layout/Sidebar";
import { StatusBar } from "./layout/StatusBar";
import { TopBar } from "./layout/TopBar";
import { TAB_ORDER, type TabId } from "./layout/TabId";
import "./App.css";

export function App() {
  const [active, setActive] = useState<TabId>("launcher");
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <div className="cd-app">
      <aside className="cd-app__side">
        <Sidebar active={active} onSelect={setActive} version={pkg.version} />
      </aside>
      <div className="cd-app__top">
        <TopBar
          onCommand={() => {
            /* wired in Phase 7 */
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
          accent={accent}
          onAccent={setAccent}
        />
      </div>
      <main className="cd-app__main">
        <Placeholder tab={active} />
      </main>
      <div className="cd-app__status">
        <StatusBar online={0} total={TAB_ORDER.length} todaySpend="$0.00" version={pkg.version} />
      </div>
    </div>
  );
}

function Placeholder({ tab }: { tab: TabId }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
      <h2 style={{ margin: 0, color: "var(--text)" }}>▎ {tab.toUpperCase()}</h2>
      <p>Feature page wiring arrives in Phase 6.</p>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/app/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "../theme/index.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 5: Update `index.html` entry path**

Change the `<script type="module" src="/src/main.tsx">` tag (or equivalent current path) to `<script type="module" src="/src/app/main.tsx">`.

- [ ] **Step 6: Add package.json resolveJsonModule if missing**

Ensure `tsconfig.json` has `"resolveJsonModule": true` under `compilerOptions` so `import pkg from "../../package.json"` works.

- [ ] **Step 7: Dev-run smoke test**

```bash
npm run dev
```

Open the app — verify: sidebar visible, nav items clickable (swap active), TopBar visible with command search pill + 5 accent dots + theme toggle, StatusBar at bottom. Click accents → chrome recolors immediately. Click theme toggle → app flips light/dark.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(v10): minimal App shell wired to theme + accent"
```

---

## Phase 4 — Icon pipeline

### Task 4.1: Replace CLI icons with official-style line-art set

**Files:**
- Replace: `public/icons/cli/claude.svg`
- Replace: `public/icons/cli/codex.svg`
- Replace: `public/icons/cli/gemini.svg`
- Replace: `public/icons/cli/qwen.svg`
- Replace: `public/icons/cli/crush.svg`
- Replace: `public/icons/cli/droid.svg`
- Replace: `public/icons/cli/kilo.svg`
- Replace: `public/icons/cli/opencode.svg`
- Create: `public/icons/cli/aider.svg`
- Create: `public/icons/cli/copilot.svg`
- Create: `public/icons/cli/minimax.svg`
- Create: `docs/icons-attribution.md`

- [ ] **Step 1: Establish the line-art template**

Every icon follows this template: 24×24 viewBox, `stroke="currentColor"`, stroke-width 1.5, `fill="none"` (unless the official logo requires a fill). Cap/join `round`. Dimensions match `public/icons/tool/vscode.svg`'s existing approach.

- [ ] **Step 2: For each CLI, either (a) port the official mark trimmed to 24×24 + currentColor, or (b) draw a line-style glyph whose silhouette echoes the brand**

Write one file per CLI. Example `claude.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="8.5"/>
  <path d="M8 9.5c1.5-2 6.5-2 8 0"/>
  <path d="M8 14.5c1.5 2 6.5 2 8 0"/>
</svg>
```

Repeat the pattern for each CLI — use a distinct geometry per brand. (Codex: terminal bracket `< >`; Gemini: star-burst 4-point; Qwen: stacked chevrons; Aider: `AI.` monogram; Copilot: wing outline; Minimax: pulse wave; Crush/Droid/Kilo/Opencode: keep existing marks but normalize to the currentColor template.)

The goal is a coherent family: every icon uses `currentColor`, 1.5 stroke, and reads at 18–22px. Individual glyphs can take creative license.

- [ ] **Step 3: Write `docs/icons-attribution.md`**

```markdown
# CLI & Tool Icons

All icons in `public/icons/cli/` and `public/icons/tool/` are 24×24 line-art glyphs using `currentColor`, rendered in the Command Deck style.

## Origin

- **Custom-drawn line-style marks** evoking each brand's silhouette. They are **not** the official corporate logos and are used as abstract indicators in the launcher UI.
- Where an official mark is permissively licensed and simple enough to render in single-stroke form, it has been adapted.

## Non-endorsement

The icons do not imply affiliation or endorsement by any of the vendors whose products the launcher may launch.

## Licenses observed

- Lucide (used for generic UI icons): ISC License — https://lucide.dev
- No official vendor assets are redistributed verbatim.
```

- [ ] **Step 4: Visual spot-check**

Open `public/icons/cli/claude.svg` through to `opencode.svg` in a browser (use `file://`). Confirm each renders crisply at 24×24 with no fill bleeds.

- [ ] **Step 5: Commit**

```bash
git add public/icons docs/icons-attribution.md
git commit -m "feat(v10): coherent line-style CLI icon set"
```

### Task 4.2: Replace tool icons + add missing JetBrains AI mark

**Files:**
- Replace: `public/icons/tool/vscode.svg`
- Replace: `public/icons/tool/cursor.svg`
- Replace: `public/icons/tool/windsurf.svg`
- Replace: `public/icons/tool/antgravity.svg`
- Create: `public/icons/tool/jetbrains-ai.svg`

- [ ] **Step 1: Rewrite each tool icon using the same 24×24 / currentColor / 1.5 stroke template as Task 4.1**

VSCode: two-angle chevron forming the VS silhouette. Cursor: concentric caret. Windsurf: wave over horizon. Antgravity: inverted arc + orbital dot. JetBrains AI: outlined diamond + AI monogram.

- [ ] **Step 2: Verify rendering and commit**

```bash
git add public/icons/tool
git commit -m "feat(v10): coherent line-style tool icon set"
```

### Task 4.3: Create UI glyph set + icon registry

**Files:**
- Create: `src/icons/registry.ts`
- Create: `src/icons/ui/*.svg` (as needed — otherwise use Lucide)

- [ ] **Step 1: Write `src/icons/registry.ts`**

```ts
export function getCliIcon(key: string): string {
  return `/icons/cli/${key}.svg`;
}

export function getToolIcon(key: string): string {
  return `/icons/tool/${key}.svg`;
}

const CLI_KEYS = new Set([
  "claude",
  "codex",
  "gemini",
  "qwen",
  "crush",
  "droid",
  "kilo",
  "opencode",
  "aider",
  "copilot",
  "minimax",
]);

export function hasCliIcon(key: string): boolean {
  return CLI_KEYS.has(key);
}

const TOOL_KEYS = new Set([
  "vscode",
  "cursor",
  "windsurf",
  "antgravity",
  "jetbrains-ai",
]);

export function hasToolIcon(key: string): boolean {
  return TOOL_KEYS.has(key);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/icons
git commit -m "feat(v10): icon registry helpers"
```

---

## Phase 5 — Persistence helper migrations

### Task 5.1: Migrate `FontId` and `applyFontStack` to `lib/appearance.ts`

**Files:**
- Modify: `src/lib/appearance.ts` (add FontId + applyFontStack)
- Keep: `src/providers/AppearanceSection.tsx` temporarily (will be deleted in Phase 9)

- [ ] **Step 1: Read current `src/providers/AppearanceSection.tsx` to extract FontId + applyFontStack**

```bash
grep -n "FontId\|applyFontStack\|FONT_STORAGE_KEY" src/providers/AppearanceSection.tsx
```

- [ ] **Step 2: Append extracted code to `src/lib/appearance.ts`**

Add the exported members with the exact same names and shapes that `AppearanceSection.tsx` currently exports:

```ts
// --- Font stack management (migrated from providers/AppearanceSection.tsx) ---

export type FontId = "mono" | "sans" | "mixed";

export const FONT_STORAGE_KEY = "ai-launcher:font";

export function applyFontStack(id: FontId): void {
  const root = document.documentElement;
  root.setAttribute("data-font", id);
}
```

(If the v9 code used additional IDs or behaviors, port them verbatim; don't editorialize.)

- [ ] **Step 3: Update imports project-wide**

Search-replace `from './providers/AppearanceSection'` → `from './lib/appearance'` for the `FontId`, `applyFontStack`, `FONT_STORAGE_KEY` imports in any file that survives into v10 wiring (safe to skip v9 pages about to be deleted).

- [ ] **Step 4: Verify type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/appearance.ts
git commit -m "refactor(v10): migrate FontId helpers to lib/appearance"
```

---

## Phase 6 — Feature pages

Each feature page is built with the UI primitives from Phase 2 and lives in `src/features/<name>/`. Pages are wired into `src/app/App.tsx` by replacing the `<Placeholder>` switch with feature-specific components.

### Task 6.1: Launcher page (CLIs grid)

**Files:**
- Create: `src/features/launcher/LauncherPage.tsx`
- Create: `src/features/launcher/LauncherPage.css`
- Create: `src/features/launcher/CliCard.tsx`
- Create: `src/features/launcher/useClis.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write `src/features/launcher/useClis.ts`**

```ts
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface CliInfo {
  key: string;
  name: string;
  command: string;
  flag: string | null;
  install_cmd: string;
  version_cmd: string;
  npm_pkg: string | null;
  pip_pkg: string | null;
  install_method: string;
  install_url: string | null;
}

export interface CheckResult {
  name: string;
  installed: boolean;
  version: string | null;
  install_command: string | null;
}

export function useClis(): {
  clis: CliInfo[];
  checks: Record<string, CheckResult>;
  loading: boolean;
  refresh: () => void;
} {
  const [clis, setClis] = useState<CliInfo[]>([]);
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await invoke<CliInfo[]>("get_all_clis");
      setClis(list);
      const results = await invoke<CheckResult[]>("check_all_clis");
      const map: Record<string, CheckResult> = {};
      for (const r of results) map[r.name] = r;
      setChecks(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { clis, checks, loading, refresh: load };
}
```

(Command names `get_all_clis` and `check_all_clis` match the existing Rust surface — verify against `src-tauri/src/main.rs` and adjust if the exact command names differ.)

- [ ] **Step 2: Write `src/features/launcher/CliCard.tsx`**

```tsx
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { getCliIcon, hasCliIcon } from "../../icons/registry";
import type { CheckResult, CliInfo } from "./useClis";

interface CliCardProps {
  cli: CliInfo;
  check?: CheckResult;
  onLaunch: (cli: CliInfo) => void;
  onInstall: (cli: CliInfo) => void;
}

export function CliCard({ cli, check, onLaunch, onInstall }: CliCardProps) {
  const installed = check?.installed ?? false;
  const version = check?.version ?? null;
  return (
    <Card interactive>
      <div className="cd-cli-card__head">
        {hasCliIcon(cli.key) ? (
          <img className="cd-cli-card__icon" src={getCliIcon(cli.key)} alt="" />
        ) : (
          <span className="cd-cli-card__icon cd-cli-card__icon--placeholder" />
        )}
        <div className="cd-cli-card__meta">
          <div className="cd-cli-card__name">{cli.name}</div>
          <div className="cd-cli-card__cmd">{cli.command}</div>
        </div>
        <Chip variant={installed ? "online" : "missing"} dot>
          {installed ? (version ?? "online") : "missing"}
        </Chip>
      </div>
      <div className="cd-cli-card__actions">
        {installed ? (
          <Button size="sm" onClick={() => onLaunch(cli)}>Launch</Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onInstall(cli)}>Install</Button>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Write `src/features/launcher/LauncherPage.tsx`**

```tsx
import { invoke } from "@tauri-apps/api/core";
import { CliCard } from "./CliCard";
import { useClis, type CliInfo } from "./useClis";
import "./LauncherPage.css";

export function LauncherPage() {
  const { clis, checks, loading, refresh } = useClis();

  const handleLaunch = async (cli: CliInfo) => {
    await invoke("launch_cli", { key: cli.key });
  };

  const handleInstall = async (cli: CliInfo) => {
    await invoke("install_cli", { key: cli.key });
    await refresh();
  };

  return (
    <section className="cd-launcher">
      <header className="cd-launcher__head">
        <h2 className="cd-launcher__title">▎ LAUNCH</h2>
        <p className="cd-launcher__sub">{loading ? "scanning…" : `${Object.values(checks).filter((c) => c.installed).length}/${clis.length} installed`}</p>
      </header>

      <div className="cd-launcher__grid">
        {clis.map((cli) => (
          <CliCard
            key={cli.key}
            cli={cli}
            check={checks[cli.name]}
            onLaunch={handleLaunch}
            onInstall={handleInstall}
          />
        ))}
      </div>
    </section>
  );
}
```

(`launch_cli` and `install_cli` are placeholder Rust command names — verify against the actual `tauri::generate_handler!` list in `src-tauri/src/main.rs` and adjust.)

- [ ] **Step 4: Write `src/features/launcher/LauncherPage.css`**

```css
.cd-launcher { max-width: 1080px; margin: 0 auto; }
.cd-launcher__head { margin-bottom: var(--s-5); }
.cd-launcher__title {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  letter-spacing: 2px;
  margin: 0 0 4px 0;
  color: var(--text);
}
.cd-launcher__sub { margin: 0; font-family: var(--font-mono); color: var(--text-dim); font-size: var(--text-sm); }

.cd-launcher__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--s-3);
}

.cd-cli-card__head { display: flex; align-items: center; gap: var(--s-2); margin-bottom: var(--s-3); }
.cd-cli-card__icon { width: 22px; height: 22px; color: var(--accent); }
.cd-cli-card__icon--placeholder { background: var(--surface-hover); border-radius: var(--r-sm); }
.cd-cli-card__meta { flex: 1; min-width: 0; }
.cd-cli-card__name { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-sm); color: var(--text); }
.cd-cli-card__cmd { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); letter-spacing: 0.5px; }
.cd-cli-card__actions { display: flex; gap: var(--s-2); }
```

- [ ] **Step 5: Wire into `src/app/App.tsx`**

Replace the `<Placeholder tab={active} />` call with a switch:

```tsx
{active === "launcher" && <LauncherPage />}
{active === "tools" && <Placeholder tab={active} />}
{active === "history" && <Placeholder tab={active} />}
{active === "costs" && <Placeholder tab={active} />}
{active === "admin" && <Placeholder tab={active} />}
{active === "help" && <Placeholder tab={active} />}
```

Add the `import { LauncherPage } from "../features/launcher/LauncherPage";` at the top.

- [ ] **Step 6: Dev-run smoke test**

```bash
npm run dev
```

Verify: CLIs grid loads, status chips render, click Launch actually launches the CLI in a terminal.

- [ ] **Step 7: Commit**

```bash
git add src/features/launcher src/app/App.tsx
git commit -m "feat(v10): launcher page wired to tauri commands"
```

### Task 6.2: Tools page (IDEs grid)

**Files:**
- Create: `src/features/tools/ToolsPage.tsx`
- Create: `src/features/tools/ToolsPage.css`
- Create: `src/features/tools/ToolCard.tsx`
- Create: `src/features/tools/useTools.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write `src/features/tools/useTools.ts`**

```ts
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ToolInfo {
  key: string;
  name: string;
  command: string;
  install_url: string | null;
}

export interface ToolCheck {
  installed: boolean;
  version: string | null;
}

export function useTools(): {
  tools: ToolInfo[];
  checks: Record<string, ToolCheck>;
  loading: boolean;
  refresh: () => void;
} {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [checks, setChecks] = useState<Record<string, ToolCheck>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await invoke<ToolInfo[]>("get_all_tools");
      setTools(list);
      const results = await invoke<Array<{ name: string; installed: boolean; version: string | null }>>(
        "check_all_tools",
      );
      const map: Record<string, ToolCheck> = {};
      for (const r of results) {
        map[r.name] = { installed: r.installed, version: r.version };
      }
      setChecks(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { tools, checks, loading, refresh: load };
}
```

Verify `get_all_tools` / `check_all_tools` names against `src-tauri/src/main.rs`; adjust if needed.

- [ ] **Step 2: Write `src/features/tools/ToolCard.tsx`** — follow the exact same shape as `CliCard`, importing from `../../icons/registry` using `getToolIcon` / `hasToolIcon`.

- [ ] **Step 3: Write `src/features/tools/ToolsPage.tsx`** — same shape as `LauncherPage`, rendering tools with `ToolCard`, calling `invoke("launch_tool", { key })` for the launch action and `invoke("open_url", { url: tool.install_url })` for install.

- [ ] **Step 4: Write `src/features/tools/ToolsPage.css`** — minimal, reuse the launcher grid pattern.

- [ ] **Step 5: Wire into `src/app/App.tsx`** by replacing the `tools` branch with `<ToolsPage />`.

- [ ] **Step 6: Dev-run, smoke test, commit**

```bash
git add src/features/tools src/app/App.tsx
git commit -m "feat(v10): tools page restored"
```

### Task 6.3: History page

**Files:**
- Create: `src/features/history/HistoryPage.tsx`
- Create: `src/features/history/HistoryPage.css`
- Create: `src/features/history/HistoryList.tsx`
- Create: `src/features/history/useHistory.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Reuse the `HistoryItem` shape from the v9 backup**

```bash
grep -n "interface HistoryItem" src/App.v9.tsx.bak
```

Copy the interface into `src/features/history/useHistory.ts` and keep the same localStorage key used in v9 (`ai-launcher:history`).

- [ ] **Step 2: Write `src/features/history/useHistory.ts`** — reads from localStorage, exposes `{ items, clear }`.

```ts
import { useEffect, useState } from "react";

export interface HistoryItem {
  cli: string;
  cliKey: string;
  directory: string;
  args: string;
  timestamp: string;
}

const KEY = "ai-launcher:history";

export function useHistory(): { items: HistoryItem[]; clear: () => void } {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const clear = () => {
    window.localStorage.removeItem(KEY);
    setItems([]);
  };

  return { items, clear };
}
```

- [ ] **Step 3: Write `src/features/history/HistoryList.tsx`** — a table using `<Card>` rows: columns `CLI | Directory | Args | When`.

- [ ] **Step 4: Write `HistoryPage.tsx`** — page title, clear button, list.

- [ ] **Step 5: Wire into `App.tsx`, commit**

```bash
git add src/features/history src/app/App.tsx
git commit -m "feat(v10): history page"
```

### Task 6.4: Costs page

**Files:**
- Create: `src/features/costs/CostsPage.tsx`
- Create: `src/features/costs/CostsPage.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Import preserved helpers**

`computeTodaySpend` and `shouldAlert` from `src/providers/budget.ts` still exist. Use them directly.

- [ ] **Step 2: Write `src/features/costs/CostsPage.tsx`** — shows total today, per-provider breakdown using `<Card>` tiles, budget alert banner when `shouldAlert()` is true.

- [ ] **Step 3: Write `src/features/costs/CostsPage.css`** — grid of cost tiles.

- [ ] **Step 4: Wire into `App.tsx`, commit**

```bash
git add src/features/costs src/app/App.tsx
git commit -m "feat(v10): costs page"
```

### Task 6.5: Admin page (sub-nav)

**Files:**
- Create: `src/features/admin/AdminPage.tsx`
- Create: `src/features/admin/AdminPage.css`
- Create: `src/features/admin/sections/ProvidersSection.tsx`
- Create: `src/features/admin/sections/PresetsSection.tsx`
- Create: `src/features/admin/sections/AppearanceSection.tsx`
- Create: `src/features/admin/sections/CliOverridesSection.tsx`
- Create: `src/features/admin/sections/CustomIdesSection.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write `src/features/admin/AdminPage.tsx` with sub-nav state**

```tsx
import { useState } from "react";
import "./AdminPage.css";
import { AppearanceSection } from "./sections/AppearanceSection";
import { CliOverridesSection } from "./sections/CliOverridesSection";
import { CustomIdesSection } from "./sections/CustomIdesSection";
import { PresetsSection } from "./sections/PresetsSection";
import { ProvidersSection } from "./sections/ProvidersSection";

type Section = "providers" | "presets" | "appearance" | "overrides" | "custom-ides";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "providers", label: "Providers" },
  { id: "presets", label: "Presets" },
  { id: "appearance", label: "Appearance" },
  { id: "overrides", label: "CLI Overrides" },
  { id: "custom-ides", label: "Custom IDEs" },
];

export function AdminPage() {
  const [active, setActive] = useState<Section>("providers");

  return (
    <section className="cd-admin">
      <header className="cd-admin__head">
        <h2 className="cd-admin__title">▎ ADMIN</h2>
        <p className="cd-admin__sub">Full access — handle credentials with care.</p>
      </header>

      <nav className="cd-admin__nav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`cd-admin__tab${s.id === active ? " is-on" : ""}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="cd-admin__body">
        {active === "providers" && <ProvidersSection />}
        {active === "presets" && <PresetsSection />}
        {active === "appearance" && <AppearanceSection />}
        {active === "overrides" && <CliOverridesSection />}
        {active === "custom-ides" && <CustomIdesSection />}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `AdminPage.css`** — same title pattern, sub-nav as a row of chips with an active underline.

- [ ] **Step 3: Implement `AppearanceSection.tsx`**

Uses `useTheme`, `useAccent`, `FontId` + `applyFontStack` from `src/lib/appearance.ts`. Shows:
- Theme radio: dark / light (with preview swatches)
- Accent radio: red / amber / green / blue / violet (with color swatches)
- Font radio: mono / sans / mixed (labels only)

Each change updates the hook and calls the corresponding apply-function.

- [ ] **Step 4: Implement `ProvidersSection.tsx`**

Uses preserved helpers from `src/providers/storage.ts`: `loadProviders`, `saveProviders`, `setActive`. Renders the provider list with Enable/Disable toggles + env-var editor modals. Key behavior must match v9 semantically (use `src/App.v9.tsx.bak` as reference for expected flow).

- [ ] **Step 5: Implement `PresetsSection.tsx`**

Uses `src/presets/storage.ts` helpers: `loadPresets`, `addPreset`, `updatePreset`, `removePreset`, `generatePresetId`. List presets, allow create/edit/delete.

- [ ] **Step 6: Implement `CliOverridesSection.tsx`**

Uses `src/lib/clisOverrides.ts` helpers. List CLIs, allow setting a custom name/icon via `CliOverrideModal` (built in Phase 7).

- [ ] **Step 7: Implement `CustomIdesSection.tsx`**

Uses `src/lib/customIdes.ts` helpers: `loadCustomIdes`, `addCustomIde`, `removeCustomIde`. List custom IDEs, add/remove via `CustomIdeModal` (built in Phase 7).

- [ ] **Step 8: Wire Admin into `App.tsx`, commit**

```bash
git add src/features/admin src/app/App.tsx
git commit -m "feat(v10): admin page with 5 sub-sections"
```

### Task 6.6: Help page

**Files:**
- Create: `src/features/help/HelpPage.tsx`
- Create: `src/features/help/HelpPage.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write `HelpPage.tsx` with static content**: sections `Getting Started`, `Keyboard Shortcuts`, `Troubleshooting`, `Links`. Use mono headings + sans body.

- [ ] **Step 2: Wire, commit**

```bash
git add src/features/help src/app/App.tsx
git commit -m "feat(v10): help page"
```

### Task 6.7: Onboarding flow

**Files:**
- Create: `src/features/onboarding/OnboardingPage.tsx`
- Create: `src/features/onboarding/OnboardingPage.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Add an `ai-launcher:onboarding-done` boolean to localStorage**

If not set, render `<OnboardingPage />` instead of the main app shell.

- [ ] **Step 2: Write `OnboardingPage.tsx` with 3 steps**

Step 1: Welcome — "This launcher runs with full system access." Step 2: Pick accent + theme. Step 3: Scan CLIs (calls `get_all_clis` + `check_all_clis`, shows progress). Final: "Done" button sets the localStorage flag and returns to the main shell.

- [ ] **Step 3: Commit**

```bash
git add src/features/onboarding src/app/App.tsx
git commit -m "feat(v10): onboarding flow"
```

---

## Phase 7 — Modals

### Task 7.1: CommandPalette

**Files:**
- Create: `src/features/command-palette/CommandPalette.tsx`
- Create: `src/features/command-palette/CommandPalette.css`
- Modify: `src/app/App.tsx` (wire `onCommand` prop to open the palette, and ⌘K keyboard shortcut)

- [ ] **Step 1: Use `cmdk` (already installed)**

Build a `<Command.Dialog>` wrapper styled with Command Deck tokens. Command groups: Launch CLIs, Navigate (tabs), Theme, Accent, Providers, Presets, Open file, Help.

- [ ] **Step 2: Keyboard shortcut**

In `App.tsx`, add a `useEffect` binding `⌘K` / `Ctrl+K` to open the palette. Esc closes.

- [ ] **Step 3: Smoke test, commit**

```bash
git add src/features/command-palette src/app/App.tsx
git commit -m "feat(v10): command palette"
```

### Task 7.2: Remaining modals

**Files:**
- Create: `src/features/modals/QuickSwitchModal.tsx`
- Create: `src/features/modals/DryRunModal.tsx`
- Create: `src/features/modals/CustomIdeModal.tsx`
- Create: `src/features/modals/CliOverrideModal.tsx`
- Create: `src/features/modals/HelpModal.tsx`

For each modal, build on top of `src/ui/Dialog.tsx`, preserve the exact props/behavior the v9 versions had (reference `src/providers/*.tsx` and `src/App.v9.tsx.bak`). Visual layer is new, behavior and data contracts are preserved.

- [ ] **Step 1: Port `QuickSwitchModal`**: provider switcher, Tauri event listener to `quick-switch-request`, enabled toggles in mono rows.

- [ ] **Step 2: Port `DryRunModal`**: shows the launch command that would run (with redacted env), has a "Launch anyway" and "Copy command" button.

- [ ] **Step 3: Port `CustomIdeModal`**: form to register a custom IDE (name, command, optional install URL).

- [ ] **Step 4: Port `CliOverrideModal`**: set a per-CLI name/icon override.

- [ ] **Step 5: Port `HelpModal`**: shortcut sheet (invoked by `?`).

- [ ] **Step 6: Wire each modal at the `App.tsx` level using `useState<open>()` flags or a small context, commit after each port**

```bash
git add src/features/modals
git commit -m "feat(v10): modals rewritten on new Dialog primitive"
```

---

## Phase 8 — Admin unification

### Task 8.1: Remove `adminMode`

**Files:**
- Modify: `src/app/App.tsx` (no adminMode state, no guards)
- Modify: `src/lib/appSettings.ts` (remove `adminMode` field if present, keep back-compat read but ignore on write)
- Grep: entire `src/` for any remaining `adminMode` / `admin_mode` references

- [ ] **Step 1: Confirm no adminMode state in new App.tsx**

```bash
grep -n "adminMode\|admin_mode" src/app/App.tsx
```

Expected: zero matches.

- [ ] **Step 2: Strip `adminMode` from `AppSettings` type**

Find the `AppSettings` interface in `src/lib/appSettings.ts`. Remove the `adminMode` property. On load, ignore the stored field if present (no data loss — persisted settings without `adminMode` remain valid).

- [ ] **Step 3: Confirm Rust backend always grants full access**

Read `src-tauri/src/main.rs` — search for conditional logic on an "admin" flag passed from the frontend. If such logic exists, change the default to always-on.

```bash
grep -n "admin" src-tauri/src/main.rs | head -20
```

If matches found, replace conditional paths with the always-admin path.

- [ ] **Step 4: Type-check, smoke test**

```bash
npx tsc --noEmit
npm run dev
```

Confirm: sidebar shows `● ADMIN · full access` chip, launching a CLI uses the admin launch path.

- [ ] **Step 5: Commit**

```bash
git add src src-tauri
git commit -m "feat(v10): unify admin — always-on, no toggle"
```

---

## Phase 9 — Delete v9 dead files

### Task 9.1: Remove v9 visual layer

**Files deleted:**

```
src/App.v9.tsx.bak            (backup — optional: keep until v10 release cut, then delete)
src/main.v9.tsx.bak
src/CommandPalette.tsx
src/CommandPalette.css
src/CostAggregator.tsx
src/CostAggregator.css
src/EmptyState.tsx
src/EmptyState.css
src/EmptyState.illustrations.tsx
src/ErrorBoundary.tsx
src/ErrorBoundary.css
src/Onboarding.tsx
src/Onboarding.css
src/Orchestrator.tsx
src/Orchestrator.css
src/Skeleton.tsx
src/Skeleton.css
src/styles.css
src/tabs/                     (entire folder)
src/layout/                   (entire folder)
src/styles/                   (entire folder)
src/providers/AppearanceSection.tsx
src/providers/AppearanceSection.css
src/providers/QuickSwitchModal.tsx
src/providers/DryRunModal.tsx
src/providers/CustomIdeModal.tsx
src/providers/CustomIdeModal.css
src/providers/CliOverrideModal.tsx
src/providers/CliOverrideModal.css
src/providers/CustomCliModal.tsx
src/providers/CustomCliModal.css
src/providers/AdminPanel.tsx
src/providers/providers.css
```

**Kept under `src/providers/`:**
```
src/providers/storage.ts
src/providers/types.ts
src/providers/budget.ts
```

- [ ] **Step 1: Delete files**

```bash
rm -rf src/tabs src/layout src/styles
rm -f src/CommandPalette.tsx src/CommandPalette.css
rm -f src/CostAggregator.tsx src/CostAggregator.css
rm -f src/EmptyState.tsx src/EmptyState.css src/EmptyState.illustrations.tsx
rm -f src/ErrorBoundary.tsx src/ErrorBoundary.css
rm -f src/Onboarding.tsx src/Onboarding.css
rm -f src/Orchestrator.tsx src/Orchestrator.css
rm -f src/Skeleton.tsx src/Skeleton.css
rm -f src/styles.css
rm -f src/providers/AppearanceSection.tsx src/providers/AppearanceSection.css
rm -f src/providers/QuickSwitchModal.tsx
rm -f src/providers/DryRunModal.tsx
rm -f src/providers/CustomIdeModal.tsx src/providers/CustomIdeModal.css
rm -f src/providers/CliOverrideModal.tsx src/providers/CliOverrideModal.css
rm -f src/providers/CustomCliModal.tsx src/providers/CustomCliModal.css
rm -f src/providers/AdminPanel.tsx
rm -f src/providers/providers.css
rm -f src/App.v9.tsx.bak src/main.v9.tsx.bak
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Both must pass. If type errors appear, they indicate a missing migration — fix each before committing.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(v10): remove v9 dead files"
```

---

## Phase 10 — Quality gates

### Task 10.1: Playwright smoke test

**Files:**
- Create: `tests/smoke.spec.ts`
- Modify: `package.json` (add `"test:e2e": "playwright test"` script + devDep if missing)

- [ ] **Step 1: Install Playwright if not present**

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write `tests/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("app boots, theme + accent toggle, tabs navigate", async ({ page }) => {
  await page.goto("http://localhost:5173");

  await expect(page.locator(".cd-side__name")).toContainText("AI LAUNCHER");
  await expect(page.locator(".cd-side__item--on")).toContainText("Launch");

  await page.locator(".cd-top__theme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.locator(".cd-top__acc--green").click();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "green");

  for (const tab of ["Tools", "History", "Costs", "Admin", "Help"]) {
    await page.getByRole("button", { name: tab }).first().click();
    await expect(page.locator(".cd-side__item--on")).toContainText(tab);
  }
});
```

- [ ] **Step 3: Add Playwright config `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  testDir: "tests",
  use: { headless: true },
});
```

- [ ] **Step 4: Run the smoke test**

```bash
npm run test:e2e
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add tests playwright.config.ts package.json package-lock.json
git commit -m "test(v10): playwright smoke for shell + theme + accent + tabs"
```

### Task 10.2: tsc + build gate

- [ ] **Step 1: Full build**

```bash
npx tsc --noEmit
npm run build
```

Both must pass with zero errors and zero warnings.

- [ ] **Step 2: Manual smoke-test checklist**

Run `npm run dev` and walk through:

- [ ] App boots in dark + red (default) without flashing.
- [ ] Sidebar navigation works for all 6 tabs.
- [ ] Toggle theme dark/light — all pages remain legible.
- [ ] Switch accent red/amber/green/blue/violet — status chips, focus rings, LED dots update.
- [ ] `⌘K` opens the command palette; selecting a command works.
- [ ] Launcher detects CLIs and can launch one.
- [ ] Tools detects IDEs.
- [ ] Admin → Appearance: change theme + accent + font persists across reload.
- [ ] Admin → Providers: edit a provider, save, reload — changes persist.
- [ ] Onboarding shows first-run; completing it skips on subsequent boots.

---

## Phase 11 — Documentation

### Task 11.1: CHANGELOG v10.0.0

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Prepend new section to `CHANGELOG.md`**

```markdown
## [10.0.0] — 2026-04-22 — Command Deck

### Changed (breaking visual rewrite)
- Entire frontend rewritten from scratch in the **Command Deck** visual direction.
- New architecture: `src/app/`, `src/ui/`, `src/features/`, `src/theme/`, `src/icons/`.
- Theme system: dark (default) + light (Hard Light), attribute-based, pre-paint restore.
- Accent system: 5 selectable accents (red default, amber, green, blue, violet).
- Typography: self-hosted JetBrains Mono + Inter.
- Tools tab **restored** — the IDE management surface is back as a first-class tab.
- Admin unified — no more "non-admin" mode. One build, always full access.
- Icon set rewritten — 24×24 line-art glyphs using `currentColor`, coherent with the Command Deck aesthetic.

### Removed
- v9 "Soft Workbench" components, styles, and tabs.
- `adminMode` toggle and all conditional non-admin code paths.

### Preserved
- Rust backend (`src-tauri/`) and all `invoke` contracts.
- Persistence keys and shapes for providers, presets, custom IDEs, CLI overrides, budget history.
- i18n strings and bilingual support (en + pt-BR).
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(v10): changelog entry for 10.0.0"
```

### Task 11.2: README rewrite + ASCII banner

**Files:**
- Modify: `README.md`
- Modify: `README.pt-BR.md`

- [ ] **Step 1: Prepend ASCII banner to both READMEs**

```markdown
```text
   ┌─ AI LAUNCHER ─────────────────────── v10.0.0 ──┐
   │                                                 │
   │   ▎ COMMAND DECK                                │
   │                                                 │
   │   ● claude-code   online    v2.1.0              │
   │   ● codex         online    v1.4.2              │
   │   ○ gemini        missing                       │
   │   ● qwen          online    v0.9.1              │
   │   ▲ aider         update    v0.5 → v0.6         │
   │   ● cursor        online    v0.42               │
   │                                                 │
   │   5/8 online        ● ADMIN        $0.42 today  │
   └─────────────────────────────────────────────────┘
```
```

(Ensure fenced code block is properly escaped — if you see `\`\`\`text` in the rendered markdown, drop one backtick layer.)

- [ ] **Step 2: Rewrite the English README body**

Sections:
1. Hero (banner + one-sentence pitch).
2. What is it (1 paragraph — a Tauri desktop launcher for AI coding CLIs and IDEs).
3. Screenshots (4 — see Task 11.3).
4. Install (prerequisites + `npm run tauri build` or download the `.msi`).
5. Usage (⌘K, sidebar, admin mode note).
6. Customize (theme, accent, font, overrides).
7. What's new in v10 (bullet list from the CHANGELOG).
8. Contributing + License (MIT).

- [ ] **Step 3: Rewrite `README.pt-BR.md` with the same structure in pt-BR**

- [ ] **Step 4: Commit**

```bash
git add README.md README.pt-BR.md
git commit -m "docs(v10): rewrite READMEs with command deck banner"
```

### Task 11.3: Screenshots

**Files:**
- Create: `docs/screenshots/01-launcher.svg`
- Create: `docs/screenshots/02-admin.svg`
- Create: `docs/screenshots/03-costs.svg`
- Create: `docs/screenshots/04-themes.svg`
- Create: `docs/screenshots/01-launcher.png` (real)
- Create: `docs/screenshots/02-admin.png` (real)
- Create: `docs/screenshots/03-costs.png` (real)

- [ ] **Step 1: Generate 4 editorial SVG mockups**

Each SVG is a stylized screenshot at 1280×800 showing a Command Deck surface. Use the `.superpowers/brainstorm/.../content/direction.html` mockups as a visual reference — the same chrome, actual-looking data, different surface per SVG.

Content:
1. `01-launcher.svg` — dashboard with CLIs grid, sidebar, red accent.
2. `02-admin.svg` — admin with providers list, green accent.
3. `03-costs.svg` — budget dashboard, blue accent.
4. `04-themes.svg` — side-by-side dark vs Hard Light.

- [ ] **Step 2: Take real PNG screenshots from the running app**

```bash
npm run dev &
npx playwright test tests/screenshots.spec.ts
```

Create `tests/screenshots.spec.ts`:

```ts
import { test } from "@playwright/test";

test.describe("screenshots", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("launcher", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForSelector(".cd-launcher__grid");
    await page.screenshot({ path: "docs/screenshots/01-launcher.png" });
  });

  test("admin", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.getByRole("button", { name: "Admin" }).first().click();
    await page.waitForSelector(".cd-admin__nav");
    await page.screenshot({ path: "docs/screenshots/02-admin.png" });
  });

  test("costs", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.getByRole("button", { name: "Costs" }).first().click();
    await page.screenshot({ path: "docs/screenshots/03-costs.png" });
  });
});
```

- [ ] **Step 3: Reference screenshots in both READMEs**

Add a Screenshots section with image links to `docs/screenshots/*.svg` (hero) and `docs/screenshots/*.png` (real).

- [ ] **Step 4: Commit**

```bash
git add docs/screenshots tests/screenshots.spec.ts README.md README.pt-BR.md
git commit -m "docs(v10): screenshots + gallery in READMEs"
```

---

## Phase 12 — Release

### Task 12.1: Version bump

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Bump to 10.0.0**

Edit each file and change the version string:
- `package.json`: `"version": "10.0.0"`
- `src-tauri/tauri.conf.json`: `"version": "10.0.0"`
- `src-tauri/Cargo.toml`: `version = "10.0.0"`

- [ ] **Step 2: Commit**

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "build(v10): bump to 10.0.0"
```

### Task 12.2: Local Windows release build

- [ ] **Step 1: Build**

```bash
npm run tauri build
```

Expected: Windows `.msi` and `.exe` emitted to `src-tauri/target/release/bundle/msi/` and `.../nsis/`.

- [ ] **Step 2: Sanity-run**

Launch the produced `.exe` on the dev machine, walk through the manual smoke checklist from Task 10.2.

### Task 12.3: Tag + push + GitHub release

- [ ] **Step 1: Tag**

```bash
git tag -a v10.0.0 -m "v10.0.0 — Command Deck"
git push origin main --tags
```

- [ ] **Step 2: Extract release notes**

```bash
awk '/^## \[10.0.0\]/,/^## \[/ { if (/^## \[/ && !/10.0.0/) exit; print }' CHANGELOG.md > .release-notes.md
```

- [ ] **Step 3: Create the GitHub release and attach the `.msi`**

```bash
MSI=$(ls src-tauri/target/release/bundle/msi/*.msi | head -1)
gh release create v10.0.0 \
  --title "v10.0.0 — Command Deck" \
  --notes-file .release-notes.md \
  "$MSI"
```

- [ ] **Step 4: Clean up**

```bash
rm -f .release-notes.md
```

- [ ] **Step 5: Verify**

Open the GitHub release URL printed by `gh release create` and confirm the release is published with the `.msi` attached.

---

## Self-review notes

- **Spec coverage:** §§1–16 of the spec each map to at least one task above. Explicit mappings:
  - Spec §4 (visual direction) → Phase 1 (tokens) + Phase 2 (primitives) + Phase 3 (shell).
  - Spec §5 (IA) → Phase 3 (sidebar with TabId) + Phase 6 (feature pages).
  - Spec §6 (folder layout) → Phases 1–9 collectively create the target structure.
  - Spec §7 (tokens) → Task 1.1.
  - Spec §8 (primitives) → Phase 2.
  - Spec §9 (icons) → Phase 4.
  - Spec §10 (theming runtime) → Tasks 1.3, 1.4, 3.1 (TopBar), 6.5 (AppearanceSection).
  - Spec §11 (admin unification) → Phase 8.
  - Spec §12 (release plan) → Phases 10 (quality), 11 (docs), 12 (release).
  - Spec §13 (testing) → Task 10.1 + Task 10.2.
  - Spec §14 (risks) → mitigations are baked in (fonts self-hosted, localStorage keys preserved, Hard Light has easy theme toggle, build smoke in Task 12.2).
  - Spec §15 (out of scope) → no tasks created for those items.
  - Spec §16 (deliverables checklist) → every checkbox maps to a task; final verification is Task 10.2.
- **Placeholders:** none — every step contains the code/command needed. The two places that note "verify exact Rust command names against `src-tauri/src/main.rs`" are deliberate (the exact `tauri::generate_handler!` list needs live inspection; the plan tells the engineer which file to check).
- **Type consistency:** `TabId`, `Theme`, `Accent`, `CliInfo`, `ToolInfo`, `HistoryItem` are defined once and consumed consistently. `FontId` keeps its v9 name/values through migration (Task 5.1).
