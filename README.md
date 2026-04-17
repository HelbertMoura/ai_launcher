# AI Launcher

Desktop launcher for AI coding CLIs, for Windows.

One window to discover, install, update and launch Claude Code, Codex, Gemini,
Qwen, Kilo Code, OpenCode, Crush and Droid — plus editor shortcuts for VS
Code, Cursor, Windsurf and AntGravity. No flashing `cmd` windows during
install, no hunting for the right `npm install -g` line per tool, no
per-session environment setup.

Built with Tauri v2, React 18 and Rust. Windows 10 and 11.

## What it does

- **Install & update** — detects what's missing, runs `npm install -g` /
  `pip install` in-process with live progress streamed to the UI. Update
  checker compares installed vs. latest versions for CLIs, prerequisites
  (Node, Python, Git, Rust) and IDEs.
- **Launch** — opens each CLI in Windows Terminal when available, falling back
  to PowerShell 7, then `cmd`. Toggles the right permission flag per CLI
  (`--dangerously-skip-permissions`, `--yolo`, etc.) so you don't have to
  remember.
- **Track** — keeps a per-project history of launches. Shows aggregated token
  usage for Claude Code runs. Runs multiple CLIs side-by-side against the
  same working directory from the Orchestrator tab.

## Supported CLIs

| CLI         | Install command                           | Permission flag                                       |
|-------------|-------------------------------------------|-------------------------------------------------------|
| Claude Code | `npm install -g @anthropic-ai/claude-code`| `--dangerously-skip-permissions`                      |
| Codex       | `npm install -g @openai/codex`            | `--dangerously-bypass-approvals-and-sandbox`          |
| Gemini CLI  | `npm install -g @google/gemini-cli`       | `--yolo`                                              |
| Qwen        | `npm install -g qwen-ai`                  | `--yolo`                                              |
| Droid       | `npm install -g droid`                    | —                                                     |
| Kilo Code   | `pip install kilo-code`                   | `--yolo`                                              |
| OpenCode    | `npm install -g opencode-ai`              | —                                                     |
| Crush       | `npm install -g crush-cli`                | `--yolo`                                              |

## Supported IDE tools

VS Code, Cursor, Windsurf, AntGravity, Claude Desktop, Codex Desktop. The
launcher detects existing installs and offers to open the current working
directory in any of them.

## Install

Grab the latest installer from the
[Releases page](https://github.com/HelbertMoura/ai_launcher/releases):

- `AI Launcher_<version>_x64_pt-BR.msi` — MSI, recommended for machines
  managed by IT policies.
- `AI Launcher_<version>_x64-setup.exe` — NSIS, double-click to install.

On first launch the app opens a small onboarding wizard that detects what's
already installed and offers to fix anything missing.

### First-run warnings

The installers are not signed with a paid EV certificate, so SmartScreen may
show a "Windows protected your PC" dialog on the first run. Click **More info
→ Run anyway**.

If your environment requires signed binaries, see the Code signing section
below — the repo ships helpers to sign with a local self-signed certificate.

## Build from source

Prerequisites:

- Node.js 18 or newer
- Rust stable, via [rustup](https://rustup.rs/)
- Windows 10 or 11
- Visual Studio Build Tools with the **Desktop development with C++** workload
  (Tauri uses it to link on Windows)

```powershell
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install

# Dev — Vite + Rust with hot reload on both sides
npm run tauri dev

# Release — produces MSI + NSIS installers under
# src-tauri/target/release/bundle/
npm run tauri build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the project layout and where to
add a new CLI.

## Code signing

For local builds signed with a self-signed cert (trusted on your own machine
only):

```powershell
# Once — generate cert and add it to Trusted Root
.\scripts\gen-cert.ps1

# After each build — sign the produced .exe / .msi
.\scripts\sign-build.ps1
```

## Configuration and data

The app keeps per-user state under `%APPDATA%\ai-launcher\`:

- Launch history (per working directory)
- Onboarding completion flag
- Selected theme
- Diagnostic logs

Nothing is sent over the network by the app itself. Update checks hit the
public registries of each CLI (npm, PyPI) and the GitHub releases API.

## Contributing

PRs welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first — it covers the
dev setup, project layout, the conventions used in the monolithic `App.tsx`
and `main.rs`, and how to add a new CLI.

Bug reports and feature requests go through the GitHub
[issue templates](./.github/ISSUE_TEMPLATE).

## License

[MIT](./LICENSE) — Copyright © 2026 Helbert Moura | DevManiac's.
