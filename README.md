# AI Launcher Pro v9.1

```
┌──────────────────────────────────────────────┐
│  ●   AI Launcher Pro                        │
│                                              │
│  $ claude --describe "beautiful code"      │
│  $ codex --help                             │
│                                              │
│  8 CLIs  •  Theme: Soft Workbench 2.0       │
└──────────────────────────────────────────────┘
```

AI Launcher Pro is a local-first desktop hub for AI coding CLIs. Version 9.1 ships a complete visual overhaul — **Figma-style minimalist UI** with warm terracotta accents, full dark mode, and unified admin access.

**Language:** English · [Português](./README.pt-BR.md)  
**Platforms:** Windows ✅ · macOS 🔜 · Linux 🔜

## What's new in v9.1 — Soft Workbench 2.0

- **Figma-style UI**: Minimalist modern design with warm terracotta accents
- **Dark mode**: Full dark theme with Figma-style surface hierarchy
- **Unified Admin**: All features available to all users — no more admin/public split
- **Official icons**: Brand-authentic icons for Claude, VS Code, Cursor, Gemini, Qwen
- **Dynamic accent colors**: Choose your highlight color from Admin settings
- **Zero terminal aesthetic**: Clean, modern interface without fake terminal decorations

## Features

- 8 built-in AI CLIs: Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush, and Droid
- Anthropic-compatible provider profiles with switching, model overrides, and cost tracking
- Launch history, budgets, shortcuts, and local configuration backup/import
- Custom CLI and custom IDE entries with optional uploaded icon image
- Local-first storage and zero telemetry
- Theme: Light/Dark with configurable accent color

## Install

### End users

Download the latest `.msi` or `.exe` from the [GitHub releases page](https://github.com/HelbertMoura/ai_launcher/releases/latest).

Windows SmartScreen may warn on unsigned builds. Use **More info → Run anyway** if needed.

### From source

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev
npm run tauri build
```

Prerequisites: Node 18+, Rust stable, Windows 10/11, and Visual Studio Build Tools with **Desktop development with C++**.

## License

MIT. See [LICENSE](./LICENSE).
