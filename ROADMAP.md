# AI Launcher — Roadmap

Where the project is heading. Priorities, not promises: this roadmap intentionally carries no dates — each item ships when it is done.

## Where we are — v22.9.0

AI Launcher is a native desktop command deck (Tauri v2 + React 19 + Rust) for discovering, launching, and monitoring AI CLI agents, IDEs, and MCP servers — local-first, zero telemetry, MIT licensed.

Pillars already shipped:

- **Multi-Agent Launcher** — one-click launch for Claude Code, Codex, Antigravity, Aider, Goose, Cline, Roo Code, Continue, Cody, Copilot, VS Code, and Cursor
- **Project MCP Hub** — automatic stack detection, validated server presets, and health monitoring
- **Cost Analytics & Budget Guard** — real-time per-provider spend tracking with configurable monthly thresholds and alerts
- **Environment Doctor** — concurrent runtime diagnostics (Node, Python, Rust, Docker, and more) with guided one-click repairs
- **Agent Runbooks** — declarative, repeatable multi-step setup scripts with live logs, dry-run, and approvals
- **Command Palette & keyboard-first navigation** — `Ctrl+K` palette, `Ctrl+1-9/0` tab switcher
- **7 themes with density controls** and i18n (English & Português do Brasil)
- **Cryptographic OTA updater** — Minisign-verified self-updates (Windows today)

## Shipped recently

Recent engineering waves (hygiene → safety net → platform), as of v22.9.0:

- [x] Core hygiene pass — deduplicated safety helpers, typed `AppError` layer across Rust commands, blocking network/filesystem scans moved off the command thread
- [x] Shell safety — escaped `cmd /K` fallback metacharacters, gated custom command tokens, real HTTP reachability probe for MCP health checks
- [x] Safety net — first React component tests, Playwright E2E and visual regression running in CI, new Rust unit tests for pure helpers (366 automated tests: 239 Vitest + 127 Rust)
- [x] Quality gates at 9/9 across Windows and Ubuntu — tsc, Vitest, clippy, cargo audit, Playwright E2E, build metrics, release readiness
- [x] Cross-platform core — secrets via Windows Credential Manager, macOS Keychain, and Linux Secret Service, with fail-closed credential UI when no vault is available
- [x] macOS and Linux bundles — dmg (Apple Silicon + Intel), AppImage, and deb built in CI and attached to releases
- [x] Packaging manifests — winget, Scoop, and Chocolatey with a generator script (store submissions pending the first stable release)
- [x] Public multi-platform install guide — NSIS/MSI, dmg, and AppImage/deb instructions for end users

## Next

In priority order. No dates on purpose.

- [ ] Cross-platform auto-updater — signed `latest.json` for macOS and Linux
- [ ] Apple notarization and Windows Authenticode (EV) code signing
- [ ] winget / Scoop / Chocolatey store submissions
- [ ] Session parity on Unix — duration tracking and process kill for macOS/Linux sessions
- [ ] Environment Doctor parity — full diagnostics and guided fixes on all platforms

---

Questions or suggestions? Open an [issue](https://github.com/HelbertMoura/ai_launcher/issues) or read [CONTRIBUTING.md](./CONTRIBUTING.md).
