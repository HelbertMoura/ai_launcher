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

# Dev loop
npm run tauri dev
```

The first `tauri dev` will invoke `cargo` and download Rust crates. Budget 5-10
minutes on a cold cache.

---

## 3. Build

```bash
# Frontend-only (Vite) bundle
npm run build

# Full app installer (Windows .msi/.exe)
npm run tauri build
```

Release builds are produced by the GitHub release workflow from version tags.

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
- Co-locate `.css` next to its `.tsx` (see `src/features/*/*.tsx` + matching CSS).
- Feature folders under `src/features/` own their view-models, stores and tests.

### Immutability

- Never mutate props or store state — use spread (`{ ...state, foo: 1 }`) and
  `new Set(prev)` style updates.
- Providers state in particular is written with immutable patterns end to end;
  follow the precedent.

### Styling

- Design tokens only. Avoid literal colors outside provider brand/icon definitions.
- The mono stack is the default. Only reach for `--ff-ui` when copy is clearly
  marketing/long-form.
- UI copy is lowercase (except brand names). No emoji in product chrome.

### Accessibility

- Every `<button>` has `type="button"` unless it is a real form submit.
- Icon-only buttons carry an `aria-label`. Use the shared icon wrappers/assets
  already present in `src/ui/` and `public/icons/`.
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
refactor(workspace): extract runbook summary model
docs: update architecture and contributor docs
```

Do not squash unrelated changes into a single commit. Each commit should stand
on its own.

---

## 6. Pull request process

1. Branch from `main` with a descriptive name (`feat/costs-sparkline`,
   `fix/tray-hotkey-empty`).
2. Run the full gate locally before pushing (see [§7](#7-pre-commit-checks)).
3. UI-visible changes must attach screenshots (both dark and light themes where
   the change affects both).
4. Describe what the user will notice, not just what the diff does.

Merge strategy: rebase-merge preferred, to keep `main` linear.

---

## 7. Pre-commit checks

Every PR must pass these four gates locally before requesting review:

```bash
# 1. TypeScript — strict, no errors
npx tsc --noEmit

# 2. Frontend build
npm run build

# 3. Frontend tests
npm test

# 4. Rust lint — no warnings
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# 5. Rust tests
cargo test --manifest-path src-tauri/Cargo.toml
```

Additional guardrails:

- No literal colors outside provider brand dots.
- No `console.log` in merged code.
- No new emoji in product chrome.
- Files stay under 800 lines.

Secrets check: if you touched anything under `src/providers/`, grep the diff for
`sk-`, `Bearer`, or hardcoded tokens before pushing.

---

## 8. Areas that welcome contributions

Open lanes for the next milestones:

- **More providers.** New `ProviderKind` entries with seeds and storage support.
  See `src/providers/types.ts`, `src/providers/seeds.ts` and `src/providers/storage.ts`.
- **More CLIs / tools.** Registered in `get_cli_definitions()` /
  `get_tool_definitions()` in `src-tauri/src/util.rs`.
- **Theme work.** Alternative variants or focused accessibility improvements —
  current tokens live under `src/theme/`.
- **Tests.** Add focused Vitest tests next to new pure helpers/stores and keep
  Playwright coverage for boot, navigation and accessibility smoke checks.
- **Accessibility audit.** Keyboard traps, focus order on modals, screen-reader
  landmarks. Automation via Playwright + `@axe-core/playwright` is welcome.
- **Rust module split.** Keep command handlers small and move reusable logic to
  `src-tauri/src/util.rs` or a dedicated module when it grows.

Before starting a non-trivial contribution, open an issue or a draft PR so we
can align on direction.
