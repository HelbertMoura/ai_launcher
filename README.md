<div align="center">
  <img src="./public/images/banner.png" alt="AI Launcher Banner" />

  <h1>🚀 AI Launcher</h1>

  <p><strong>Your ultimate desktop hub for AI coding CLIs. Built for speed, flexibility, and productivity.</strong></p>

  <p>
    <a href="https://github.com/HelbertMoura/ai_launcher/blob/main/LICENSE"><img src="https://img.shields.io/github/license/HelbertMoura/ai_launcher?style=for-the-badge&color=blue" alt="License" /></a>
    <a href="https://github.com/HelbertMoura/ai_launcher/stargazers"><img src="https://img.shields.io/github/stars/HelbertMoura/ai_launcher?style=for-the-badge&color=yellow" alt="Stars" /></a>
    <a href="https://github.com/HelbertMoura/ai_launcher/network/members"><img src="https://img.shields.io/github/forks/HelbertMoura/ai_launcher?style=for-the-badge&color=orange" alt="Forks" /></a>
    <a href="https://github.com/HelbertMoura/ai_launcher/issues"><img src="https://img.shields.io/github/issues/HelbertMoura/ai_launcher?style=for-the-badge&color=red" alt="Issues" /></a>
  </p>

  <p>
    <a href="#-português">Português</a> •
    <a href="#-english">English</a>
  </p>
</div>

---

## 🇧🇷 Português

**AI Launcher** é o seu hub definitivo e _open-source_ para CLIs de Inteligência Artificial no Windows. Descubra, instale, atualize e gerencie suas ferramentas de IA favoritas — como Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush e Droid — tudo em uma interface moderna, rápida e intuitiva.

Além disso, oferece atalhos diretos para editores populares como VS Code, Cursor, Windsurf e AntGravity. Diga adeus às telas pretas piscando, buscas infinitas por comandos `npm install -g` específicos e dores de cabeça com configuração de ambiente por sessão. Tudo fica em um único lugar! ✨

Feito com ❤️, **Tauri v2**, **React 18** e **Rust**, sendo altamente otimizado para Windows 10 e 11.

### 🌟 O que ele faz?

- 📦 **Instalação e Atualização Sem Complicações** — Detecta o que falta no seu ambiente. Executa `npm install -g` ou `pip install` em segundo plano com uma interface limpa que mostra o progresso em tempo real. O sistema compara versões instaladas com as mais recentes das CLIs, IDEs e pré-requisitos (Node, Python, Git, Rust).
- 🚀 **Execução Inteligente** — Abre as CLIs diretamente no Windows Terminal (se disponível), caindo para PowerShell 7 ou `cmd` caso necessário. O melhor de tudo? Ele **aplica automaticamente as flags de permissão corretas** (`--dangerously-skip-permissions`, `--yolo`, etc.) para você focar apenas no código.
- 📊 **Rastreamento Avançado** — Mantém o histórico de execuções por projeto, consolida o uso de tokens (ex: Claude Code) e permite a execução de múltiplas CLIs lado a lado no mesmo diretório através da aba **Orquestrador**.

### 🤖 CLIs de IA Suportadas

| CLI | Comando Base | Flag de Permissão Automática |
| --- | --- | --- |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | `--dangerously-skip-permissions` |
| **Codex** | `npm install -g @openai/codex` | `--dangerously-bypass-approvals-and-sandbox` |
| **Gemini CLI** | `npm install -g @google/gemini-cli` | `--yolo` |
| **Qwen** | `npm install -g qwen-ai` | `--yolo` |
| **Droid** | `npm install -g droid` | — |
| **Kilo Code** | `pip install kilo-code` | `--yolo` |
| **OpenCode** | `npm install -g opencode-ai` | — |
| **Crush** | `npm install -g crush-cli` | `--yolo` |

### 🛠 IDEs & Editores

Suporte nativo para detectar: **VS Code, Cursor, Windsurf, AntGravity, Claude Desktop e Codex Desktop**. O launcher identifica as instalações e permite abrir o diretório de trabalho atual na sua IDE favorita com um clique.

### 📥 Download e Instalação

Obtenha a versão mais recente diretamente na [Página de Releases](https://github.com/HelbertMoura/ai_launcher/releases).

- `AI Launcher_<version>_x64_pt-BR.msi` — Formato MSI. Ideal e recomendado para implantação em máquinas corporativas ou gerenciadas por TI.
- `AI Launcher_<version>_x64-setup.exe` — Instalador NSIS padrão. Apenas clique duas vezes!

> ⚠️ **Aviso de primeira execução (SmartScreen):** Como este é um projeto _open-source_ gratuito e sem um certificado EV pago, o Windows SmartScreen pode exibir um alerta. Basta clicar em **Mais informações → Executar mesmo assim**. Se preferir, você mesmo pode construir os executáveis a partir do código-fonte! (Veja abaixo).

### 🛠️ Construa você mesmo! (Open Source 💖)

Por ser totalmente open-source, **você pode buildar seu próprio `.msi` ou `.exe` facilmente**. Perfeito para garantir segurança ou personalizar para a sua empresa!

**Pré-requisitos:**
- Node.js 18+
- [Rust stable](https://rustup.rs/)
- Windows 10 ou 11
- Visual Studio Build Tools (Carga de trabalho: **Desenvolvimento para desktop com C++** para vinculação do Tauri).

```powershell
# 1. Clone o repositório
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher

# 2. Instale as dependências
npm install

# 3. (Opcional) Rode em modo desenvolvimento com Hot Reload (Frontend + Backend)
npm run tauri dev

# 4. Gere os seus próprios instaladores! (MSI e NSIS)
npm run tauri build
```
Os instaladores gerados estarão disponíveis em `src-tauri/target/release/bundle/`.

_(Deseja assinar os binários localmente? Temos os scripts `gen-cert.ps1` e `sign-build.ps1` em `/scripts/` para isso!)_

### 🤝 Contribua conosco!

Toda ajuda é super bem-vinda! Se você tem uma ideia de nova CLI, melhoria de interface, ou encontrou um bug:

1. Dê uma lida no nosso [CONTRIBUTING.md](./CONTRIBUTING.md).
2. Reporte problemas ou sugira features através das [Issues](https://github.com/HelbertMoura/ai_launcher/issues).

### 📄 Licença

Projeto distribuído sob a licença [MIT](./LICENSE).
Copyright © 2026 Helbert Moura | DevManiac's.

---

<br/>

## 🇬🇧 English

**AI Launcher** is your ultimate, _open-source_ hub for AI Command Line Interfaces (CLIs) on Windows. Discover, install, update, and seamlessly manage your favorite AI tools like Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush, and Droid, all within a sleek, modern, and intuitive UI.

Additionally, it provides rapid shortcuts for popular editors such as VS Code, Cursor, Windsurf, and AntGravity. Say goodbye to flashing `cmd` windows, digging through docs for specific `npm install -g` commands, or tedious environment setups! ✨

Built passionately with **Tauri v2**, **React 18**, and **Rust**, fully optimized for Windows 10 and 11.

### 🌟 Features

- 📦 **Painless Install & Update** — Automatically detects missing prerequisites. Runs `npm install -g` or `pip install` in-process with a beautiful live progress bar. The built-in updater keeps your CLIs, IDEs, and system requirements (Node, Python, Git, Rust) always up-to-date.
- 🚀 **Smart Launching** — Instantly fires up CLIs in Windows Terminal (if available), falling back to PowerShell 7 or `cmd`. Best of all? It **automatically injects the correct permission flags** (`--dangerously-skip-permissions`, `--yolo`, etc.) so you don't have to memorize them.
- 📊 **Advanced Tracking** — Maintains per-project run histories. Aggregates token usage (e.g., Claude Code runs). You can even run multiple CLIs side-by-side on the same project using the **Orchestrator** tab.

### 🤖 Supported AI CLIs

| CLI | Base Install Command | Auto-Injected Flag |
| --- | --- | --- |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | `--dangerously-skip-permissions` |
| **Codex** | `npm install -g @openai/codex` | `--dangerously-bypass-approvals-and-sandbox` |
| **Gemini CLI** | `npm install -g @google/gemini-cli` | `--yolo` |
| **Qwen** | `npm install -g qwen-ai` | `--yolo` |
| **Droid** | `npm install -g droid` | — |
| **Kilo Code** | `pip install kilo-code` | `--yolo` |
| **OpenCode** | `npm install -g opencode-ai` | — |
| **Crush** | `npm install -g crush-cli` | `--yolo` |

### 🛠 Supported IDEs & Editors

Out-of-the-box detection for: **VS Code, Cursor, Windsurf, AntGravity, Claude Desktop, and Codex Desktop**. Open your current workspace in your preferred editor with just one click.

### 📥 Download & Install

Grab the latest installer directly from the [Releases page](https://github.com/HelbertMoura/ai_launcher/releases):

- `AI Launcher_<version>_x64_pt-BR.msi` — MSI format. Highly recommended for IT-managed machines and bulk deployments.
- `AI Launcher_<version>_x64-setup.exe` — Standard NSIS installer. Just double-click!

> ⚠️ **First-run SmartScreen Warning:** Since this is a free, open-source project without a paid EV certificate, Windows SmartScreen may show a warning. Click **More info → Run anyway**. Or better yet, build the installers yourself from the source! (See below).

### 🛠️ Build it Yourself! (Open Source 💖)

Because we are fully open-source, **you can easily build the `.msi` or `.exe` directly on your machine**. This is perfect if you want to ensure maximum security or customize the app for your enterprise!

**Prerequisites:**
- Node.js 18+
- [Rust stable](https://rustup.rs/)
- Windows 10 or 11
- Visual Studio Build Tools (Workload: **Desktop development with C++** — required by Tauri).

```powershell
# 1. Clone the repository
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher

# 2. Install dependencies
npm install

# 3. (Optional) Run the dev environment with Hot Reload
npm run tauri dev

# 4. Generate your very own release installers! (MSI & NSIS)
npm run tauri build
```
Your freshly built installers will be waiting for you in `src-tauri/target/release/bundle/`.

_(Need local code signing? Check out `gen-cert.ps1` and `sign-build.ps1` inside `/scripts/`!)_

### 🤝 Contributing

We love community contributions! Whether it's adding a new CLI, tweaking the UI, or squashing bugs:

1. Please read our [CONTRIBUTING.md](./CONTRIBUTING.md) first.
2. File bugs or suggest features via GitHub [Issues](https://github.com/HelbertMoura/ai_launcher/issues).

### 📄 License

Distributed under the [MIT License](./LICENSE).
Copyright © 2026 Helbert Moura | DevManiac's.
