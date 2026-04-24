> 🇺🇸 English | [🇧🇷 Português (Brasil)](./README.pt-BR.md)

<div align="center">

<img src="./docs/terminal-hero.svg" alt="AI Launcher Pro — Command Deck Terminal" width="720">

**One desktop app to detect, install, launch, update and track all your AI coding tools.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Version 15.0.0](https://img.shields.io/badge/version-15.0.0-ff3131?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D4?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
![React 19](https://img.shields.io/badge/React-19-61dafb?labelColor=1a1a1d)
![Tauri v2](https://img.shields.io/badge/Tauri-v2-ffc131?labelColor=1a1a1d)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?labelColor=1a1a1d)
![Rust](https://img.shields.io/badge/Rust-stable-dea584?labelColor=1a1a1d)

</div>

---

## Features

| | Feature | Description |
|---|---------|-------------|
| :rocket: | **CLI Launcher** | Detect, install and launch Claude Code, Codex, Gemini CLI, Qwen, Crush, Droid, Kilocode, OpenCode and more |
| :wrench: | **Tools Manager** | Manage VS Code, Cursor, Windsurf, Google Antigravity, JetBrains AI and custom IDEs |
| :arrow_up: | **Updates Hub** | Dedicated tab for CLI, tool and prerequisite updates with one-click install |
| :moneybag: | **Cost Tracking** | Per-provider spend tracking with daily and monthly breakdowns |
| :clipboard: | **Launch History** | Full session log with reopen, descriptions, status badges and duration tracking |
| :mag: | **Prerequisites Check** | Verify Node, npm, Bun, Python, Rust, Cargo, Git, Docker and more |
| :electric_plug: | **Providers** | Anthropic, Z.AI, MiniMax, Moonshot, Qwen, OpenRouter + custom endpoints with API test button |
| :art: | **Full Customization** | Dark/Light theme, 5 accent colors, 5 mono fonts, CLI overrides |
| :globe_with_meridians: | **i18n** | English and Portuguese (Brazil) with instant toggle |
| :keyboard: | **Keyboard-First** | `Ctrl+K` palette, `Ctrl+1-6` tab nav, `Ctrl+,` admin, `?` help |
| :lock: | **Privacy-First** | Everything stays local -- no telemetry, no cloud sync |
| :office: | **Workspace Profiles** | Group configs by repo, team or context for one-click switching |
| :jigsaw: | **Agent Runbooks** | Automated environment setup sequences for AI agent workflows |
| :shield: | **Budget Guard** | Local cost limits per provider with alerts at configurable thresholds |
| :stethoscope: | **Environment Doctor** | Diagnose and repair broken dev environments with guided fixes |
| :eye: | **Safe Command Preview** | Review executable, args, env and risk level before running custom commands |
| :arrows_counterclockwise: | **Self-Updater** | In-app update checks, download with progress, checksum validation |

## Screenshots

<div align="center">

| CLI Launcher | Tools Manager | Launch Dialog |
|:---:|:---:|:---:|
| ![CLI Launcher](./docs/screenshots/01-launcher-cli.png) | ![Tools](./docs/screenshots/02-launcher-tools.png) | ![Launch Dialog](./docs/screenshots/03-launch-dialog.png) |

| History | Providers | Settings |
|:---:|:---:|:---:|
| ![History](./docs/screenshots/04-history.png) | ![Providers](./docs/screenshots/05-providers.png) | ![Settings](./docs/screenshots/06-settings.png) |

| Onboarding | Updates | Provider Edit |
|:---:|:---:|:---:|
| ![Onboarding](./docs/screenshots/07-onboarding.png) | ![Updates](./docs/screenshots/08-updates.png) | ![Provider Edit](./docs/screenshots/09-provider-edit.png) |

| Welcome | Dark Theme |
|:---:|:---:|
| ![Welcome](./docs/screenshots/10-welcome.png) | ![Dark Theme](./docs/screenshots/11-dark-theme.png) |

</div>

## Quick Start

### Install (Windows)

<!-- Winget and Chocolatey — coming soon after signed release -->

```bash
# Option 1: Winget (recommended)
winget install DevManiacs.AILauncher

# Option 2: Chocolatey
choco install ai-launcher -y

# Option 3: Manual download
# Grab the .msi or .exe installer from the latest release:
# https://github.com/HelbertMoura/ai_launcher/releases
```

> SmartScreen may warn on unsigned builds -- click **More info, then Run anyway**.

### Build from Source

**Prerequisites:** Node 20+, Rust stable, Visual Studio Build Tools with **Desktop development with C++**.

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri build
```

The `.msi` lands in `src-tauri/target/release/bundle/msi/`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `Ctrl+1` | Launch tab |
| `Ctrl+2` | Tools tab |
| `Ctrl+3` | History tab |
| `Ctrl+4` | Costs tab |
| `Ctrl+5` | Updates tab |
| `Ctrl+6` | Prerequisites tab |
| `Ctrl+,` | Admin tab |
| `?` | Help tab |
| `Esc` | Close dialog |

## Surfaces

The app has 8 main surfaces accessible from the sidebar:

| Tab | What it does |
|-----|-------------|
| **Launch** | Scan for AI CLIs, install missing ones, launch with custom directory and args |
| **Tools** | Detect and manage IDEs — install missing tools with one click |
| **History** | Browse past sessions with reopen, inline descriptions, status badges and duration |
| **Costs** | Per-CLI cost breakdown — today and monthly totals with token tracking |
| **Updates** | Central hub for CLI, tool and prerequisite updates — update all or individually |
| **Prereqs** | System health check — Node, npm, Bun, Python, Rust, Git, Docker, Terminal |
| **Admin** | Providers (with API test), presets, appearance, CLI overrides, custom IDEs |
| **Help** | Shortcuts, FAQ, animated terminal demo, welcome tour replay |

## What's new in v15

- **Workspace Profiles** -- group configs by repo, team or context with one-click switching
- **Agent Runbooks** -- automated setup sequences for AI agent environments
- **Provider Budget Guard** -- local cost limits per provider with configurable alerts
- **Environment Doctor** -- diagnose and repair broken dev environments
- **Safe Command Preview** -- review risk level before running custom commands
- **Self-Updater** -- in-app update checks with checksum validation
- **Unified Launch Profiles** -- presets and session templates merged into one model
- **Session Lifecycle** -- real process status tracking (starting/running/completed/failed)
- **Windows Distribution** -- Winget and Chocolatey package manifests ready
- **Command Deck 2.0** -- cleaner hierarchy, improved light theme, consistent icons

<details><summary>v14 highlights</summary>

- **Autostart + global hotkey** -- launch with Windows, focus from anywhere
- **Pinned dirs + session templates** -- one-click relaunch for your favorite setups
- **History filters, usage export, desktop notifications** -- full observability
- **Free-form accent color picker** -- any hex, not just 5 presets
- **Backend modularized** -- `main.rs` from 3105 to ~120 lines, typed errors, unit tests
- **CI quality gates** -- tsc, vitest, clippy, cargo audit, Playwright E2E on every PR

</details>

<details><summary>v13 highlights</summary>

- **New minimalist icon** — Hex Hub design in red, clean and recognizable at any size
- **Provider persistence in history** — Reopening a Claude session now restores the exact provider used
- **Recent directories dropdown** — Last 10 directories per CLI shown on focus for quick selection
- **Screenshots in docs** — Full gallery of all app surfaces in the README

</details>

<details><summary>v12.5 highlights</summary>

- Updates tab — Dedicated surface for CLI, tool and prerequisite updates
- Install from cards — Install missing CLIs and tools directly from tabs
- History improvements — Reopen sessions, descriptions, status badges, duration tracking
- Test API button — Test provider connections from Admin with latency display
- Official brand icons — Real vendor logos from LobeHub Icons and devicons
- Welcome screen — DevManiacs branding, guided tour, "always show" option

</details>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 6 + Vite |
| Backend | Rust (Tauri v2) |
| Styling | CSS Custom Properties (token system) |
| i18n | i18next 24 |
| Icons | Official brand logos (LobeHub Icons, devicons) |
| Build | Tauri CLI -- `.msi` + `.exe` (NSIS) |
| Distribution | Winget, Chocolatey, GitHub Releases |

## Contributing

Fork the repo, create a feature branch, open a PR against `main`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, conventions and the PR checklist.

## License

MIT — see [LICENSE](./LICENSE).

## Credits

- **Author:** Helbert Moura — [DevManiac's](https://github.com/HelbertMoura)
- **Icons** — [LobeHub Icons](https://github.com/lobehub/lobe-icons), [devicons](https://github.com/devicons/devicon)
- Brand names and trademarks belong to their respective owners.

---

<div align="center">

**[Download](https://github.com/HelbertMoura/ai_launcher/releases)** · **[Report Bug](https://github.com/HelbertMoura/ai_launcher/issues)** · **[Request Feature](https://github.com/HelbertMoura/ai_launcher/issues)**

</div>
