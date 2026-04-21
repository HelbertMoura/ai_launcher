# Architecture — AI Launcher Pro

> Snapshot of the runtime layout on branch `v5.5-terminal-dramatico`. When in doubt,
> the source files cited here are the ground truth — this doc should be updated
> whenever a command, storage key, or directory moves.

---

## 1. High-level stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Shell        | [Tauri v2](https://tauri.app/) (Windows installer target) |
| Backend      | Rust 2021 edition, `tokio` async runtime          |
| Frontend     | React 19 + TypeScript (strict) + Vite 8           |
| CSS          | Hand-written CSS with design tokens (no utility framework) |
| Icons        | `lucide-react` via curated re-export              |
| Command menu | `cmdk`                                            |
| IPC          | `@tauri-apps/api` `invoke()` + event channel      |

Key Rust crates (see `src-tauri/Cargo.toml`):

- `tauri`, `tauri-plugin-shell`, `tauri-plugin-dialog`, `tauri-plugin-global-shortcut`
- `tokio` (process, io-util, sync), `serde`/`serde_json`
- `ureq` (HTTP for GitHub releases + provider tests), `base64`, `regex-lite`
- `dirs`, `open`, `chrono`

---

## 2. Directory map

### `src/` (frontend)

```
src/
├── App.tsx                   # Root composition: routing, state hub, invoke bridge
├── main.tsx                  # React root + error boundary mount
├── styles.css                # Global resets + imports of tokens/motion/fonts
│
├── styles/
│   ├── tokens.css            # Shared (typography, spacing, radii, motion)
│   ├── tokens-dark.css       # Dark palette (default at :root)
│   ├── tokens-light.css      # Light palette ([data-theme="light"])
│   ├── motion.css            # Page-enter + staggered children keyframes
│   └── fonts.css             # @font-face for JetBrains Mono (self-hosted)
│
├── layout/
│   ├── HeaderBar.{tsx,css}   # Wordmark, tab strip, header actions
│   ├── StatusBar.{tsx,css}   # Footer status
│   └── HelpModal.{tsx,css}   # Shortcut reference
│
├── tabs/
│   ├── LauncherTab.{tsx,css} # Terminal-pane CLI cards
│   ├── HistoryTab.{tsx,css}  # Timeline of past launches
│   ├── CostsTab.tsx          # Usage aggregation + sparkline
│   └── AdminTab.tsx          # Provider CRUD (admin-gated)
│
├── shared/
│   ├── PromptLine.tsx        # `>` prefix section header
│   ├── TerminalFrame.tsx     # Pane chrome wrapper
│   ├── Sparkline.tsx         # SVG chart primitive
│   ├── KeyCap.{tsx,module.css}
│   └── shared.css
│
├── providers/
│   ├── types.ts              # ProviderProfile, ProvidersState, isAdminMode()
│   ├── storage.ts            # localStorage read/write + migration
│   ├── seeds.ts              # Built-in providers (Anthropic/Z.AI/MiniMax)
│   ├── modelCatalog.ts       # Model IDs per provider
│   ├── costEstimator.ts      # Price math
│   ├── budget.ts             # Daily-budget guard
│   ├── testConnection.ts     # Frontend wrapper for test_provider_connection
│   ├── docsLinks.ts          # External docs URLs
│   ├── ProviderBadge.tsx     # Active-provider chip
│   ├── ProviderSelector.tsx  # Dropdown switcher
│   ├── QuickSwitchModal.tsx  # Ctrl/Cmd+P fast switch
│   ├── DryRunModal.tsx       # Env injection preview
│   ├── AppearanceSection.{tsx,css}  # Font/theme controls + FONT_STORAGE_KEY
│   ├── AdminPanel.tsx        # Embedded admin UI
│   └── providers.css
│
├── presets/
│   ├── types.ts              # Preset shape
│   ├── storage.ts            # localStorage STORAGE_KEY = 'ai-launcher-presets'
│   ├── PresetsBar.tsx        # Horizontal bar of favorites
│   └── PresetIcon.tsx
│
├── icons/
│   ├── index.ts              # Curated lucide-react re-exports (tree-shakeable)
│   └── types.ts              # DEFAULT_ICON_SIZE, DEFAULT_STROKE_WIDTH
│
├── lib/
│   └── configIO.ts           # Export/import of full config bundle
│
├── CommandPalette.{tsx,css}  # cmdk-backed palette
├── Onboarding.{tsx,css}      # 4-step first-run
├── EmptyState.{tsx,css,illustrations.tsx}
├── Skeleton.{tsx,css}
├── CostAggregator.{tsx,css}  # Legacy aggregator (kept for costs panel)
├── Orchestrator.{tsx,css}    # Multi-CLI launcher
├── ErrorBoundary.{tsx,css}
└── assets/                   # Fonts and static images
```

### `src-tauri/src/`

```
src-tauri/
├── Cargo.toml
├── src/main.rs               # Single Rust entrypoint — all #[tauri::command]s
├── icons/                    # Tray + window icons
├── tauri.conf.json           # App metadata, bundle, window config
└── capabilities/             # v2 permissions
```

The backend is intentionally a single large `main.rs`; the plan tracks the eventual
split into modules (see Task 35 retrospective).

---

## 3. Launch flow

User clicks a "Launch" button on a `LauncherTab` pane. The flow:

```
  [React]                             [Tauri IPC]         [Rust]
  ─────────                            ─────────          ──────
  LauncherTab  ─onClick─►  App.tsx handler
                              │
                              ├── resolve active provider
                              │    (providers/storage.ts
                              │     → getActiveProfile)
                              │
                              ├── build envVars payload
                              │    (ANTHROPIC_BASE_URL,
                              │     ANTHROPIC_AUTH_TOKEN,
                              │     ANTHROPIC_MODEL,
                              │     ANTHROPIC_SMALL_FAST_MODEL,
                              │     extraEnv, overrides)
                              │
                              └── invoke('launch_cli', {
                                   cliKey, directory, args,
                                   noPerms, envVars
                                  })  ──────────────►  launch_cli()
                                                       (src-tauri/src/main.rs)
                                                         │
                                                         ├── resolve CLI def
                                                         ├── spawn child process
                                                         │   (tokio::process)
                                                         ├── stream stdout/stderr
                                                         │   as `cli-output` events
                                                         └── return Result<String>
                           event('cli-output', …) ◄──────┘
                              │
                         HistoryTab appends entry
                         CostsTab updates estimate
```

Multi-CLI launches call `launch_multi_clis` with an ordered list; env injection is
identical per entry.

---

## 4. State model

Client-side persistence lives entirely in `localStorage` — there is no
server-side state and no native keychain today (API keys are stored plain-text locally).

| Key                           | Shape                                  | Owner (file)                                  |
| ----------------------------- | -------------------------------------- | --------------------------------------------- |
| `ai-launcher-config`          | `{ directory, selectedClis, args, ... }` full launch form state + history | `src/App.tsx` |
| `ai-launcher-providers`       | `ProvidersState` (profiles + activeId) | `src/providers/storage.ts`                    |
| `ai-launcher-presets`         | `Preset[]` (≤ `MAX_PRESETS`)           | `src/presets/storage.ts`                      |
| `ai-launcher:display-font`    | `FontId` (`'mono' \| 'sans' \| ...`)   | `src/providers/AppearanceSection.tsx` (`FONT_STORAGE_KEY`) |
| `ai-launcher:hide-welcome`    | `'1'` flag                             | `src/Onboarding.tsx`                          |
| `onboardingCompleted`         | `'true'` flag                          | `src/App.tsx` (first-run gate)                |

The `configIO.ts` helper exports and re-imports the first four keys as a single
bundle for backup/restore.

Reset path: `reset_all_config` (Rust) wipes `install.log` under the user's config dir;
the frontend additionally clears every key listed above.

---

## 5. Rust commands

All `#[tauri::command]` functions are registered in `src-tauri/src/main.rs`. Frontend
callers use `invoke('<name>', { … })` through `@tauri-apps/api`.

| Command                     | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `check_latest_release`      | Fetch the latest GitHub release for self-update prompts           |
| `check_environment`         | Probe Node, npm, git, and runtime prerequisites                   |
| `check_clis`                | Status of every known AI CLI (installed / missing / version)      |
| `check_cli_updates`         | Compare installed CLI versions against npm registry               |
| `check_env_updates`         | Updates for shared prerequisites (npm global utilities)           |
| `check_tool_updates`        | Updates for auxiliary dev tools (gh, etc.)                        |
| `check_all_updates`         | Aggregated run of the three update checks (emits progress events) |
| `check_tools`               | Status of auxiliary tools                                         |
| `get_all_clis`              | Return CLI catalog (static definitions)                           |
| `get_all_tools`             | Return tool catalog                                               |
| `install_cli`               | Install a CLI via npm (emits progress)                            |
| `update_cli`                | Update a single CLI                                               |
| `update_all_clis`           | Bulk update of outdated CLIs                                      |
| `install_prerequisite`      | Open installer page or run npm install for a prerequisite         |
| `update_prerequisite`       | Update npm-managed prerequisite                                   |
| `launch_cli`                | Spawn a single CLI with injected env + args                       |
| `launch_multi_clis`         | Spawn multiple CLIs in the same directory                         |
| `launch_tool`               | Open an auxiliary tool (browser / binary)                         |
| `install_tool`              | Install an auxiliary tool                                         |
| `open_in_explorer`          | Reveal a path in the OS file explorer                             |
| `open_external_url`         | Open an `https://` URL (protocol-allowlisted)                     |
| `reset_all_config`          | Clear backend-side config (`install.log`)                         |
| `read_usage_stats`          | Parse usage data for CostsTab                                     |
| `get_tray_hotkey`           | Read tray global shortcut                                         |
| `set_tray_hotkey`           | Update tray global shortcut                                       |
| `get_minimize_to_tray`      | Read minimize-to-tray flag                                        |
| `set_minimize_to_tray`      | Update minimize-to-tray flag                                      |
| `save_crash_log`            | Persist a frontend error stack for diagnostics                    |
| `read_crash_log`            | Read back a crash log (path-canonicalized)                        |
| `open_crash_dir`            | Reveal the crash directory in explorer                            |
| `test_provider_connection`  | Ping provider `baseUrl` with the stored API key                   |
| `reset_claude_state`        | Delete `~/.claude.json` (reset of Claude Code auth cache)         |

Any command that accepts a path validates it before touching the filesystem;
`open_external_url` enforces an `https://` allowlist to prevent shell injection via
custom protocols.

---

## 6. Provider abstraction

`ProviderProfile` (in `src/providers/types.ts`) is the unit of a "launch identity":

```ts
interface ProviderProfile {
  id: string;                 // slug
  name: string;               // UI label
  kind: 'anthropic' | 'zai' | 'minimax' | 'custom';
  baseUrl: string;            // ANTHROPIC_BASE_URL ('' = default)
  apiKey: string;             // ANTHROPIC_AUTH_TOKEN (plain text, local)
  mainModel: string;          // ANTHROPIC_MODEL
  fastModel: string;          // ANTHROPIC_SMALL_FAST_MODEL
  contextWindow: number;      // for cap warning
  extraEnv?: Record<string, string>;
  priceInPerM?: number;
  priceOutPerM?: number;
  dailyBudget?: number;       // 0/undefined = no cap
  builtin?: boolean;
  note?: string;
}

interface ProvidersState {
  profiles: ProviderProfile[];
  activeId: string;           // default 'anthropic'
  overrideMainModel?: string; // one-shot override for next launch
  overrideFastModel?: string;
}
```

Built-in profiles live in `src/providers/seeds.ts` and cannot be deleted, only edited.
`kind` drives the provider badge color, the context-cap warning, and the docs link in
`docsLinks.ts`. Env injection happens in `App.tsx` just before `invoke('launch_cli', …)`;
the Rust side receives a flat `Record<string, string>` and applies it to the child
process environment.

---

## 7. Testing strategy

Current reality: **no unit tests**. Quality gates are static.

- TypeScript: `npx tsc --noEmit` (strict mode, no `any`).
- Frontend build: `npm run build` (Vite) — fails on TS errors and unresolved imports.
- Rust lint: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`.
- Rust compile: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Manual smoke tests per the checklist in [VISUAL_SYSTEM.md](./VISUAL_SYSTEM.md#8-smoke-test-per-surface).

A retrospective item is tracked in the v5.5 plan (Task 35) to introduce Vitest +
Playwright coverage for provider math, storage migrations, and critical flows.

---

## 8. Admin mode gate

Admin-only UI (provider CRUD, advanced diagnostics) is compile-time gated via a Vite
env flag:

```bash
# Public build
npm run build

# Admin build
VITE_ADMIN_MODE=1 npm run build
```

Runtime check (in `src/providers/types.ts`):

```ts
export function isAdminMode(): boolean {
  return import.meta.env.VITE_ADMIN_MODE === '1';
}
```

`App.tsx` consumes `isAdminMode()` once on mount; `AdminTab.tsx` and
`providers/AdminPanel.tsx` short-circuit to `null` when the flag is off, so the
admin bundle is not shipped with a public build.

The flag is **compile-time only** — toggling it in a running app has no effect, and a
public bundle cannot be flipped into admin mode by editing localStorage or runtime
state.
