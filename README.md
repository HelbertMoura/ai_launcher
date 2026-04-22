# AI Launcher Pro v9.0

AI Launcher Pro is a local-first desktop hub for AI coding CLIs. Version 9 replaces the old terminal-heavy aesthetic with **Soft Workbench**: a friendlier visual system, warmer colors, rebuilt official icons, and a real appearance layer with configurable accent presets from Admin.

**Language:** English · [Português](./README.pt-BR.md)  
**Platforms:** Windows ✅ · macOS 🔜 · Linux 🔜

## What changed in v9

- Full UI/UX reformulation with a new light-first identity
- Accent color presets configurable from Admin
- New official icon family for built-in CLIs and tools
- Built-in icon overrides now accept local image files
- Central icon registry for easier manual asset replacement later
- Public docs cleaned up without old screenshots/mockups

## Highlights

- 8 built-in AI CLIs: Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush, and Droid
- Anthropic-compatible provider profiles with switching, model overrides, and cost tracking
- Launch history, budgets, shortcuts, and local configuration backup/import
- Custom CLI and custom IDE entries with optional uploaded icon image
- Local-first storage and zero telemetry

## Manual icon replacement

Built-in icon mapping now lives in [src/lib/iconRegistry.ts](/C:/Users/Helbert/Desktop/DevManiacs/ai-launcher-tutra/src/lib/iconRegistry.ts).  
Operational notes are documented in [docs/ICON_OVERRIDES.md](/C:/Users/Helbert/Desktop/DevManiacs/ai-launcher-tutra/docs/ICON_OVERRIDES.md).

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
$env:VITE_ADMIN_MODE='1'; npm run tauri build
```

Prerequisites: Node 18+, Rust stable, Windows 10/11, and Visual Studio Build Tools with **Desktop development with C++**.

## License

MIT. See [LICENSE](./LICENSE).
