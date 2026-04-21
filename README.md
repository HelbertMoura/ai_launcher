<div align="center">
  <img src="./public/images/banner.svg" alt="AI Launcher Pro" width="100%" />

  <br />

  <h1>AI Launcher Pro</h1>

  <p>
    <strong>The terminal-native launcher for every AI coding CLI.</strong>
  </p>

  <p>
    Eight built-in CLIs. Six Anthropic-compatible providers. Custom CLIs and IDEs. Bilingual. Local-first. Zero telemetry.
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

**Platforms:** Windows ✅ · macOS 🔜 · Linux 🔜

<br />

## What it is

AI Launcher Pro is a Tauri v2 desktop app that consolidates every AI coding CLI worth using — Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush, Factory Droid — behind one keyboard-first surface. Detect what's installed, install what isn't, point any Anthropic-compatible CLI at a different backend, track every run, and never leave the terminal aesthetic.

It fits the way working developers already move. You open it with a shortcut, the launcher card tells you the CLI's version and status at a glance, you pick a working directory, hit `Launch`, and a real Windows Terminal session spawns with the correct env vars injected. The launcher keeps a git-log-style history, aggregates token spend into a daily budget, and never phones home. No accounts to create. No login screen. No "first-time setup" that nags you for three days.

Where it differs from opening a terminal by hand: **keyboard-first from the ground up** (command palette, chord tabs, preset hotkeys), **bilingual out of the box** (EN / pt-BR auto-detected, switch at runtime), **zero telemetry and zero accounts** (tokens live in your local storage only, redacted in every toast and log), and **extensible without recompiling** (add custom CLIs, custom IDEs, and override any built-in's display name or icon — all from the GUI, persisted to localStorage, zero source edits).

<br />

## Highlights

### Launch & manage
- 8 built-in AI CLIs — Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush, Factory Droid — detected or installed from the app
- Add your own CLI in 30 seconds — name, install command, version check, optional icon. Persisted locally, launchable just like a built-in
- Git-log-style history with inline re-run, copy-args, and provider attribution per entry
- 9 keyboard-first tabs — `⌘K` palette, `⌘⇧1-4` primary tabs, `⌘/` help, `⌘1-9` preset launches

### Multi-provider
- 6 Anthropic-compatible providers seeded: **Anthropic**, **Z.AI (GLM)**, **MiniMax**, **Moonshot / Kimi**, **Qwen / DashScope (beta)**, **OpenRouter**
- Switch the active provider in one click from Admin → Providers
- Per-profile model overrides, per-launch one-shot overrides, and per-profile daily budget tracking
- Test-connection button hits the backend via Rust `ureq` (no CORS), echoes latency + model id, costs zero tokens (`max_tokens: 1`)
- Custom profiles for any Anthropic-compatible endpoint — bring your own base URL, your own key, your own model slug

### UX
- Terminal-native visual language — mono typography, prompt `>` motifs, git-log rails, cost sparklines, ASCII framing
- **Bilingual interface** — auto-detects EN or pt-BR from browser locale, switch at runtime via globe dropdown or `⌘⇧L`
- Live cost aggregation with daily budget bar and per-CLI 7-day sparkline trend
- Command palette with preview pane, pinned/recent sections, lucide icons, keycap footer

### Polish
- 5 font choices (JetBrains Mono default, IBM Plex Mono, Cascadia Code, Berkeley Mono, System) with live preview
- Light and dark themes with `prefers-reduced-motion` honored end-to-end
- Override any built-in CLI's or IDE's display name and icon — hover the card, click the ✎ button
- In-app update checker wired to the GitHub Releases API (6h cache), non-blocking status pill in the footer
- Help modal (`⌘/`) with every shortcut indexed and a global FAQ search across 10 Q&A entries
- 4-step onboarding with a 9-slide tour carousel covering every tab, arrow-key navigable
- Config export / import (JSON, secrets redacted) for moving profiles between machines

<br />

## Screenshots

<p align="center">
  <img src="./docs/screenshots/launcher-dark.png"     alt="Launcher — dark theme"    width="48%" />
  <img src="./docs/screenshots/history-timeline.png"  alt="Git-log-style history"    width="48%" />
</p>
<p align="center">
  <img src="./docs/screenshots/costs-sparklines.png"  alt="Costs with sparklines"    width="48%" />
  <img src="./docs/screenshots/command-palette.png"   alt="Command palette preview"  width="48%" />
</p>

<br />

## Install

### End users

Grab the latest `.msi` or `.exe` from the [releases page](https://github.com/HelbertMoura/ai_launcher/releases/latest). Run it.

Windows SmartScreen may warn on unsigned builds. Click **More info → Run anyway**, or build from source for full provenance. Local signing helpers live in [`scripts/gen-cert.ps1`](./scripts/gen-cert.ps1) and [`scripts/sign-build.ps1`](./scripts/sign-build.ps1).

### From source

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev                             # hot-reload dev
npm run tauri build                           # installers in src-tauri/target/release/bundle/
VITE_ADMIN_MODE=1 npm run tauri build         # admin always-on build
```

On Windows PowerShell, set the env var inline with `$env:VITE_ADMIN_MODE='1'; npm run tauri build`.

**Prerequisites:** Node 18+, [Rust stable](https://rustup.rs/), Windows 10 or 11, Visual Studio Build Tools with the **Desktop development with C++** workload.

<br />

## Supported CLIs

Built-in, detected or installable from the app:

| CLI            | Install command                                 | Auto-injected flag                            |
| :------------- | :---------------------------------------------- | :-------------------------------------------- |
| Claude Code    | `npm install -g @anthropic-ai/claude-code`      | `--dangerously-skip-permissions`              |
| Codex          | `npm install -g @openai/codex`                  | `--dangerously-bypass-approvals-and-sandbox`  |
| Gemini         | `npm install -g @google/gemini-cli`             | `--yolo`                                      |
| Qwen           | `npm install -g @qwen-code/qwen-code`           | `--yolo`                                      |
| Kilo Code      | `npm install -g @kilocode/cli`                  | `--auto`                                      |
| OpenCode       | `npm install -g opencode-ai`                    | `--dangerously-skip-permissions`              |
| Crush          | `npm install -g @charmland/crush`               | `--yolo`                                      |
| Factory Droid  | `irm https://app.factory.ai/cli/windows \| iex` | `--skip-permissions-unsafe`                   |

**Need something else?** Admin → **Add Custom CLI**. Fill in name, install command, version check, optional launch args, docs URL, and an emoji icon. It will render in the Launcher with a dashed-border variant and behaves exactly like a built-in. See [Customize](#customize) below.

<br />

## Providers

AI Launcher Pro points any Anthropic-compatible CLI at a different backend by injecting the right env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, plus model overrides) at launch time.

### Built-in seeds

| Provider              | Type       | Base URL (intl)                                        | Main model                              | Context | Notes                                                                 |
| :-------------------- | :--------- | :----------------------------------------------------- | :-------------------------------------- | :------ | :-------------------------------------------------------------------- |
| Anthropic             | official   | —                                                      | `claude-opus-4-7`                       | 1M      | Default config — no env override                                      |
| Z.AI (GLM)            | native     | `api.z.ai/api/anthropic`                               | `glm-5.1`                               | 200K    | Maps opus/sonnet → glm-5.1, haiku → glm-4.7                           |
| MiniMax               | native     | `api.minimax.io/anthropic`                             | `MiniMax-M2.7`                          | 200K    | China: `api.minimaxi.com/anthropic`                                   |
| **Moonshot / Kimi**   | native     | `api.moonshot.ai/anthropic`                            | `kimi-k2-0905-preview`                  | 256K    | Official "Kimi for Code" plan. China: `api.moonshot.cn/anthropic`     |
| **Qwen / DashScope**  | **beta**   | `dashscope-intl.aliyuncs.com/api/v2/apps/claude-code`  | `qwen3-coder-plus`                      | 256K    | ⚠️ Claude Code integration in validation. Endpoint may change          |
| **OpenRouter**        | aggregator | `openrouter.ai/api/v1`                                 | any slug (e.g. `anthropic/claude-sonnet-4`) | varies  | One key, dozens of models (Anthropic, Moonshot, Qwen, GLM, Gemini, GPT) |
| Custom                | custom     | any Anthropic-compat URL                               | —                                       | —       | Roll your own                                                         |

Tokens are local-only — stored in browser `localStorage`, redacted in every toast and log, and transmitted only to the provider you configured.

### Regions / CN endpoints

- **MiniMax** — international `api.minimax.io/anthropic`, China `api.minimaxi.com/anthropic`
- **Moonshot** — international `api.moonshot.ai/anthropic`, China `api.moonshot.cn/anthropic`
- **Qwen** — international `dashscope-intl.aliyuncs.com/...`, China `dashscope.aliyuncs.com/...`

### API key portals

- **Anthropic** — https://console.anthropic.com/
- **Z.AI** — https://z.ai/model-api
- **MiniMax** (Intl) — https://platform.minimax.io/ · (CN) — https://api.minimaxi.com/
- **Moonshot** (Intl) — https://platform.moonshot.ai/ · (CN) — https://platform.moonshot.cn/
- **Qwen (DashScope)** (Intl) — https://dashscope-intl.console.aliyun.com/ · (CN) — https://bailian.console.aliyun.com/
- **OpenRouter** — https://openrouter.ai/keys

<br />

## Terminal example

A typical launcher session, from the user's perspective:

```text
$ ai_launcher --provider kimi
● kimi.moonshot · kimi-k2-0905-preview
  context 256k · pricing $0.60/M in
> launch claude in ./my-project
  running · pid 44892 · session ready in 184ms
  env injected: ANTHROPIC_BASE_URL + 2 vars
  history entry saved with provider attribution

$ ai_launcher
[opens GUI; keyboard-first launcher ready]
```

<br />

## Keyboard shortcuts

| Keys       | Action                                                           |
| :--------- | :--------------------------------------------------------------- |
| `⌘K`       | Command palette                                                  |
| `⌘⇧1-4`    | Switch primary tabs (Launcher / Install / History / Costs)       |
| `⌘1-9`     | Launch preset by index                                           |
| `⌘/`       | Help modal                                                       |
| `⌘⇧A`      | Toggle admin mode                                                |
| `⌘⇧L`      | Cycle language (EN ↔ pt-BR)                                      |
| `⌘L`       | Focus working-directory input                                    |
| `F5`       | Re-check installed CLIs                                          |
| `Esc`      | Close active modal                                               |

On Windows/Linux `⌘` = `Ctrl`, `⇧` = `Shift`. Every shortcut is guarded against firing while the user is typing in an input, textarea, select, or contenteditable element.

<br />

## Language

The interface ships in English and Brazilian Portuguese, with full parity — every tab label, modal, toast, onboarding step, FAQ entry, and validation message has a translated counterpart.

On first launch the app reads `navigator.language`: `pt*` resolves to pt-BR, everything else falls back to English. Switch at runtime from the globe dropdown in the header bar, or hit `⌘⇧L` for an instant cycle with toast confirmation. The choice persists under `localStorage['ai-launcher:locale']`.

Custom content (preset names, history entries, provider display names you typed) is **never** translated — it stays verbatim.

<br />

## Admin mode

Admin mode unlocks the Providers, Backup and Preferences panels. Tokens stay local in every mode — the gate exists only to keep the default surface minimal for new users.

| Method        | How                                                       | Persistence              |
| :------------ | :-------------------------------------------------------- | :----------------------- |
| Chord         | `⌘⇧A` (toast confirms state)                              | `localStorage`           |
| URL param     | Launch with `?admin=1` (or `?admin=0` to disable)         | `localStorage`           |
| Build flag    | `VITE_ADMIN_MODE=1 npm run tauri build`                   | Permanent, always on     |

Precedence (highest wins): build flag → URL query → localStorage.

<br />

## Customize

### Add your own CLI

Admin → **Add Custom CLI** opens a validated form. Fill in display name, key, install command, version check, optional launch args, docs URL and an icon emoji. It renders in the Launcher with a dashed-border variant, can be edited or removed any time, and launches through the same `launch_custom_cli` Rust spawn chain as the built-ins (Windows Terminal → pwsh → powershell → cmd fallback).

Storage key: `ai-launcher:custom-clis`.

### Add your own IDE

Tools tab → **Add Custom IDE** mirrors the CLI flow. Accepts name, key, detect command, launch command (with `<dir>` placeholder resolved at launch), docs URL and icon. The Tools tab gains a **Launch** button per custom row.

Storage key: `ai-launcher:custom-ides`.

### Override built-in name and icon

Hover any built-in CLI or IDE card — a `✎` edit button appears. Change the display name or icon (emoji/text), save, done. It does **not** touch source, install commands or Rust keys — only how the card reads on screen. Leave both fields empty and save to reset.

Storage keys: `ai-launcher:cli-overrides`, `ai-launcher:ide-overrides`.

### Preferences

Admin → **Preferences** surfaces three knobs:

| Setting           | Default        | Effect                                                                 |
| :---------------- | :------------- | :--------------------------------------------------------------------- |
| `maxHistory`      | 50             | Caps history array size (trims oldest on every new entry)              |
| `refreshInterval` | 0 (manual)     | Seconds between automatic CLI re-checks; 0 keeps F5 manual             |
| `commandTimeout`  | 300s           | Max wall-clock time for `install_cli` / `update_cli` subprocesses      |

Reset-to-defaults button restores stock values without touching any other settings.

<br />

## Build modes

| Mode           | Command                                         | Admin available?                |
| :------------- | :---------------------------------------------- | :------------------------------ |
| Public release | `npm run tauri build`                           | Via runtime toggle (`⌘⇧A`)      |
| Admin-full     | `VITE_ADMIN_MODE=1 npm run tauri build`         | Always on, cannot toggle off    |

<br />

## Architecture at a glance

```
src/
├── layout/         HeaderBar, StatusBar, HelpModal
├── tabs/           LauncherTab, HistoryTab, CostsTab, AdminTab, HelpTab
├── providers/      AdminPanel, CustomCliModal, CustomIdeModal, CliOverrideModal
├── shared/         KeyCap, TerminalFrame, PromptLine, Sparkline
├── icons/          lucide-react curated re-exports
├── lib/            customClis, customIdes, clisOverrides, appSettings, configIO
├── i18n/           locales/{en,pt-BR}.json + index.ts
└── styles/         tokens, fonts, motion
```

React 19 + Vite 8 on strict TypeScript front; Rust backend via Tauri v2 commands (`launch_cli`, `launch_custom_cli`, `launch_custom_ide`, `install_cli`, `update_cli`, `test_provider_connection`, `check_latest_release`, `reset_claude_state`). State lives in `localStorage` with CustomEvent dispatch for same-tab reactive sync — Admin changes apply without a reload.

Launch chain on Windows cascades through Windows Terminal → pwsh → powershell → cmd, with PS-encoded args to avoid quoting issues. Install/update subprocesses are wrapped with `tokio::time::timeout` so a stuck `npm install` cannot hang the UI.

Full launch flow, command surface and `localStorage` key schema in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

<br />

## Visual system

v5.5 "Terminal Dramático" — mono-first typography (JetBrains Mono default, self-hosted, ~87 KB woff2, 4 weights subset-latin), oklch palette with warm-red prompt accent, 4px spacing grid, disciplined motion. Animations stay on compositor-friendly properties (`transform`, `opacity`, `clip-path`) and collapse under `prefers-reduced-motion`.

Every surface leans on a small shared vocabulary: `TerminalFrame`, `PromptLine`, `KeyCap`, `Sparkline`, `EmptyState` (3 SVG variants), and skeleton loaders for every card type. Icons come from `lucide-react` — 37 curated re-exports in `src/icons/index.ts`, zero emoji in built-in UI chrome.

Tokens, type scale, motion rules and component anatomy live in [`docs/VISUAL_SYSTEM.md`](./docs/VISUAL_SYSTEM.md).

<br />

## Privacy & security

- **No telemetry.** The app makes zero outbound requests on its own. Every HTTP call is user-initiated — a launch, a connection test, or the GitHub Releases check.
- **No accounts.** Nothing to register for. Nothing to log into. Install, launch, use.
- **Tokens are local.** Provider API keys live in browser `localStorage` under the app's origin. They are redacted from every toast, log, and config export. `.env.local` and `.env.*` (except `.env.example`) are in `.gitignore`.
- **No secrets in this repo.** The codebase ships zero credentials. Every build is reproducible from the source tree.

<br />

## Contributing

Issues and PRs welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, commit format, and PR conventions. Bugs and feature requests go in [GitHub Issues](https://github.com/HelbertMoura/ai_launcher/issues).

<br />

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md) for the full history. Recent highlights:

| Version    | Theme                                                                  |
| :--------- | :--------------------------------------------------------------------- |
| **v7.1.0** | Polish & Wire — bug fixes, custom launches wired, override built-ins   |
| **v7.0.0** | Extensible — custom CLIs, custom IDEs, FAQ tab, admin preferences      |
| **v6.1.0** | More providers — Moonshot, Qwen beta, OpenRouter                       |
| **v6.0.0** | Bilingual — EN / pt-BR with runtime switch                             |
| **v5.5.1** | Runtime admin toggle                                                   |
| **v5.5.0** | Terminal Dramático — full visual redesign                              |

<br />

## License

MIT. See [LICENSE](./LICENSE). Copyright © 2026 Helbert Moura | DevManiac's.

<br />

## Credits

Built with [Tauri v2](https://v2.tauri.app), [React 19](https://react.dev), [Vite 8](https://vite.dev), [lucide-react](https://lucide.dev), [cmdk](https://cmdk.paco.me), [JetBrains Mono](https://www.jetbrains.com/lp/mono), [react-i18next](https://react.i18next.com).
