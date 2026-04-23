# AI Launcher Pro — Architecture

> Technical reference for contributors. For user-facing docs, see [README.md](../README.md).

**Stack:** Tauri v2 · React 19 · TypeScript · Rust · Vite · Vitest · Playwright

## Directory layout

```
ai-launcher-tutra/
├── src/                      # React frontend
│   ├── app/                  # App shell: App.tsx, layout/, onboarding, CSS
│   ├── features/             # Feature modules, one folder per surface
│   │   ├── launcher/         # LauncherPage, CliCard, LaunchDialog, stores
│   │   ├── tools/            # ToolsPage
│   │   ├── history/          # HistoryPage, useHistory
│   │   ├── costs/            # CostsPage, useUsage
│   │   ├── admin/            # AdminPage + 5 section editors
│   │   ├── updates/          # UpdatesPage
│   │   ├── prereqs/          # PrereqsPage
│   │   ├── help/             # HelpPage, AnimatedTerminal
│   │   ├── onboarding/       # OnboardingPage
│   │   └── command-palette/  # Ctrl+K palette
│   ├── ui/                   # Shared primitives (Button, Dialog, Toggle, ...)
│   ├── hooks/                # useTheme, useAccent, useUpdates
│   ├── lib/                  # configIO (import/export), notifications, exportData
│   ├── providers/            # ProvidersState, buildLaunchEnv
│   ├── theme/                # tokens.css, accents.css
│   └── i18n/                 # i18next config + en.ts + pt-BR.ts
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # ~120 lines: builder + invoke_handler
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── cli.rs        # 9 CLI-related commands
│   │   │   ├── tools.rs      # 5 tool-related commands
│   │   │   ├── updates.rs    # 7 update-check commands
│   │   │   ├── config.rs     # 6 config/usage commands
│   │   │   └── system.rs     # 7 window/tray/hotkey commands
│   │   ├── tray.rs           # setup_tray() + menu handlers
│   │   ├── util.rs           # strip_ansi, parse_version, timeouts, definitions
│   │   └── errors.rs         # AppError (thiserror) + AppResult
│   ├── capabilities/         # Tauri permissions
│   └── Cargo.toml            # Rust deps + metadata
├── e2e/                      # Playwright specs
├── docs/                     # This doc + CHANGELOG.md + archive/
└── .github/workflows/        # build.yml, release.yml, quality.yml
```

## Frontend patterns

### State management

The project does **not** use Redux/Zustand/Jotai. Patterns in use:

- **`useState` / `useReducer`** for local component state. `LaunchDialog` uses a reducer; most others use `useState`.
- **Module-level stores** (`clisStore.ts`, `toolsStore.ts`) with `useSyncExternalStore` + `sessionStorage` TTL cache (10 min). Pattern: exported singleton with `subscribe`, `getSnapshot`, `invalidate`.
- **`localStorage`-backed hooks** (`useHistory`, `useAccent`, `useTheme`, custom `ai-launcher:*` keys) for persisted user prefs.

### Tauri invoke

All backend commands are typed and invoked via `@tauri-apps/api/core`:

```ts
import { invoke } from "@tauri-apps/api/core";
const clis = await invoke<CliInfo[]>("get_all_clis");
```

Command list is the source of truth in `src-tauri/src/commands/*.rs` — adding a new command requires:

1. Write the Rust function with `#[tauri::command]` in the appropriate module.
2. Add to the `tauri::generate_handler![...]` list in `src-tauri/src/main.rs`.
3. Call from frontend with matching name + parameter casing (camelCase → snake_case is automatic).

### i18n

Keys live in `src/i18n/locales/en.ts` and `src/i18n/locales/pt-BR.ts`. New keys **must** be added to both locales. Use `useTranslation()` from `react-i18next` and reference keys via `t("namespace.key")`. Interpolation via `t("key", { name: value })`.

## Backend patterns

### Modules

Each file in `src-tauri/src/commands/` groups related `#[tauri::command]` functions. Keep commands thin — move heavy logic to `util.rs` or a dedicated helper module.

### Error handling

- Commands return `Result<T, String>` (Tauri's required shape today).
- Internal helpers can use `AppResult<T>` (from `errors.rs`) which is `Result<T, AppError>` with `thiserror`-derived variants.
- Migration to `AppResult` is incremental. `From<tauri::Error>` for `AppError` is a future addition.

### Process execution

```rust
util::run_with_timeout(cmd, args, timeout_ms, workdir)
```

Timeouts are enforced via `tokio::time::timeout`. On expiration, stuck processes are killed via `taskkill /PID /T /F` on Windows. `strip_ansi` is applied to captured stdout/stderr.

### Tray + hotkey

- `tray.rs::setup_tray()` builds the `TrayIconBuilder` with menu items and click handlers.
- Global hotkey (default `CommandOrControl+Alt+Space`) is registered via `tauri-plugin-global-shortcut` and persisted to a config file. Rebinding via `set_tray_hotkey` unregisters the old shortcut and registers the new one atomically.

## Testing

### Frontend (Vitest)

```bash
npm test            # one-shot
npm run test:watch  # watch mode
```

- `jsdom` environment. Setup in `src/test/setup.ts` mocks `@tauri-apps/api/core.invoke` globally.
- Tests co-locate next to source: `useHistory.test.ts`, `configIO.test.ts`, `pinnedDirs.test.ts`, `sessionTemplates.test.ts`, `exportData.test.ts`, `useAccent.test.ts`.

### Backend (cargo test)

```bash
cd src-tauri && cargo test
```

Unit tests live in `src-tauri/src/util.rs` under `#[cfg(test)] mod tests`. 8 tests currently cover `strip_ansi` and `parse_version` edge cases.

### E2E (Playwright)

```bash
npm run e2e         # headless
npm run e2e:ui      # interactive
```

Spec at `e2e/launcher.spec.ts`. Spins up Vite dev server (`vite`) and stubs `window.__TAURI_INTERNALS__.invoke` — real Tauri backend is NOT exercised.

## CI quality gates

`.github/workflows/quality.yml` runs 5 parallel jobs on every PR and push to `main` or `release/**`:

| Job         | Command                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| tsc         | `npx tsc --noEmit`                                                                 |
| vitest      | `npm test`                                                                         |
| cargo       | `cargo fmt --check` + `cargo clippy --no-deps -- -D warnings` + `cargo test`       |
| cargo-audit | `cargo audit` (via `cargo install cargo-audit --locked`)                           |
| e2e         | `npm run e2e` (Playwright chromium)                                                |

## Release process

1. All changes land on `release/v14` (or `release/vN` for major releases).
2. Version bumps in 3 files: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
3. `CHANGELOG.md` entry under the new version header.
4. Tag `vX.Y.Z` and push `--tags` — triggers `.github/workflows/release.yml` which builds MSI and publishes a GitHub release.
5. Merge `release/v14` → `main`.

## Known limitations (roadmap)

- **Self-updater** — `tauri-plugin-updater` is not wired yet. Needs signing key + `release.yml` changes. Planned for v14.1.
- **Session-end notifications** — `launch_cli` spawns detached via `wt.exe`; tracking child exit requires retaining handles + async monitor tasks. Planned for v14.1.
- **`util.rs` size** — ~1070 lines (CLI/tool definitions + helpers + tests). Split candidates: `definitions.rs`, `types.rs`. Non-blocking.
