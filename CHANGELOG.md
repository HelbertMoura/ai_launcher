# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.1.0] — 2026-04-17

First public release.

### Added

- Unified launcher window for AI coding CLIs: Claude Code, Codex, Gemini, Qwen,
  Kilo Code, OpenCode, Crush, and Droid.
- Unified launcher for developer IDE tools: VS Code, Cursor, Windsurf, AntGravity,
  Claude Desktop, Codex Desktop.
- Environment wizard that detects which CLIs and tools are already installed on
  first run.
- Silent install flow with live progress output in the UI (no flashing terminal
  windows during `npm install -g` / `pip install`).
- Update checker with three sections: CLIs, prerequisites (Node, Python, Git,
  Rust), and IDEs.
- Per-CLI permission flag toggle (e.g. `--dangerously-skip-permissions`,
  `--yolo`).
- Execution history with deduplication.
- Command palette (Ctrl+K) for quick CLI launch.
- Cost aggregator for reading local Claude Code token usage.
- Orchestrator tab for running multiple CLIs side-by-side against the same
  working directory.
- Onboarding flow shown on first launch.
- Dark and light themes; brand color #8B1E2A.
- Global shortcut registration (Ctrl+L focus directory, Ctrl+K launch).
- Windows launch strategy with cascading fallback: Windows Terminal → PowerShell
  7 (pwsh) → cmd.
- Code signing helpers for self-signed certificates (`scripts/gen-cert.ps1`,
  `scripts/sign-build.ps1`).
