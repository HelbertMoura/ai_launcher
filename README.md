> 🇺🇸 English | [🇧🇷 Português (Brasil)](./README.pt-BR.md)

<div align="center">

```text
   ┌─ AI LAUNCHER PRO ────────────────────────── v12.5.0 ──┐
   │                                                        │
   │   ▎ COMMAND DECK                                       │
   │                                                        │
   │   ● claude-code    online     v4.7                     │
   │   ● codex          online     v1.0                     │
   │   ○ gemini         missing                            │
   │   ● qwen           online     v0.9                     │
   │   ● crush          online     v1.2                     │
   │   ● droid          online     v0.8                     │
   │   ▲ kilocode       update     v0.5 → v0.6             │
   │   ● opencode       online     v0.3                     │
   │                                                        │
   │   7/8 online    ⬆ 1 update    ● ADMIN    $0.42 today  │
   └────────────────────────────────────────────────────────┘
```

**One desktop app to detect, install, launch, update and track all your AI coding tools.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Version 12.5.0](https://img.shields.io/badge/version-12.5.0-ff3131?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
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
| 🚀 | **CLI Launcher** | Detect, install and launch Claude Code, Codex, Gemini CLI, Qwen, Crush, Droid, Kilocode, OpenCode and more |
| 🔧 | **Tools Manager** | Manage VS Code, Cursor, Windsurf, Google Antigravity, JetBrains AI and custom IDEs |
| ⬆️ | **Updates Hub** | Dedicated tab for CLI, tool and prerequisite updates with one-click install |
| 💰 | **Cost Tracking** | Per-provider spend tracking with daily and monthly breakdowns |
| 📋 | **Launch History** | Full session log with reopen, descriptions, status badges and duration tracking |
| 🔍 | **Prerequisites Check** | Verify Node, npm, Bun, Python, Rust, Cargo, Git, Docker and more |
| 🔌 | **Providers** | Anthropic, Z.AI, MiniMax, Moonshot, Qwen, OpenRouter + custom endpoints with API test button |
| 🎨 | **Full Customization** | Dark/Light theme, 5 accent colors, 5 mono fonts, CLI overrides |
| 🌐 | **i18n** | English and Portuguese (Brazil) with instant toggle |
| ⌨️ | **Keyboard-First** | `Ctrl+K` palette, `Ctrl+1-6` tab nav, `Ctrl+,` admin, `?` help |
| 🔒 | **Privacy-First** | Everything stays local — no telemetry, no cloud sync |

## Quick Start

### Download (Windows)

Grab the `.msi` installer from the [latest release](https://github.com/HelbertMoura/ai_launcher/releases).

> SmartScreen may warn on unsigned builds — click **More info → Run anyway**.

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

## What's New in v12.5

- **Updates tab** — Dedicated surface for CLI, tool and prerequisite updates with Update All button
- **Install from cards** — Install missing CLIs and tools directly from Launch and Tools tabs
- **History improvements** — Reopen sessions, add descriptions, status badges (running/finished/error), duration tracking, remember last directory per CLI
- **Test API button** — Test provider connections directly from Admin with latency display
- **Official brand icons** — Real vendor logos from LobeHub Icons and devicons, visible in both themes
- **Welcome screen** — Reformulated with DevManiacs branding, guided tour and "always show" option
- **i18n improvements** — Full pt-BR and EN coverage for all new features

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 6 + Vite |
| Backend | Rust (Tauri v2) |
| Styling | CSS Custom Properties (token system) |
| i18n | i18next 24 |
| Icons | Official brand logos (LobeHub Icons, devicons) |
| Build | Tauri CLI → `.msi` + `.exe` |

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
