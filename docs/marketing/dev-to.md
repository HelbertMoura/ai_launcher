# Building AI Launcher — long-form article draft (dev.to)

> Outline for a dev.to / blog post. Companion file: `producthunt.md`
> (shorter pitch) and `launch-checklist.md` (pre-launch checklist).
> Goal: walk through the technical decisions that made v21 a real
> product and not a `.bat` file.

## Title (under 60 char)

> **Stop wiring CLIs by hand: building a Tauri + Rust hub for 13 AI agents**

Alternatives:

- "From scripts to a product: 18 months of building a desktop hub for AI CLIs"
- "Why I rebuilt my AI launcher in Tauri 2 (and what I learned about signing)"

## Cover image

A terminal-style hero (the existing `docs/terminal-hero.svg` works).
Alternative: a 3-up mosaic of Command Center / Runbooks / MCP Hub.

## Section outline

### 1. The problem: AI CLIs are amazing and annoying

- 13 CLIs (and counting) to discover, install, update, run.
- Each has its own flag, env vars, install command, version check.
- Project context (which CLI, which provider, which `.env`) lives in
  your head or in shell snippets scattered across the team.
- Every new CLI adds another loop of `npm i -g`, `claude --version`,
  `which foo`, `cp .env .env.local`.

### 2. The first version was a `.bat` file (and why it stopped working)

- 6 months ago: a single Windows `.bat` that ran `claude --dangerously-skip-permissions`.
- It grew: flags, env, multiple CLIs, kill/restart.
- It died when: MCP support showed up (5-minute setup × per agent × per
  project), and when the second teammate needed the same config.

### 3. The bet: Tauri 2 + Rust + React 19

- Why Tauri (vs Electron): a 5 MB binary instead of 100 MB, real
  filesystem access, Rust on the inside.
- Why Rust on the back: process orchestration is where the bugs are.
  Strong types + tests catch them.
- Why React on the front: the team already knows it, and the surface
  is mostly state-driven UI.

### 4. The architecture: a Rust core with a React shell

Show `docs/ARCHITECTURE.md` as a callout.

Key points:

- All side effects (spawn, kill, install, file IO) live in
  `src-tauri/src/commands/*`. Frontend is purely a view layer.
- A `.ailauncher.json` per project is the single source of truth for
  CLI, provider, env, MCPs, runbook.
- Storage is a Zod-validated registry, not localStorage free-for-all.

### 5. The features that took the longest

#### 5.1 The auto-updater that almost shipped broken

- v20 used a custom `self_update.rs` that called the GitHub API,
  downloaded the NSIS installer, and verified a SHA-256.
- It worked, but the "trust chain" was: GitHub username + repo + tag +
  asset name. Easy to get wrong.
- v21 replaces it with `tauri-plugin-updater`. Three changes:
  - Endpoint in `tauri.conf.json`
  - Generated pubkey baked in
  - Release workflow signs the installer and emits `latest.json` in
    the plugin's schema
- Code: −180 lines, attack surface: −1 whole custom crypto path.

#### 5.2 Secrets that fail closed

- Old: API keys in `localStorage` (visible to any XSS).
- New: Windows Credential Manager via the `keyring` crate. The
  frontend never sees the plaintext after the user types it.
- Migration: a one-shot reads every legacy key, writes to Credential
  Manager, and deletes the source — only after a successful read-back.

#### 5.3 Runbooks as first-class

- A runbook is a YAML/JSON list of steps (commands, file edits, MCP
  checks, conditionals).
- Every step has a risk level: safe (auto-run), review (preview +
  approve), destructive (preview + confirm + log).
- Dry-run by default. The first time a step is real, the user sees
  the exact command, the working dir, and the env.

#### 5.4 The `.ailauncher.json` contract

- Checked into the repo, versioned with the code.
- One file, four sections: `cli`, `provider`, `env`, `mcp`.
- The Doctor reads it and tells you what's missing.

### 6. The metrics that surprised me

- Bundle main chunk: 339 kB → 127 kB (−62% raw, −57% gzip) after
  vendor chunking with rolldown.
- Tests: 92 Rust + 217 Vitest, all green, no flaky.
- Time from `git tag v22.0.0` to published release: 8 minutes (CI
  + signing + manifest + GitHub release).

### 7. The things I'd do differently

- **Sketches first.** I started coding the UI before I had a sketch of
  the state machine. Refactored twice.
- **Don't bundle 13 CLIs in the first release.** v1 was 4 CLIs and a
  much smaller surface. Adding CLIs is now data, not code.
- **Up-front signing.** I waited until v21 to set up
  `tauri-plugin-updater` properly. The first v20 release had a manual
  SHA-256 dance that scared a user into thinking the download was
  corrupted.

### 8. What's next

- macOS and Linux builds
- Azure Trusted Signing for SmartScreen-clean releases
- A real "AI Launcher Hub" page for community-shared runbooks

### 9. Try it

- GitHub: `https://github.com/HelbertMoura/ai_launcher`
- v21.0.0 release: `https://github.com/HelbertMoura/ai_launcher/releases/tag/v21.0.0`
- Free, open source under MIT.

## Code blocks to embed

- The `.ailauncher.json` example from the docs
- The 4-line `tauri.conf.json` updater config
- The release workflow `latest.json` step
- A short Rust snippet showing `app.updater().check()`

## Estimated length

~2,500 words. Target: 12-minute read.
