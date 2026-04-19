# 🤝 Contributing to AI Launcher

First of all, **thank you so much** for taking the time to look at **AI Launcher**! 🎉
Open-source thrives because of awesome people like you.

This document covers how to get a dev environment running, the project layout, and the conventions used when sending a pull request. We want to make contributing as easy and fun as possible!

---

## 💻 Platform Support

Currently, AI Launcher is strictly **Windows 10+**.
Cross-platform support is not on the roadmap right now because the Rust backend heavily utilizes Windows-specific APIs (like Windows Terminal detection, `CREATE_NO_WINDOW`, `%USERPROFILE%`, and Start Menu scanning) that would require a massive rewrite to port.

## 🛠️ Prerequisites

To get your development environment ready, you will need:
- **Node.js 18+**
- **Rust stable** (install via [rustup](https://rustup.rs/))
- **Windows 10+** with [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (already present on Windows 11 and most Windows 10 machines)
- **Visual Studio Build Tools** with the "Desktop development with C++" workload (Tauri needs this to link everything together on Windows)

---

## 🚀 Running in Development

Getting the app running locally is simple:

```powershell
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev
```

The `npm run tauri dev` command builds the Rust backend, starts Vite on port `5173`, and opens the desktop window with **hot reloading enabled on both sides**.

> **💡 Pro Tip:** If you only want to iterate on the frontend (HTML/CSS/React) without waiting for a full Tauri Rust rebuild, just use `npm run dev`. It starts Vite alone in your browser. Note that Tauri-specific `invoke()` calls will fail, but you can style components quickly!

---

## 📦 Producing a Release Build

Want to generate your very own `.exe` and `.msi` installers?

```powershell
npm run tauri build
```

Your freshly baked artifacts will land in `src-tauri/target/release/bundle/`:
- `msi/AI Launcher_<version>_x64_pt-BR.msi` — MSI installer
- `nsis/AI Launcher_<version>_x64-setup.exe` — NSIS installer

---

## 🗺️ Project Layout

Here's a quick map of the repository to help you navigate:

```text
src/                   Frontend (React 18 + TypeScript, Vite-bundled)
  App.tsx              Main window: tabs, state, every invoke() call
  main.tsx             React entry point
  styles.css           All CSS (dark + light themes, component styles)
  CommandPalette.*     Ctrl+K launcher
  CostAggregator.*     Token/cost aggregator tab
  EmptyState.*         Empty list helper
  ErrorBoundary.*      Top-level React error boundary
  Onboarding.*         First-run wizard
  Orchestrator.*       Multi-CLI runner tab
  Skeleton.*           Loading-state placeholders

src-tauri/             Backend (Rust, compiled by Tauri CLI)
  src/main.rs          Every #[tauri::command], CLI catalog, process spawn
  Cargo.toml           Rust dependencies
  tauri.conf.json      Tauri app metadata, bundle targets, window config
  capabilities/        Tauri v2 permission config
  icons/               App + installer icons

scripts/               Helper scripts
  gen-cert.ps1         Create a self-signed cert for local code signing
  sign-build.ps1       Sign the built .msi / .exe / installer
  certs/               (gitignored) generated .pfx lives here

.github/
  workflows/build.yml  CI: builds MSI + NSIS on push and on tag
```

**Note:** Both `src/App.tsx` (~1600 lines) and `src-tauri/src/main.rs` (~2600 lines) are monolithic by design. Splitting either into multiple modules is a deliberate architectural change and should be discussed in an Issue first.

---

## ✨ Adding a New CLI

We love adding support for new AI tools! To add a new CLI, you need to update two places:

1. **Rust (Backend):** Open `src-tauri/src/main.rs`. Add a `CliDef { ... }` entry to the list returned by `get_cli_definitions()`. Make sure to set the `install_cmd`, `update_cmd`, `version_cmd`, and the appropriate permission flag.
2. **React (Frontend):** Open `src/App.tsx`. Add an entry to the `CLI_ICONS` and `CLI_COLORS` constants at the top of the file so the UI displays a beautiful icon and accent color.

_IDE tools follow the exact same pattern but utilize `get_tool_definitions()`._

---

## 🎨 Code Style

We keep things simple. There is no strict linter or formatter enforced right now, just try to match the surrounding code!

- **TypeScript:** 2-space indent, single quotes, trailing commas in multi-line literals.
- **Rust:** Just use standard `cargo fmt` defaults.
- **Commit Messages:** Short imperative subject lines, with an optional body. Prefixes like `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, and `ci:` are highly preferred but not heavily enforced.

---

## 🔄 Sending a Pull Request

Ready to share your code? Awesome!

1. Fork the repo and create a feature branch off `main`.
2. Make focused, logical commits.
3. **Important Check:** Run `cargo check --manifest-path src-tauri/Cargo.toml` AND `npm run build` locally before opening the PR. Both must pass!
4. Open the PR! Describe what changed and how you tested it. Screenshots or GIFs are highly encouraged for UI changes! 📸
5. The CI will run on Windows and must pass before we can merge it.

---

## 🐛 Reporting Bugs & Issues

Found a bug? Use the "Bug report" issue template on GitHub.
Please include:
- Your Windows version (10 / 11 / Server)
- The Launcher version (visible in the app header)
- What you were trying to do when it broke
- If a CLI install/launch failed, grab the diagnostics from the Actions tab inside the app!

---

## 🔒 Security

If you discover a sensitive security issue (for example, a way to achieve arbitrary code execution via installed CLI paths or environment variables), **please do not open a public issue.**

Instead, please review our [SECURITY.md](./SECURITY.md) and open a **Private Security Advisory** on GitHub. We take security very seriously and will work with you to patch it safely.

---

**Once again, thank you for making AI Launcher better! Happy coding!** 🚀
