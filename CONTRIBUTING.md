# Contributing to AI Launcher Pro

Thanks for taking the time to dig into the code. This guide covers how to run the
app locally, the conventions we expect in pull requests, and the pre-merge gates
every change has to clear.

---

## 1. Prerequisites

| Tool        | Minimum | Notes                                                     |
| ----------- | ------- | --------------------------------------------------------- |
| Node.js     | 20.x    | Use an LTS line; the repo has been verified on 20 and 22. |
| npm         | 10.x    | Ships with Node 20+. No pnpm/yarn configuration today.    |
| Rust        | 1.75+   | Via [`rustup`](https://rustup.rs). Needs the MSVC toolchain on Windows. |
| Tauri CLI   | v2      | Installed via `npm install` (`@tauri-apps/cli`).          |

Windows is the primary development platform; the bundler targets an `.msi`/`.exe`
installer. Cross-platform support is tracked but not guaranteed on every release.

---

## 2. Setup

```bash
# From repo root
npm install

# Dev loop — public build (no admin UI)
npm run tauri dev

# Dev loop — admin build (provider CRUD + diagnostics)
VITE_ADMIN_MODE=1 npm run tauri dev
```

The first `tauri dev` will invoke `cargo` and download Rust crates. Budget 5-10
minutes on a cold cache.

---

## 3. Build

```bash
# Frontend-only (Vite) bundle
npm run build

# Admin frontend bundle
VITE_ADMIN_MODE=1 npm run build

# Full app installer (Windows .msi/.exe)
npm run tauri build
```

The admin bundle and the public bundle are **separate artifacts**. Never ship an
admin bundle to a public release channel.

---

## 4. Coding conventions

### TypeScript

- Strict mode is on; no `any`. Use `unknown` + narrowing for untrusted input.
- Prefer union literal types (`type HeaderTabId = 'launcher' | 'history' | ...`)
  over free-form strings.
- Exported functions carry explicit parameter and return types; local inference
  is fine for obvious cases.
- React components use a named `interface …Props`; don't use `React.FC`.

### File organization

- Files under **800 lines**. Extract modules when you see a file pushing that cap.
- Co-locate `.css` next to its `.tsx` (see `src/layout/HeaderBar.{tsx,css}`).
- Feature folders (`providers/`, `presets/`, `tabs/`) own their types, storage,
  and view.

### Immutability

- Never mutate props or store state — use spread (`{ ...state, foo: 1 }`) and
  `new Set(prev)` style updates.
- Providers state in particular is written with immutable patterns end to end;
  follow the precedent.

### Styling

- Design tokens only. No literal colors outside provider brand dots in
  `src/providers/*.tsx`.
- The mono stack is the default. Only reach for `--ff-ui` when copy is clearly
  marketing/long-form.
- UI copy is lowercase (except brand names). No emoji in product chrome.

### Accessibility

- Every `<button>` has `type="button"` unless it is a real form submit.
- Icon-only buttons carry an `aria-label`. Reach for the icons in
  `src/icons/index.ts`; never import `lucide-react` directly.
- `:focus-visible` styles use the `--ring` token; don't override with a
  bespoke outline.
- Headings (`<h1>..<h4>`) are real headings, not styled spans.

### Logging

- No `console.log` in merged code. Temporary debug output must be stripped
  before commit.

---

## 5. Commit convention

We follow Conventional Commits. Scope is optional but encouraged:

```
<type>(<scope>): <subject>

<body wrapped at 72 cols, explaining why (not what)>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Examples:

```
feat(launcher): redesign CLI cards as terminal panes
refactor(split): extract HeaderBar from App.tsx
docs: add VISUAL_SYSTEM + ARCHITECTURE + CONTRIBUTING for v5.5
```

Do not squash unrelated changes into a single commit. Each commit should stand
on its own.

---

## 6. Pull request process

1. Branch from `main` with a descriptive name (`feat/costs-sparkline`,
   `fix/tray-hotkey-empty`).
2. If the PR maps to a task in `docs/superpowers/plans/...`, reference the task
   number in the PR body.
3. Run the full gate locally before pushing (see [§7](#7-pre-commit-checks)).
4. UI-visible changes must attach screenshots (both dark and light themes where
   the change affects both).
5. Describe what the user will notice, not just what the diff does.

Merge strategy: rebase-merge preferred, to keep `main` linear.

---

## 7. Pre-commit checks

Every PR must pass these four gates locally before requesting review:

```bash
# 1. TypeScript — strict, no errors
npx tsc --noEmit

# 2. Frontend build — Vite must produce both public and admin bundles
npm run build
VITE_ADMIN_MODE=1 npm run build

# 3. Rust lint — no warnings
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# 4. Rust compile
cargo check --manifest-path src-tauri/Cargo.toml
```

Additional guardrails enforced by the v5.5 plan:

- No literal colors outside provider brand dots.
- No direct `lucide-react` imports (always via `src/icons/index.ts`).
- No `console.log` in merged code.
- No new emoji in product chrome.
- Files stay under 800 lines.

Secrets check: if you touched anything under `src/providers/`, grep the diff for
`sk-`, `Bearer`, or hardcoded tokens before pushing.

---

## 8. Areas that welcome contributions

Open lanes for the next milestones:

- **More providers.** New `ProviderKind` entries with seeds and docs links.
  See `src/providers/seeds.ts` + `docsLinks.ts`.
- **More CLIs / tools.** Registered in `get_cli_definitions()` /
  `get_tool_definitions()` in `src-tauri/src/main.rs`.
- **Theme work.** Alternative light variants or a true high-contrast theme —
  all new tokens land in `src/styles/tokens-*.css`.
- **Tests.** There are no unit tests today. A Vitest scaffold around
  `providers/costEstimator.ts`, `providers/budget.ts`, `providers/storage.ts`,
  and `lib/configIO.ts` would pay off immediately.
- **Accessibility audit.** Keyboard traps, focus order on modals, screen-reader
  landmarks. Automation via Playwright + `@axe-core/playwright` is welcome.
- **Rust module split.** `src-tauri/src/main.rs` is a single file by historical
  accident. Extracting `commands/`, `cli_defs/`, and `tray.rs` is tracked in
  the v5.5 retrospective.

Before starting a non-trivial contribution, open an issue or a draft PR so we
can align on direction.
