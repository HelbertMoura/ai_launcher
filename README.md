<div align="center">
  <img src="./public/images/banner.png" alt="AI Launcher Pro" width="100%" />

  <br />
  <br />

  <h1>AI Launcher Pro</h1>

  <p>
    <strong>eight CLIs. one launcher.</strong>
  </p>

  <p>
    <a href="https://github.com/HelbertMoura/ai_launcher/releases/latest">
      <img src="https://img.shields.io/github/v/release/HelbertMoura/ai_launcher?style=for-the-badge&color=8B1E2A&label=release" alt="Latest release" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/actions/workflows/build.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/HelbertMoura/ai_launcher/build.yml?style=for-the-badge&label=build" alt="Build status" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/releases">
      <img src="https://img.shields.io/github/downloads/HelbertMoura/ai_launcher/total?style=for-the-badge&color=brightgreen&label=downloads" alt="Downloads" />
    </a>
    <img src="https://img.shields.io/badge/tauri-v2-24C8DB?style=for-the-badge&logo=tauri" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/platform-windows%2010%20%2F%2011-0078D4?style=for-the-badge&logo=windows" alt="Platform" />
  </p>
  <p>
    <a href="https://github.com/HelbertMoura/ai_launcher/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/HelbertMoura/ai_launcher?style=for-the-badge&color=blue" alt="License" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/stargazers">
      <img src="https://img.shields.io/github/stars/HelbertMoura/ai_launcher?style=for-the-badge&color=yellow" alt="Stars" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/network/members">
      <img src="https://img.shields.io/github/forks/HelbertMoura/ai_launcher?style=for-the-badge&color=orange" alt="Forks" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/issues">
      <img src="https://img.shields.io/github/issues/HelbertMoura/ai_launcher?style=for-the-badge&color=red" alt="Issues" />
    </a>
  </p>
</div>

<hr />

<p align="center">
  <img src="./docs/screenshots/hero-dark.png" alt="AI Launcher Pro — v5.5 Terminal Dramatico" width="100%" />
</p>

## What is it

AI Launcher Pro is a Tauri v2 desktop app that collapses every AI coding CLI you use — Claude Code, Codex, Cursor, Gemini, Qwen, iFlow, Copilot and friends — into a single, keyboard-first launcher with a terminal aesthetic.

It installs what's missing, detects what's already there, swaps providers on the fly (Anthropic, Z.AI, MiniMax, custom base URLs), tracks cost per day with inline sparklines, and keeps a git-log-style history of every run you do.

v5.5 "Terminal Dramatico" is a full visual rewrite: mono typography end-to-end, terminal-pane cards, a command palette with live preview, a font picker, an update checker wired to GitHub releases, and a four-step onboarding for fresh installs.

<br />

## Features

- Multi-CLI launcher for Claude Code, Codex, Cursor, Gemini, Qwen, iFlow, Copilot and more
- Multi-provider switching — Anthropic, Z.AI (GLM), MiniMax, and custom base URLs with env-var injection
- Launch presets — CLI + provider + directory + args saved as a chip, bound to a number key
- Git-log-style history tab with filters by CLI, provider, project, exit code
- Cost aggregation with per-day sparklines and a configurable daily budget
- Command palette with live preview and pinned/recent entries
- Font picker — JetBrains Mono, IBM Plex Mono, Cascadia Code, Berkeley Mono, System
- Update checker wired to GitHub releases, in-app notification when a new version ships
- Keyboard-first — `⌘K` palette, `⌘⇧1..4` tabs, `⌘1..9` preset launches, `⌘/` help
- Light and dark themes with `prefers-reduced-motion` honored
- Four-step onboarding for first launch
- Admin build with provider CRUD, appearance controls and backup (`VITE_ADMIN_MODE=1`)

<br />

## Supported CLIs

| CLI              | Install command                                 | Auto-injected flag                             |
| :--------------- | :---------------------------------------------- | :--------------------------------------------- |
| Claude Code      | `npm install -g @anthropic-ai/claude-code`      | `--dangerously-skip-permissions`               |
| Codex            | `npm install -g @openai/codex`                  | `--dangerously-bypass-approvals-and-sandbox`   |
| Cursor           | detected from system install                    | —                                              |
| Gemini CLI       | `npm install -g @google/gemini-cli`             | `--yolo`                                       |
| Qwen             | `npm install -g qwen-ai`                        | `--yolo`                                       |
| iFlow            | detected from system install                    | —                                              |
| Copilot CLI      | detected from system install                    | —                                              |
| Kilo Code        | `pip install kilo-code`                         | `--yolo`                                       |
| Crush            | `npm install -g crush-cli`                      | `--yolo`                                       |
| Droid            | `npm install -g droid`                          | —                                              |
| OpenCode         | `npm install -g opencode-ai`                    | —                                              |

IDEs detected out of the box: VS Code, Cursor, Windsurf, AntGravity, Claude Desktop, Codex Desktop.

<br />

## Installation

### End users

Grab the latest `.msi` or `.exe` from the [releases page](https://github.com/HelbertMoura/ai_launcher/releases/latest). Run it and you're done.

Windows SmartScreen may warn on unsigned builds — either click "More info → Run anyway", or build from source (below) for full provenance.

### From source

Prerequisites:

- Node.js 18+
- [Rust (stable)](https://rustup.rs/)
- Windows 10 or 11
- Visual Studio Build Tools with **Desktop development with C++** workload (required by Tauri)

```bash
# 1. Clone
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher

# 2. Install deps
npm install

# 3. Run dev (hot reload)
npm run tauri dev

# 4. Build installers
npm run tauri build
```

Installers land in `src-tauri/target/release/bundle/`. Need local signing to silence SmartScreen? See `scripts/gen-cert.ps1` and `scripts/sign-build.ps1`.

<br />

## Keyboard shortcuts

| Keys              | Action                       |
| :---------------- | :--------------------------- |
| `⌘K`              | Open command palette         |
| `⌘⇧1`             | Go to Launcher tab           |
| `⌘⇧2`             | Go to Install tab            |
| `⌘⇧3`             | Go to History tab            |
| `⌘⇧4`             | Go to Costs tab              |
| `⌘1`              | Launch preset 1              |
| `⌘2..9`           | Launch presets 2 through 9   |
| `F5`              | Re-scan installed CLIs       |
| `⌘/`              | Open help                    |
| `⌘⇧A`             | Toggle admin mode (runtime)  |
| `Esc`             | Close modals                 |

On Windows `⌘` is `Ctrl` and `⇧` is `Shift`.

### Enabling admin mode

Since v5.5.1, admin mode can be toggled at runtime — no rebuild needed. Three ways:

1. Press `⌘⇧A` (or `Ctrl+Shift+A`) — toast confirms state.
2. Open the app with URL param `?admin=1` (or `?admin=0`). Persists in `localStorage`.
3. Build from source with `VITE_ADMIN_MODE=1 npm run build` — permanent admin-full.

Admin mode unlocks the Providers + Backup panels. Tokens remain local-only; the
gate exists to keep the default UI minimal.

<br />

## Providers setup

AI Launcher Pro can point any Anthropic-compatible CLI at a different backend by injecting the right env vars at launch time.

Ships with built-in seeds for:

- **Anthropic** — official endpoint
- **Z.AI (GLM)** — automatic model mapping `opus/sonnet → glm-5.1`, `haiku → glm-4.7`
- **MiniMax** — international (`https://api.minimax.io/anthropic`) and China (`https://api.minimaxi.com/anthropic`) endpoints

To add or edit providers, build with admin mode enabled (see **Build modes** below), then open the Admin tab → Providers. Each provider stores a base URL, an API key, and an optional model map.

Keys are stored locally (Tauri's OS-level store). They are never sent anywhere except to the provider you configure.

> **MiniMax — regions.** The built-in seed targets the international endpoint. Chinese accounts need the `minimaxi.com` base URL. Keys:
> [international](https://platform.minimax.io/user-center/basic-information/interface-key) ·
> [china](https://platform.minimaxi.com/user-center/basic-information/interface-key).

<br />

## Architecture at a glance

React 19 + Vite 8 frontend on TypeScript strict, Rust backend exposed through Tauri v2 commands. Storage is local JSON via the Tauri store plugin. No server, no telemetry.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full layout — commands, events, state shape, module boundaries.

<br />

## Visual system

v5.5 "Terminal Dramatico" is built on a mono-first design language: JetBrains Mono as default, terminal panes in place of generic cards, ASCII framing, typed caret affordances, and a disciplined palette.

Tokens, type scale, motion rules and component anatomy live in [docs/VISUAL_SYSTEM.md](./docs/VISUAL_SYSTEM.md).

<br />

## Build modes

| Mode   | Command                                | What's visible                                          |
| :----- | :------------------------------------- | :------------------------------------------------------ |
| Public | `npm run build`                        | Launcher, Install, History, Costs, palette, help        |
| Admin  | `VITE_ADMIN_MODE=1 npm run build`      | Public + Admin tab (provider CRUD, appearance, backup)  |

On Windows PowerShell: `$env:VITE_ADMIN_MODE='1'; npm run build`.

Admin mode is gated at build time and strips from the bundle when disabled — there's no runtime toggle.

<br />

## Contributing

PRs, issues and CLI additions are welcome. Start here:

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md).
2. File bugs or propose features in [GitHub Issues](https://github.com/HelbertMoura/ai_launcher/issues).

<br />

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full history. Current line: **v5.5 "Terminal Dramatico"**.

<br />

## License

MIT. See [LICENSE](./LICENSE).
Copyright © 2026 Helbert Moura | DevManiac's.

<br />

## Credits

Built by **Helbert Moura** / **DevManiac's**.

Standing on the shoulders of:

- [Tauri](https://tauri.app) — Rust-powered desktop shell
- [React](https://react.dev) + [Vite](https://vitejs.dev) — frontend runtime
- [lucide-react](https://lucide.dev) — icon set
- [cmdk](https://cmdk.paco.me) — command palette primitive
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/), [IBM Plex Mono](https://www.ibm.com/plex/), [Cascadia Code](https://github.com/microsoft/cascadia-code) — mono typefaces
