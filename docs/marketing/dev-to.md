# Building AI Launcher — long-form article draft (dev.to)

> Outline for a dev.to / blog post. Companion file: `producthunt.md`
> (shorter pitch) and `launch-checklist.md` (pre-launch checklist).
> Goal: walk through the technical decisions that made v21 a real
> product and not a `.bat` file.

## Title (under 60 char)

Lead pick — fits the cap (59 chars):

> **Stop wiring CLIs by hand: a Tauri + Rust hub for 13 AI CLIs**

Alternatives:

- "From scripts to a product: 18 months of building a desktop hub for AI CLIs" *(78 chars — over cap, dev.to trims tags anyway)*
- "Why I rebuilt my AI launcher in Tauri 2 (and what I learned about signing)" *(74 chars — over cap)*

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

Show `docs/ARCHITECTURE.md` as a callout (the "Directory Layout"
tree is screenshot-friendly at 800 px).

Key points:

- All side effects (spawn, kill, install, file IO) live in
  `src-tauri/src/commands/*` and are registered in
  `src-tauri/src/main.rs`. The frontend is a view layer that talks to
  them via `invoke()` from `@tauri-apps/api/core`.
- A `.ailauncher.json` per project is the single source of truth for
  CLI, provider, env, MCPs and runbook. It is read/written by
  `commands/cli.rs::read_project_profile` and
  `commands/cli.rs::write_project_profile` (path-validated, size-capped).
- Storage is a Zod-validated registry (`src/lib/storage/registry.ts`),
  not localStorage free-for-all. See `src/lib/auditLog.ts` for the
  bounded append-only log.

### 5. The features that took the longest

#### 5.1 The auto-updater that almost shipped broken

- v20 shipped a custom Rust updater that called the GitHub Releases
  API, downloaded the NSIS installer, and verified a SHA-256 manifest
  (see `docs/releases/v20.0.0.md`, "Updater Trust").
- It worked, but the trust chain lived in our own code: GitHub
  username + repo + tag + asset name. One typo in the asset name and
  the updater silently no-op'd.
- v21 replaces it with `tauri-plugin-updater` (declared in
  `src-tauri/Cargo.toml` and configured in
  `src-tauri/tauri.conf.json` under `plugins.updater`). Three things
  changed:
  - Endpoint in `tauri.conf.json` → `endpoints[0]`.
  - Generated pubkey baked into the binary.
  - Release workflow signs the installer and emits `latest.json` in
    the plugin's manifest schema (see `.github/workflows/release.yml`
    and `scripts/generate-latest-json.sh`).
- Net effect: the custom crypto path is gone, the manifest comes from
  the Tauri team, and the verifier is the same one every other
  Tauri 2 app uses.

#### 5.2 Secrets that fail closed

- Old: API keys in `localStorage` (visible to any XSS).
- New: Windows Credential Manager via the Win32 CredRead / CredWrite
  API, called from `src-tauri/src/secrets.rs` using the
  `windows-sys` crate (`Win32_Security_Credentials` feature in
  `src-tauri/Cargo.toml`). The frontend never sees the plaintext after
  the user types it.
- Migration: a one-shot in `src/providers/storage.ts` reads every
  legacy key, writes to Credential Manager, and only then deletes the
  source — gated by a successful read-back from Credential Manager
  before the legacy entry is removed.

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
  the state machine. The Command Center got refactored twice before it
  felt right.
- **Don't bundle 13 CLIs in the first release.** v1 was 4 CLIs and a
  much smaller surface. Adding CLIs is now data (`src-tauri/src/util.rs::get_cli_definitions`),
  not code.
- **Up-front signing.** I waited until v21 to set up
  `tauri-plugin-updater` properly. The first v20 release had a manual
  SHA-256 dance that scared one user into thinking the download was
  corrupted. `docs/SIGNING.md` exists now; future projects would adopt
  it on day one.

### 8. What's next

- macOS and Linux builds
- Azure Trusted Signing for SmartScreen-clean releases
- A real "AI Launcher Hub" page for community-shared runbooks

### 9. Try it

- GitHub: <https://github.com/HelbertMoura/ai_launcher>
- v21.0.0 release: <https://github.com/HelbertMoura/ai_launcher/releases/tag/v21.0.0>
- Windows installers: `.exe` (NSIS) and `.msi` under "Assets" on the
  release page. SmartScreen will warn on unsigned builds — click
  *More info → Run anyway* (or wait for the signed release).
- Free, open source under MIT.

## Code blocks to embed

- A trimmed `.ailauncher.json` example (the "happy path" with `cli`,
  `provider`, `env`, `mcp` populated; redact `env` before publishing).
- The `plugins.updater` block from `src-tauri/tauri.conf.json` —
  endpoint + pubkey + `windows.installMode: "passive"`. This is the
  "trust chain in 8 lines" money shot for the article.
- The `latest.json`-emitting step in `.github/workflows/release.yml`
  (the one that calls `scripts/generate-latest-json.sh`).
- A short Rust snippet showing the wrapper command in
  `src-tauri/src/commands/updater.rs` that drives
  `tauri-plugin-updater::check()` (it is *not* `app.updater().check()`
  directly — the backend wraps it so the frontend never touches raw
  download URLs).
- A side-by-side of `src/lib/storage/registry.ts` keys vs. the raw
  `localStorage` keys they replaced. Makes the "Zod-validated registry,
  not free-for-all" claim concrete.

## Estimated length

~2,500 words. Target: 12-minute read.
