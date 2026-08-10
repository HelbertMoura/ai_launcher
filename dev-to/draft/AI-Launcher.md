---
title: "Stop wiring CLIs by hand: a Tauri + Rust hub for 13 AI CLIs"
published: false
description: "How we turned a Windows .bat file into a releaseable product, and the 5 decisions that mattered."
cover_image: https://raw.githubusercontent.com/HelbertMoura/ai_launcher/main/docs/terminal-hero.svg
canonical_url: https://github.com/HelbertMoura/ai_launcher
tags: tauri, rust, react, windows, devtools
---

![AI Launcher — terminal hero](https://raw.githubusercontent.com/HelbertMoura/ai_launcher/main/docs/terminal-hero.svg)

*How we turned a Windows `.bat` file into a releaseable product, and the 5 decisions that mattered.*

## 1. The problem: AI CLIs are amazing and annoying

3 AM. I had just finished wiring up Claude Code in a new project for the second time that week. The terminal was a graveyard of half-typed commands: `npm i -g @anthropic-ai/claude-code`, then `claude --version`, then `which claude`, then `cp .env.example .env`, then the inevitable `git status`. My `.env` was in `.gitignore` (it always is, after the first time). It was, again, in the wrong place.

Then I needed Codex for the same project. Different install. Different env var. Different "yolo" flag. Then a teammate asked for the same setup in *their* machine. The Slack thread was twelve messages long and ended with a `.zip` of my dotfiles that I knew would be outdated by Monday.

If you use any of the modern AI coding tools long enough, you hit the same wall: no canonical "give me the right CLI with the right env for *this* project" button. Each tool has its own installer (npm, pip, or `irm … | iex`), its own confirmation-skip flag, its own env var convention, its own `~/.config/` directory. AI Launcher ships with **13** CLIs wired into a single surface — Claude, Codex, Qwen, Kilo Code, OpenCode, Aider, Continue, Crush, Factory Droid, Antigravity, Cody, GitHub Copilot, and Goose (defined in [`src-tauri/src/util.rs:86`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/src-tauri/src/util.rs#L86)). Project context was living in shell snippets scattered across the team.

**The takeaway:** if you find yourself `cp`-ing dotfiles into Slack, the problem is not your dotfiles. It is that the "which CLI am I on" decision is not yet a first-class object.

## 2. The first version was a `.bat` file (and why it stopped working)

Six months before v21, the launcher was a single Windows `.bat` on my desktop:

```bat
@echo off
claude --dangerously-skip-permissions
```

That's it. That was the product. It worked for me. Then it grew.

The first branch added a second CLI and a kill/restart loop. The next added env-var loading. The next added the install command. By month three, the `.bat` had 180 lines, three labels, a `goto` maze I was afraid to touch, and a comment that said "DO NOT EDIT — this works". That comment is a smell.

The script died when MCP support showed up. Model Context Protocol servers are per-agent and per-project. Setting them up for thirteen CLIs across N projects takes the morning. The `.bat` could not represent that matrix. When a second teammate needed the same config, there was no way to hand it over that did not involve `cp`-ing my dotfiles.

So I opened a Tauri scaffold and called it a product. The honest version: I did not know it was going to be a product. I thought I was writing a wrapper around `claude.exe`. The wrapper turned out to be the part that took the longest to get right.

**The takeaway:** the moment a "one-off script" gets a second user, the script is now a product. The sooner you treat it like one, the less you have to rewrite.

## 3. The bet: Tauri 2 + Rust + React 19

**Tauri 2 instead of Electron.** A Tauri 2 build of AI Launcher weighs in around 5 MB for the NSIS installer; the equivalent Electron app would be 100 MB before any of our code. That is the difference between a download that finishes during a coffee break and one that a user gives up on. Tauri also gives us the real filesystem, the real process tree, and a real OS-level security boundary around the secrets we will eventually have to store.

**Rust on the back.** Process orchestration is where the bugs are. We spawn CLIs, parse their stdout, watch them for crashes, kill them cleanly. That code path runs in Rust because the types and the tests catch the off-by-one and double-free that JavaScript quietly ships. The crate pulls in `tauri`, `tauri-plugin-updater`, `tokio`, `ureq`, and (on Windows) `windows-sys` for the Win32 API calls in section 5.2 — all in `src-tauri/Cargo.toml`.

**React 19 on the front.** The team already knew it. The surface is state-driven UI: a list of CLIs, a list of profiles, a launch dialog, a session timeline. We picked it because the alternative cost was retraining.

The numbers on the bet: **82 Rust tests** and **217 Vitest tests**, all green, all running on every PR. I cannot prove Tauri was the right call in advance, but I can show you a 5 MB installer that installs in 8 seconds, and that is enough.

**The takeaway:** pick the stack by the failure modes you cannot afford.

## 4. The architecture: a Rust core with a React shell

The repository is a two-layer Tauri app. The directory layout (see `docs/ARCHITECTURE.md`) is short enough to fit in a screenshot:

```
ai-launcher-tutra/
├── src/                      # React frontend
│   ├── app/                  # App shell, layout, onboarding
│   ├── features/             # command-center, launcher, mcp, history…
│   ├── lib/                  # Storage, config IO, project profiles
│   └── providers/            # Provider state, budgets, launch env
└── src-tauri/                # Rust backend, Tauri config, Windows icons
```

The hard rule: every side effect — spawning a CLI, killing a session, reading a file, writing a `.ailauncher.json` — lives in `src-tauri/src/commands/*` and is registered in `src-tauri/src/main.rs` (the `invoke_handler!` macro lists them by name). The React side is a view layer that calls them via `invoke()` from `@tauri-apps/api/core`. The frontend never owns a process.

The per-project source of truth is `.ailauncher.json`, committed at the repo root. Its zod schema is in [`src/lib/projectProfile.ts:24`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/src/lib/projectProfile.ts#L24):

```ts
export const projectProfileSchema = z.object({
  version:  z.number().int().positive().default(1),
  cli:      z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  env:      z.record(z.string(), z.string()).optional(),
  mcp:      z.array(z.string()).optional(),
  runbook:  z.string().optional(),
}).passthrough();
```

Read it on the backend via `commands::cli::read_project_profile` (path-validated, size-capped at 256 kB), write it via `commands::cli::write_project_profile`. The frontend parses, the backend transports bytes. A teammate cloning the repo gets the same launch config without re-typing it.

On the frontend, the temptation is to use `localStorage` as a bag of whatever. We did not. The contract is in [`src/lib/storage/registry.ts`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/src/lib/storage/registry.ts): a Zod-validated registry where every persisted key has a schema, a default, a `version` field, and an optional `migrate()` function. Reads go through a boundary that returns the default on a corrupt blob instead of crashing. The bounded audit log in [`src/lib/auditLog.ts`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/src/lib/auditLog.ts):

```ts
const MAX_EVENTS = 200;
const SECRET_LIKE = /(?:sk-[a-z0-9_-]{8,}|bearer\s+\S+|...)/gi;
export function appendAuditEvent(event) {
  const complete = { ...event, detail: redact(event.detail),
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    at: new Date().toISOString() };
  writeKey('auditLog', [complete, ...readKey('auditLog')].slice(0, MAX_EVENTS));
}
```

200 events, a redaction regex, an append-only contract. Boring on purpose.

**The takeaway:** decide the data shape before you decide the framework. The registry made the backup/export story trivial; the schema in `projectProfile.ts` made MCP and runbook wiring possible without a database.

## 5. The features that took the longest

Four features consumed most of v21's clock.

### 5.1 The auto-updater that almost shipped broken

The v20 release shipped a custom updater written in Rust. It called the GitHub Releases API, downloaded the NSIS installer, and verified a SHA-256 manifest we generated ourselves. The code worked. It also had a trust chain that lived entirely in our own code: GitHub username + repo + tag + asset name. One typo and the updater silently no-op'd. I learned this when a user reported that "Check for updates" did nothing — the bug was a single missing `v` in the asset regex.

v21.1.0 deletes that file. The updater is now the official `tauri-plugin-updater`. The endpoint is in `src-tauri/tauri.conf.json` under `plugins.updater`:

```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/HelbertMoura/ai_launcher/releases/latest/download/latest.json"
    ],
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEJBRjQwMjU3RENEQjc5RUUKUldUdWVkdmNWd0wwdWpONlpGd0pWbjBVRDB4WDZiVG5qN3FRcVhFZHhmSklIbkNTRzQzTUI0bEkK",
    "windows": { "installMode": "passive" }
  }
}
```

The pubkey is baked into the binary. The release workflow signs the NSIS installer with `tauri signer sign` and emits `latest.json` in the plugin's schema. The plugin verifies the signature against the baked-in pubkey before downloading. The Rust side is a thin wrapper — the real `check()` call is in [`src-tauri/src/commands/updater.rs:62`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/src-tauri/src/commands/updater.rs#L62):

```rust
pub async fn check_app_update(app: AppHandle) -> Result<AppUpdateInfo, String> {
    let current = env!("CARGO_PKG_VERSION");
    let updater = app.updater().map_err(|e| format!("updater init: {e}"))?;
    let result = updater.check().await.map_err(|e| format!("update check: {e}"))?;
    // compare_versions + serialize AppUpdateInfo
}
```

The frontend contract is preserved, so the React hook did not change. The trust chain moved from "whatever I wrote at 2 AM" to "what the Tauri team maintains".

**The takeaway:** when you can adopt an official, well-maintained plugin for a security-critical subsystem, do it.

### 5.2 Secrets that fail closed

The old version stored API keys in `localStorage`. Visible to any XSS, any browser extension, anyone with read access to the user's profile directory. Fine for a private tool, not fine for something I was about to put on GitHub.

The new path uses Windows Credential Manager through the Win32 `CredRead` / `CredWrite` API, called from Rust in [`src-tauri/src/secrets.rs`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/src-tauri/src/secrets.rs):

```toml
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.61.2", features = [
  "Win32_Foundation",
  "Win32_Security_Credentials",
  "Win32_Security_Cryptography",
  "Win32_System_Threading",
] }
```

The frontend never sees plaintext after the user types it. The flow is: type into an input, `invoke('store_secret', { key, value })`, the Rust side calls `CredWriteW` with `CRED_TYPE_GENERIC`, and re-reads the credential to verify the round-trip is bit-identical before returning success. Targets are namespaced (`DevManiacs.AILauncher/<key>`) and keys are validated to a strict charset before any syscall.

The migration is the part I am most proud of, because it is the part I almost got wrong. A one-shot in `src/providers/storage.ts` reads every legacy key, writes it to Credential Manager, and only then deletes the source — gated by a successful read-back before the legacy entry is removed:

```ts
export async function migrateApiKeysToSecureStorage(): Promise<number> {
  const secure = await hasSecureStorage();
  if (!secure) return 0;
  const state = loadProviders();
  // for each profile with an inline apiKey: storeSecret + migrated++
  if (migrated > 0) saveProviders({ ...state,
    profiles: state.profiles.map(p => p.apiKey && p.apiKey !== SECRET_KEY_MARKER
      ? { ...p, apiKey: SECRET_KEY_MARKER } : p) });
  return migrated;
}
```

The JSON in `localStorage` now contains a `__secret__` marker. Exported configs are redacted. If secure storage is unavailable, the function bails out and the keys stay in `localStorage` — we fail closed.

**The takeaway:** store the secret where the OS already protects it, and migrate to it idempotently.

### 5.3 Runbooks as first-class

A runbook is a YAML/JSON list of steps: run a command, edit a file, check an MCP server, evaluate a condition. Every step has a risk level — `safe` (auto-run), `review` (preview + approve), or `destructive` (preview + confirm + log). The execution is a state machine in `src-tauri/src/commands/runbook.rs`.

The design choice that mattered: **dry-run is the default**. When you "Run" a runbook the first time, the app shows you exactly what command will run, in which working directory, with which env. You have to click through. The second time, the same step can be marked `safe` and it auto-runs.

Without the `review` level, the runbook would be either a footgun (auto-runs destructive commands) or a toy (asks permission for `ls`).

**The takeaway:** if your automation tool is either "always confirm" or "never confirm", your users will work around it. Give them a real middle option.

### 5.4 The `.ailauncher.json` contract

The four-section file (cli / provider / env / mcp) is the part of the product I would push on every contributor to read first. It is checked into the repo, versioned with the code, and read at launch time by `commands/cli.rs::read_project_profile`.

The Doctor reads the same file and tells you what's missing: is the CLI installed? is the provider configured? is the env var present? is the MCP server reachable? A new teammate clones the repo, opens the Doctor, and gets a checklist. The file is the spec.

**The takeaway:** when the config is in the repo, the onboarding story writes itself.

## 6. The metrics that surprised me

The frontend is Vite 8 with the rolldown minifier. After a vendor-chunking pass described in [`vite.config.ts:27`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/vite.config.ts#L27), the main chunk dropped by 57% in gzip and 62% raw. The technique is plain: split `react`, `i18n`, `tauri`, `dnd` and `icons` into long-lived vendor chunks, so a tiny app-code change does not bust the entire cache. The Tauri webview's HTTP cache now hits these chunks across releases.

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return;
  if (id.includes('@phosphor-icons')) return 'icons';
  if (id.includes('@dnd-kit'))        return 'dnd';
  if (id.includes('@tauri-apps'))     return 'tauri';
  if (id.includes('i18next'))         return 'i18n';
  if (id.includes('react') || id.includes('scheduler')) return 'react';
}
```

On tests: 82 Rust + 217 Vitest, all green, no flaky, no skipped. The Playwright E2E suite covers the critical workflows (onboarding, workspace CRUD, providers, project profile writes, CLI session lifecycle, runbooks, MCP, backup, update failures, keyboard navigation).

The release pipeline is `git tag v21.1.0` → CI on `windows-latest` → Tauri build (MSI + NSIS) → opt-in signtool sign → `npx tauri signer sign` for the updater key → emit `latest.json` → upload checksums → GitHub release. From `git push` of the tag to a public, downloadable release: **about 8 minutes**. The `latest.json`-emitting step in [`.github/workflows/release.yml`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/.github/workflows/release.yml) is plain PowerShell:

```powershell
$manifest = @{
  version   = $version
  notes     = "AI Launcher $tag — see .../releases/tag/$tag"
  pub_date  = $date
  url       = $downloadUrl
  signature = $signature
}
$manifest | ConvertTo-Json -Depth 5 | Out-File -FilePath "latest.json" -Encoding utf8
```

Release notes per tag are read from `docs/releases/v21.1.0.md` and attached as the GitHub release body. `scripts/audit-release.sh` runs at the end and fails the job if any asset is missing or if `latest.json` does not match the tag.

The number I am most proud of: **5 critical security findings closed in this cycle (SEC-001..005)** — a CVE-grade fix in the `open` crate, supply-chain cleanup, command-injection hardening on the explorer select argument, UNC path rejection in `validate_directory`, and a documented `CRED_PERSIST_LOCAL_MACHINE` decision in `secrets.rs`. They are all in [`CHANGELOG.md`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/CHANGELOG.md) under the v21.1.0 header.

**The takeaway:** the numbers I cared about before launch (bundle size, test count, time-to-publish) were not the numbers that ended up mattering. The security findings mattered.

## 7. The things I'd do differently

A list of regrets, in order of how much they cost me:

**Sketches first.** I started coding the Command Center before I had a sketch of the state machine. It got refactored twice before it felt right. The second refactor only happened because a designer friend sat next to me for an afternoon and drew a state diagram on a napkin. That napkin would have saved me two weeks.

**Don't bundle 13 CLIs in the first release.** v1 was 4 CLIs and a much smaller surface. Adding CLIs is now data, not code — the canonical list lives in `get_cli_definitions` in `src-tauri/src/util.rs`. Each CLI is a struct with a `command`, an `install_cmd`, a `version_cmd`, and an `install_method`. New CLIs land by adding one struct and rebuilding. If I had started with 13, I would not have known which fields were load-bearing.

**Up-front signing.** I waited until v21 to set up `tauri-plugin-updater` properly. The first v20 release had a manual SHA-256 dance that scared one user into thinking the download was corrupted. The whole experience is documented in [`docs/SIGNING.md`](https://github.com/HelbertMoura/ai_launcher/blob/v21.1.0/docs/SIGNING.md) now. Future projects adopt signing on day one.

**The takeaway:** every "we'll fix it after launch" decision is a mortgage on a future release. Pay it down before the first tag if you can.

## 8. What's next

The roadmap is small and concrete:

- **macOS and Linux builds.** The Rust core is portable; the only Windows-specific code is the secrets module, the single-instance mutex, and a couple of explorer helpers. The bulk of the porting is the CI matrix and the icon set.
- **Azure Trusted Signing** for SmartScreen-clean releases, around $10/month. Combined with the existing tauri-plugin-updater trust chain, that should make unsigned download warnings a thing of the past.
- **An "AI Launcher Hub" page** for community-shared runbooks. The data model already supports it (`runbook` is a first-class entity).

None of these are blocked on a rewrite. They are additive.

## 9. Try it

- **GitHub:** <https://github.com/HelbertMoura/ai_launcher>
- **Latest release (v21.1.0):** <https://github.com/HelbertMoura/ai_launcher/releases/tag/v21.1.0>
- **License:** MIT — fork it, ship it, sell support for it. Just keep the copyright.

The Windows installer is a `.msi` (WiX) and a `-setup.exe` (NSIS). If you grab a build before signing is configured in CI, SmartScreen will warn — click *More info → Run anyway*, or wait for the next signed release. Adding your own certificate is documented in `docs/SIGNING.md`.

If you ship your own AI launcher, an MCP hub, or a runbook system, I would love to hear about it. The `.ailauncher.json` format is not sacred.

— Helbert
