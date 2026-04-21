<div align="center">
  <img src="./public/images/banner.png" alt="AI Launcher Pro" width="100%" />

  <br />
  <br />

  <h1>AI Launcher Pro</h1>

  <p>
    <strong>Eight AI CLIs. One terminal-native launcher.</strong>
  </p>

  <p>
    <a href="https://github.com/HelbertMoura/ai_launcher/releases/latest">
      <img src="https://img.shields.io/github/v/release/HelbertMoura/ai_launcher?style=for-the-badge&color=8B1E2A&label=release" alt="Latest release" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/releases">
      <img src="https://img.shields.io/github/downloads/HelbertMoura/ai_launcher/total?style=for-the-badge&color=brightgreen&label=downloads" alt="Downloads" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/HelbertMoura/ai_launcher?style=for-the-badge&color=blue" alt="License" />
    </a>
    <a href="https://github.com/HelbertMoura/ai_launcher/stargazers">
      <img src="https://img.shields.io/github/stars/HelbertMoura/ai_launcher?style=for-the-badge&color=yellow" alt="Stars" />
    </a>
    <img src="https://img.shields.io/badge/tauri-v2-24C8DB?style=for-the-badge&logo=tauri" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  </p>
</div>

<hr />

**Language:** English · [Português](./README.pt-BR.md)

## What it is

AI Launcher Pro is a Tauri v2 desktop app that manages the CLI tools you already use for AI coding — Claude Code, Codex, Cursor, Gemini, Qwen, iFlow, Copilot and more — from a single, keyboard-first surface. It detects what's installed, installs what isn't, swaps providers on the fly, and tracks every run.

It runs fully local. No accounts, no telemetry, no server. Provider tokens live in the OS-level Tauri store and are only ever sent to the provider you configured.

<br />

## Screenshots

<p align="center">
  <img src="./docs/screenshots/launcher-dark.png" alt="Launcher — dark theme"       width="48%" />
  <img src="./docs/screenshots/history-timeline.png" alt="Git-log-style history"    width="48%" />
</p>
<p align="center">
  <img src="./docs/screenshots/costs-sparklines.png" alt="Costs with sparklines"    width="48%" />
  <img src="./docs/screenshots/command-palette.png" alt="Command palette preview"   width="48%" />
</p>

<br />

## Features

- Terminal-native UI with mono-first typography and terminal-pane cards
- Multi-CLI launcher covering 8+ CLIs, detected or installed from the app
- Multi-provider switching — Anthropic, Z.AI (GLM), MiniMax and custom base URLs
- Launch presets with CLI + provider + working directory + args, bound to number keys
- Git-log-style history with filters, re-run and copy-args
- Cost aggregation with a configurable daily budget and per-CLI 7-day sparklines
- Command palette with live preview pane and pinned/recent entries
- Font picker — JetBrains Mono, IBM Plex Mono, Cascadia Code, Berkeley Mono, System
- In-app update checker wired to the GitHub Releases API
- Help modal (`⌘/`) with the full shortcut index
- Runtime admin toggle (`⌘⇧A` or `?admin=1`) — **v5.5.1+**
- Bilingual interface (EN / pt-BR) — **v6.0+**
- Light and dark themes with `prefers-reduced-motion` honored

<br />

## Supported CLIs

| CLI           | Install command                              | Auto-injected flag                            |
| :------------ | :------------------------------------------- | :-------------------------------------------- |
| Claude Code   | `npm install -g @anthropic-ai/claude-code`   | `--dangerously-skip-permissions`              |
| Codex         | `npm install -g @openai/codex`               | `--dangerously-bypass-approvals-and-sandbox`  |
| Cursor        | detected from system install                 | —                                             |
| Gemini CLI    | `npm install -g @google/gemini-cli`          | `--yolo`                                      |
| Qwen          | `npm install -g qwen-ai`                     | `--yolo`                                      |
| iFlow         | detected from system install                 | —                                             |
| Copilot CLI   | detected from system install                 | —                                             |
| Kilo Code     | `pip install kilo-code`                      | `--yolo`                                      |
| Crush         | `npm install -g crush-cli`                   | `--yolo`                                      |
| Droid         | `npm install -g droid`                       | —                                             |
| OpenCode      | `npm install -g opencode-ai`                 | —                                             |

<br />

## Install

### End users

Download the latest `.msi` or `.exe` from the [releases page](https://github.com/HelbertMoura/ai_launcher/releases/latest). Run it.

Windows SmartScreen may warn on unsigned builds. Click **More info → Run anyway**, or build from source for full provenance.

### From source

Prerequisites: Node.js 18+, [Rust stable](https://rustup.rs/), Windows 10 or 11, Visual Studio Build Tools with the **Desktop development with C++** workload.

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev       # hot-reload dev
npm run tauri build     # installers in src-tauri/target/release/bundle/
```

Local signing helpers live in `scripts/gen-cert.ps1` and `scripts/sign-build.ps1`.

<br />

## Keyboard shortcuts

| Keys       | Action                                             |
| :--------- | :------------------------------------------------- |
| `⌘K`       | Command palette                                    |
| `⌘⇧1-4`    | Switch tabs (Launcher / Install / History / Costs) |
| `⌘1-9`     | Launch preset by index                             |
| `⌘/`       | Help modal                                         |
| `⌘⇧A`      | Toggle admin mode                                  |
| `⌘⇧L`      | Cycle language (EN ↔ pt-BR)                        |
| `F5`       | Re-check installed CLIs                            |
| `Esc`      | Close modals                                       |

On Windows/Linux `⌘` = `Ctrl`, `⇧` = `Shift`.

<br />

## Language

The interface ships in English and Brazilian Portuguese. On first launch the app reads the browser locale — `pt-BR` picks Portuguese; anything else falls back to English.

Switch at runtime from the globe dropdown in the header bar, or with the `⌘⇧L` chord. The choice persists under `localStorage['ai-launcher:locale']`.

<br />

## Admin mode

Admin mode unlocks the Providers and Backup panels. Tokens stay local in every mode — the gate exists only to keep the default surface minimal.

Since v5.5.1, there are three ways to enable it:

| Method        | How                                                | Persistence              |
| :------------ | :------------------------------------------------- | :----------------------- |
| Chord         | `⌘⇧A` (toast confirms state)                       | `localStorage`           |
| URL param     | Launch with `?admin=1` (or `?admin=0` to disable)  | `localStorage`           |
| Build flag    | `VITE_ADMIN_MODE=1 npm run tauri build`            | Permanent, always on     |

See the [v5.5.1 release notes](https://github.com/HelbertMoura/ai_launcher/releases/tag/v5.5.1) for details.

<br />

## Providers

AI Launcher Pro points any Anthropic-compatible CLI at a different backend by injecting the right env vars at launch.

Built-in seeds:

| Provider   | Notes                                                                 |
| :--------- | :-------------------------------------------------------------------- |
| Anthropic  | Official endpoint                                                     |
| Z.AI (GLM) | Auto model map — `opus/sonnet → glm-5.1`, `haiku → glm-4.7`           |
| MiniMax    | International and China endpoints (see below)                         |
| Custom     | Any base URL + API key + optional model map                           |

To add or edit providers, enable admin mode, then open **Admin → Providers**. Each provider stores a base URL, an API key, and an optional model map. Keys are stored locally in the Tauri OS-level store and never leave your machine except to the provider you configure.

> **MiniMax — regions.** The built-in seed targets the international endpoint. Chinese accounts need the `minimaxi.com` base URL.
> - International: `https://api.minimax.io/anthropic` · [get key](https://platform.minimax.io/user-center/basic-information/interface-key)
> - China: `https://api.minimaxi.com/anthropic` · [get key](https://platform.minimaxi.com/user-center/basic-information/interface-key)

<br />

## Build modes

| Mode           | Command                                         | Admin available?                |
| :------------- | :---------------------------------------------- | :------------------------------ |
| Public release | `npm run tauri build`                           | Via runtime toggle (`⌘⇧A`)      |
| Admin-full     | `VITE_ADMIN_MODE=1 npm run tauri build`         | Always on, can't toggle off     |

On Windows PowerShell: `$env:VITE_ADMIN_MODE='1'; npm run tauri build`.

<br />

## Architecture

- React 19 + Vite 8 on strict TypeScript, Rust backend via Tauri v2 commands
- Local JSON storage through the Tauri store plugin
- Secrets in the OS-level credential store (Tauri)
- No server, no telemetry, no accounts

Full module layout, command surface, event model and state shape in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

<br />

## Visual system

v5.5 "Terminal Dramatico" is built on a mono-first design language: JetBrains Mono as default, terminal panes in place of generic cards, ASCII framing, typed-caret affordances and a disciplined palette.

Tokens, type scale, motion rules and component anatomy live in [docs/VISUAL_SYSTEM.md](./docs/VISUAL_SYSTEM.md).

<br />

## Contributing

Issues and PRs welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md) and file bugs or propose features in [GitHub Issues](https://github.com/HelbertMoura/ai_launcher/issues).

<br />

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full history. Recent highlights:

| Version | Theme                                                       |
| :------ | :---------------------------------------------------------- |
| v6.0    | Bilingual interface (EN / pt-BR) with runtime switching     |
| v5.5.1  | Runtime admin toggle — no rebuild required                  |
| v5.5.0  | "Terminal Dramatico" visual rewrite                         |

<br />

## License

MIT. See [LICENSE](./LICENSE).
Copyright © 2026 Helbert Moura | DevManiac's.

<br />

## Credits

Built by **Helbert Moura** / **DevManiac's**, standing on the shoulders of:

- [Tauri](https://tauri.app) — Rust-powered desktop shell
- [React](https://react.dev) + [Vite](https://vitejs.dev) — frontend runtime
- [lucide-react](https://lucide.dev) — icon set
- [cmdk](https://cmdk.paco.me) — command palette primitive
- [react-i18next](https://react.i18next.com) — bilingual interface
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/), [IBM Plex Mono](https://www.ibm.com/plex/), [Cascadia Code](https://github.com/microsoft/cascadia-code) — mono typefaces
