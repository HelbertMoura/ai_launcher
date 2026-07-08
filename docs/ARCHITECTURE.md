# AI Launcher Pro — Architecture

Technical reference for contributors. For user-facing docs, see [README.md](../README.md).

**Stack:** Tauri v2, React 19, TypeScript, Rust, Vite, Vitest and Playwright.

## Directory Layout

```text
ai-launcher-tutra/
├── src/                      # React frontend
│   ├── app/                  # App shell, layout, onboarding and boot wiring
│   ├── features/             # Product surfaces grouped by domain
│   │   ├── command-center/   # v20 home, workspace intelligence and quick actions
│   │   ├── launcher/         # CLI cards, launch dialogs and launch history
│   │   ├── workspace/        # Workspaces, runbooks, doctor and agent profiles
│   │   ├── mcp/              # MCP catalog, CRUD and project-scoped health
│   │   ├── history/          # Sessions dashboard, filters, replay and kill flow
│   │   ├── costs/            # Usage analytics and budget views
│   │   ├── updates/          # App updater and release trust indicators
│   │   └── tools/            # IDE/tool detection and launch
│   ├── ui/                   # Shared primitives
│   ├── hooks/                # Shared React hooks
│   ├── lib/                  # Storage, config IO, project profiles and Tauri guards
│   ├── providers/            # Provider state, budgets and launch env helpers
│   ├── theme/                # Current theme tokens and variants
│   └── i18n/                 # en and pt-BR dictionaries
├── src-tauri/                # Rust backend, Tauri config and Windows icons
├── public/                   # Runtime fonts and public icon assets
├── docs/                     # Current public docs and release notes
├── e2e/                      # Playwright smoke/a11y tests
├── scripts/                  # Release audit and latest.json helpers
└── .github/workflows/        # CI, quality and release automation
```

## Frontend Patterns

- State is local React state plus small module stores. There is no Redux/Zustand/Jotai layer.
- Tauri boot reads that must also work in browser QA use `invokeOrFallback` from `src/lib/tauri.ts`.
- Launching built-in CLIs should go through `launchCliSession` in `src/features/launcher/launchSession.ts`.
- Persistent user data uses namespaced `localStorage` keys and the storage registry.
- i18n keys must be added to `src/i18n/locales/pt-BR.ts` first, then mirrored in `en.ts`.

## Backend Patterns

- Tauri commands live under `src-tauri/src/commands/` and are registered in `src-tauri/src/main.rs`.
- Command parameters use camelCase from TypeScript and snake_case in Rust.
- Workspace/file operations validate paths server-side before reading or writing.
- Long-running or shell-adjacent work uses bounded execution, sanitization and explicit error strings.
- Session tracking is implemented in `commands/session.rs`; detached Windows Terminal launches are recorded as detached.

## Quality Gates

```bash
npx tsc --noEmit
npm test
npm run build
npm run e2e
cd src-tauri && cargo fmt --check
cd src-tauri && cargo clippy --no-deps -- -D warnings
cd src-tauri && cargo test
```

The GitHub quality workflow covers typecheck, Vitest, Rust fmt/clippy/tests, cargo audit and Playwright.

## Release Process

1. Update versions in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`.
2. Update `CHANGELOG.md` and `docs/releases/vX.Y.Z.md`.
3. Run the local quality gates and Tauri build.
4. Push the tag `vX.Y.Z`; `.github/workflows/release.yml` builds MSI/NSIS, uploads checksums and generates `latest.json`.
5. Run `scripts/audit-release.sh vX.Y.Z` after the GitHub release finishes.
