# Contributing

Thanks for taking the time to look at AI Launcher. This document covers how to
get a dev environment running, the project layout, and the conventions used
when sending a pull request.

## Platform support

Windows 10+ only. Cross-platform support is not on the roadmap — the Rust side
uses Windows-specific APIs (Windows Terminal detection, `CREATE_NO_WINDOW`,
`%USERPROFILE%`, Start Menu scanning) that would need large rewrites to port.

## Prerequisites

- Node.js 18+
- Rust stable (via [rustup](https://rustup.rs/))
- Windows 10+ with
  [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)
  (already present on Windows 11 and on most Windows 10 machines)
- Visual Studio Build Tools with the "Desktop development with C++" workload
  (required by Tauri to link on Windows)

## Running in development

```powershell
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev
```

`npm run tauri dev` builds the Rust backend, starts Vite on port 5173, and
opens the desktop window with hot reload on both sides.

To iterate on the frontend without a full Tauri rebuild, use `npm run dev` —
it starts Vite only. The Tauri-specific `invoke()` calls will fail but the
layout and styling can be worked on in a plain browser.

## Producing a release build

```powershell
npm run tauri build
```

Artifacts land under `src-tauri/target/release/bundle/`:

- `msi/AI Launcher_<version>_x64_pt-BR.msi` — MSI installer
- `nsis/AI Launcher_<version>_x64-setup.exe` — NSIS installer

## Project layout

```
src/                   Frontend (React 18 + TypeScript, Vite-bundled)
  App.tsx              Main window: tabs, state, every invoke() call
  main.tsx             React entry point
  styles.css           All CSS (dark + light themes, component styles)
  CommandPalette.*     Ctrl+K launcher
  CostAggregator.*     Token/cost aggregator tab
  EmptyState.*         Empty list helper
  ErrorBoundary.*      Top-level React error boundary
  Onboarding.*         First-run wizard
  Orchestrator.*       Multi-CLI runner tab
  Skeleton.*           Loading-state placeholders

src-tauri/             Backend (Rust, compiled by Tauri CLI)
  src/main.rs          Every #[tauri::command], CLI catalog, process spawn
  Cargo.toml           Rust dependencies
  tauri.conf.json      Tauri app metadata, bundle targets, window config
  capabilities/        Tauri v2 permission config
  icons/               App + installer icons

scripts/               Helper scripts
  gen-cert.ps1         Create a self-signed cert for local code signing
  sign-build.ps1       Sign the built .msi / .exe / installer
  certs/               (gitignored) generated .pfx lives here

.github/
  workflows/build.yml  CI: builds MSI + NSIS on push and on tag
```

Both `src/App.tsx` (~1600 lines) and `src-tauri/src/main.rs` (~2600 lines) are
monolithic by design. Splitting either into modules is a deliberate change and
would need to be discussed in an issue first.

## Adding a new CLI

Two places need updating, both in Rust:

1. `src-tauri/src/main.rs` — add a `CliDef { ... }` entry to the list returned
   by `get_cli_definitions()`. Set `install_cmd`, `update_cmd`, `version_cmd`,
   and the permission flag.
2. `src/App.tsx` — add an entry to the `CLI_ICONS` and `CLI_COLORS` constants
   at the top of the file so the UI has an icon and accent color.

IDE tools use the same pattern but via `get_tool_definitions()`.

## Code style

There is no linter or formatter wired up. Match the surrounding code.

- TypeScript: 2-space indent, single quotes, trailing commas in multi-line
  literals.
- Rust: `cargo fmt` defaults.
- Commit messages: short imperative subject, optional body. `feat:`, `fix:`,
  `refactor:`, `docs:`, `chore:`, `ci:` prefixes are preferred but not
  enforced.

## Pull requests

1. Fork, create a feature branch off `main`.
2. Make focused commits.
3. Run `cargo check --manifest-path src-tauri/Cargo.toml` and `npm run build`
   before opening the PR — both must pass.
4. Describe what changed and how you tested it. Screenshots help for UI work.
5. The PR CI runs on Windows and must pass before merge.

## Reporting bugs

Use the "Bug report" issue template. Include your Windows version (10 / 11 /
Server), the launcher version (visible in the header), and what you were
doing when the problem appeared. If a CLI install or launch failed, the
Actions tab inside the app copies useful diagnostics.

## Security

If you find a security issue — for example a way to get arbitrary code
execution through the installed CLI paths or environment variables —
please open a private security advisory on GitHub rather than a public
issue.
