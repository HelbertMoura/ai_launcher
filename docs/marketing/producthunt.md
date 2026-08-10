# AI Launcher — Product Hunt draft (v21)

> Draft for a Product Hunt launch. Edit, approve and submit when ready.
> Companion file: `dev-to.md` (long-form article) and `launch-checklist.md`
> (pre-launch checklist).

## Tagline (60 char max)

Lead pick — concrete, action verbs, fits under 60 chars:

> **One window to discover, install and run every AI coding CLI.**

Alternates (if you want to swap before submitting):

- **The Command Deck for AI coding CLIs.** *(37 chars — leans on the v21 visual identity)*
- **One desktop app for Claude, Codex, Qwen, Goose and 9 more.** *(56 chars — names check, but ages as more CLIs land)*
- **Detect, install, launch — every AI CLI in one window.** *(54 chars — punchiest, drops the "discover" verb)*

## Description (260 char max)

> AI Launcher: a free, open-source Tauri 2 desktop hub for 13 AI coding
> CLIs. Detects, installs and launches each one with the right
> provider, directory and MCP context. Windows today, macOS and Linux
> next.

*(199 chars. The full list of 13 CLIs lives in the first comment, so
the description stays scannable on the PH card.)*

## First comment (the "why we built it" post)

Hi Product Hunt 👋

I'm Helbert. I built **AI Launcher** because I was drowning in AI coding
CLIs. Every week a new one shipped, every one had its own install
ceremony, and none of them remembered the project I was actually working
on.

**What it does today**

- 🔍 **Detect** 13 CLIs across npm, pip and script installs (Claude,
  Codex, Qwen, Goose, Copilot, Cody, OpenCode, Kilo, Crush, Droid,
  Aider, Continue, Antigravity).
- 📦 **Install** missing ones with a single click and live progress
  events — no terminal flashing.
- 🚀 **Launch** with the right provider, directory and `.ailauncher.json`
  context per project.
- 🛠 **Manage IDEs** — VS Code, Cursor, Windsurf, Antigravity, plus
  custom entries.
- 🔌 **MCP Hub** with backups, health checks and catalog presets.
- 📜 **Runbooks** 3.0 with dry-run, approvals, retry and resume.
- 🔐 **Secrets** stored in Windows Credential Manager (never plaintext
  in storage).
- 🔄 **Auto-updates** verified by `tauri-plugin-updater` (the official
  Tauri 2 plugin) against a pubkey baked into the binary.

**Why it's different from a `.bat` file**

- Project context lives in `.ailauncher.json` (CLI, provider, env,
  MCPs, runbook) — checked into your repo, versioned with the code.
- Every session is recorded in a local history with provider and
  duration — replay any session with one click.
- Runbooks are real, first-class: dry-run by default, prompts for
  approval on destructive steps, retry/resume from a failed step.
- Storage is a registry, not a free-for-all: every read/write goes
  through a Zod-validated schema.

**The technical story**

- Tauri 2 + React 19 + Rust, on Windows. 92+ Rust tests, 217+ Vitest,
  0 npm audit vulns, 0 cargo audit vulns, SBOM published on every
  release.
- 13 supported CLIs, 6 built-in providers, 4 supported IDEs.
- Bundle: 41 kB main chunk gzipped (down 57% from v20 after vendor
  chunking with rolldown).
- GitHub: open source under MIT, `HelbertMoura/ai_launcher`.

**What's next**

- macOS and Linux builds
- Azure Trusted Signing for SmartScreen-clean releases
- More CLIs as they ship

I would love your feedback. What CLI did I miss? What runbook would
you automate first? 👇

## Gallery (image order, 1270×760 px each)

1. `docs/screenshots/v21/01-command-center.png` — Command Center (the
   home view, with workspace + recent sessions + readiness)
2. `docs/screenshots/v21/02-runbooks-command-deck.png` — Runbooks with
   dry-run, approvals, retry
3. `docs/screenshots/v21/03-mcp-hub.png` — MCP Hub with backups + health
4. `docs/screenshots/v21/04-history-timeline.png` — Session history
5. `docs/screenshots/v21/05-doctor-readiness.png` — Doctor / readiness
6. `docs/screenshots/v21/06-help-support.png` — Help / support

Optional bonus: a 30-second MP4/GIF showing a CLI being detected, then
installed, then launched — captures the "no terminal flashing" pitch.

## Topics to tag

`#developer-tools` `#ai` `#cli` `#productivity` `#open-source`
`#tauri` `#rust`

## Launch day (UTC)

- Post at **14:00 UTC** (10am ET / 11am BRT) — peak PH traffic.
- First comment goes up at submission, no delay.
- Maker schedule: 4 hours active in the comments after launch.

## Hunter

Use the company account if available, or Helbert's personal if not.
Quote the live GitHub star count in the first comment — refresh it
right before launch. The current public count is 0, so be honest
about it; "0 stars, 0 fluff" reads better than a fake round number.
