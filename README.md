# AI Launcher

![AI Launcher Banner](./public/images/banner.png)

[![GitHub license](https://img.shields.io/github/license/HelbertMoura/ai_launcher?style=flat-square)](https://github.com/HelbertMoura/ai_launcher/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/HelbertMoura/ai_launcher?style=flat-square)](https://github.com/HelbertMoura/ai_launcher/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/HelbertMoura/ai_launcher?style=flat-square)](https://github.com/HelbertMoura/ai_launcher/network/members)
[![GitHub issues](https://img.shields.io/github/issues/HelbertMoura/ai_launcher?style=flat-square)](https://github.com/HelbertMoura/ai_launcher/issues)

## 🇧🇷 Português

**AI Launcher** é o seu hub definitivo para CLIs de Inteligência Artificial no Windows. Descubra, instale, atualize e gerencie suas ferramentas de IA favoritas, como Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush e Droid, tudo em uma única interface intuitiva. Além disso, oferece atalhos para editores populares como VS Code, Cursor, Windsurf e AntGravity. Diga adeus às janelas `cmd` piscando durante a instalação, à busca por comandos `npm install -g` específicos ou à configuração de ambiente por sessão.

Construído com Tauri v2, React 18 e Rust, o AI Launcher é otimizado para Windows 10 e 11.

### O que ele faz

-   **Instalar e Atualizar** — Detecta o que está faltando, executa `npm install -g` / `pip install` em processo com progresso em tempo real na interface do usuário. O verificador de atualizações compara as versões instaladas com as mais recentes para CLIs, pré-requisitos (Node, Python, Git, Rust) e IDEs.
-   **Executar** — Abre cada CLI no Windows Terminal (quando disponível), com fallback para PowerShell 7 e, em seguida, `cmd`. Alterna o sinalizador de permissão correto para cada CLI (`--dangerously-skip-permissions`, `--yolo`, etc.) para que você não precise se lembrar.
-   **Rastrear** — Mantém um histórico de execuções por projeto. Mostra o uso agregado de tokens para execuções do Claude Code. Executa várias CLIs lado a lado no mesmo diretório de trabalho a partir da guia Orquestrador.

### CLIs de IA Suportadas

| CLI         | Comando de Instalação                           | Sinalizador de Permissão                                       |
|-------------|-------------------------------------------------|----------------------------------------------------------------|
| Claude Code | `npm install -g @anthropic-ai/claude-code`      | `--dangerously-skip-permissions`                               |
| Codex       | `npm install -g @openai/codex`                  | `--dangerously-bypass-approvals-and-sandbox`                   |
| Gemini CLI  | `npm install -g @google/gemini-cli`             | `--yolo`                                                       |
| Qwen        | `npm install -g qwen-ai`                        | `--yolo`                                                       |
| Droid       | `npm install -g droid`                          | —                                                              |
| Kilo Code   | `pip install kilo-code`                         | `--yolo`                                                       |
| OpenCode    | `npm install -g opencode-ai`                    | —                                                              |
| Crush       | `npm install -g crush-cli`                      | `--yolo`                                                       |

### IDEs & Editores Suportados

VS Code, Cursor, Windsurf, AntGravity, Claude Desktop, Codex Desktop. O launcher detecta instalações existentes e oferece a opção de abrir o diretório de trabalho atual em qualquer um deles.

### Instalação

Obtenha o instalador mais recente na [página de Releases](https://github.com/HelbertMoura/ai_launcher/releases):

-   `AI Launcher_<version>_x64_pt-BR.msi` — MSI, recomendado para máquinas gerenciadas por políticas de TI.
-   `AI Launcher_<version>_x64-setup.exe` — NSIS, clique duas vezes para instalar.

Na primeira execução, o aplicativo abre um pequeno assistente de integração que detecta o que já está instalado e oferece para corrigir qualquer coisa que esteja faltando.

#### Avisos na primeira execução

Os instaladores não são assinados com um certificado EV pago, então o SmartScreen pode exibir um diálogo "O Windows protegeu seu PC" na primeira execução. Clique em **Mais informações → Executar mesmo assim**.

Se o seu ambiente exigir binários assinados, consulte a seção Assinatura de Código abaixo — o repositório fornece ajudantes para assinar com um certificado autoassinado local.

### Construir do Código Fonte

Pré-requisitos:

-   Node.js 18 ou mais recente
-   Rust stable, via [rustup](https://rustup.rs/)
-   Windows 10 ou 11
-   Visual Studio Build Tools com a carga de trabalho **Desenvolvimento para desktop com C++** (Tauri usa para vincular no Windows)

```powershell
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install

# Desenvolvimento — Vite + Rust com hot reload em ambos os lados
npm run tauri dev

# Release — produz instaladores MSI + NSIS em
# src-tauri/target/release/bundle/
npm run tauri build
```

Consulte [CONTRIBUTING.md](./CONTRIBUTING.md) para o layout do projeto e onde adicionar uma nova CLI.

### Assinatura de Código

Para builds locais assinados com um certificado autoassinado (confiável apenas em sua própria máquina):

```powershell
# Uma vez — gere o certificado e adicione-o à Raiz Confiável
.\scripts\gen-cert.ps1

# Após cada build — assine o .exe / .msi produzido
.\scripts\sign-build.ps1
```

### Configuração e Dados

O aplicativo mantém o estado por usuário em `%APPDATA%\ai-launcher\`:

-   Histórico de execuções (por diretório de trabalho)
-   Sinalizador de conclusão do onboarding
-   Tema selecionado
-   Logs de diagnóstico

Nada é enviado pela rede pelo próprio aplicativo. As verificações de atualização acessam os registros públicos de cada CLI (npm, PyPI) e a API de releases do GitHub.

### Contribuindo

Pull Requests são bem-vindos. Leia [CONTRIBUTING.md](./CONTRIBUTING.md) primeiro — ele aborda a configuração de desenvolvimento, o layout do projeto, as convenções usadas em `App.tsx` e `main.rs` monolíticos e como adicionar uma nova CLI.

Relatórios de bugs e solicitações de recursos são feitos através dos [modelos de issue](/.github/ISSUE_TEMPLATE) do GitHub.

### Licença

[MIT](./LICENSE) — Copyright © 2026 Helbert Moura | DevManiac's.

---

## 🇬🇧 English

**AI Launcher** is your ultimate hub for AI Command Line Interfaces (CLIs) on Windows. Discover, install, update, and manage your favorite AI tools like Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush, and Droid, all within a single, intuitive interface. Additionally, it offers shortcuts for popular editors such as VS Code, Cursor, Windsurf, and AntGravity. Say goodbye to flashing `cmd` windows during installation, hunting for specific `npm install -g` commands, or per-session environment setup.

Built with Tauri v2, React 18, and Rust, AI Launcher is optimized for Windows 10 and 11.

### What it does

-   **Install & Update** — Detects what's missing, runs `npm install -g` / `pip install` in-process with live progress streamed to the UI. The update checker compares installed vs. latest versions for CLIs, prerequisites (Node, Python, Git, Rust), and IDEs.
-   **Launch** — Opens each CLI in Windows Terminal (when available), falling back to PowerShell 7, then `cmd`. Toggles the correct permission flag per CLI (`--dangerously-skip-permissions`, `--yolo`, etc.) so you don't have to remember.
-   **Track** — Keeps a per-project history of launches. Shows aggregated token usage for Claude Code runs. Runs multiple CLIs side-by-side against the same working directory from the Orchestrator tab.

### Supported AI CLIs

| CLI         | Install command                           | Permission flag                                       |
|-------------|-------------------------------------------|-------------------------------------------------------|
| Claude Code | `npm install -g @anthropic-ai/claude-code`| `--dangerously-skip-permissions`                      |
| Codex       | `npm install -g @openai/codex`            | `--dangerously-bypass-approvals-and-sandbox`          |
| Gemini CLI  | `npm install -g @google/gemini-cli`       | `--yolo`                                              |
| Qwen        | `npm install -g qwen-ai`                  | `--yolo`                                              |
| Droid       | `npm install -g droid`                    | —                                                     |
| Kilo Code   | `pip install kilo-code`                   | `--yolo`                                              |
| OpenCode    | `npm install -g opencode-ai`              | —                                                     |
| Crush       | `npm install -g crush-cli`                | `--yolo`                                              |

### Supported IDEs & Editors

VS Code, Cursor, Windsurf, AntGravity, Claude Desktop, Codex Desktop. The launcher detects existing installs and offers to open the current working directory in any of them.

### Installation

Grab the latest installer from the [Releases page](https://github.com/HelbertMoura/ai_launcher/releases):

-   `AI Launcher_<version>_x64_pt-BR.msi` — MSI, recommended for machines managed by IT policies.
-   `AI Launcher_<version>_x64-setup.exe` — NSIS, double-click to install.

On first launch, the app opens a small onboarding wizard that detects what's already installed and offers to fix anything missing.

#### First-run warnings

The installers are not signed with a paid EV certificate, so SmartScreen may show a "Windows protected your PC" dialog on the first run. Click **More info → Run anyway**.

If your environment requires signed binaries, see the Code Signing section below — the repository ships helpers to sign with a local self-signed certificate.

### Build from Source

Prerequisites:

-   Node.js 18 or newer
-   Rust stable, via [rustup](https://rustup.rs/)
-   Windows 10 or 11
-   Visual Studio Build Tools with the **Desktop development with C++** workload (Tauri uses it to link on Windows)

```powershell
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install

# Dev — Vite + Rust with hot reload on both sides
npm run tauri dev

# Release — produces MSI + NSIS installers under
# src-tauri/target/release/bundle/
npm run tauri build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the project layout and where to add a new CLI.

### Code Signing

For local builds signed with a self-signed cert (trusted on your own machine only):

```powershell
# Once — generate cert and add it to Trusted Root
.\scripts\gen-cert.ps1

# After each build — sign the produced .exe / .msi
.\scripts\sign-build.ps1
```

### Configuration and Data

The app keeps per-user state under `%APPDATA%\ai-launcher\`:

-   Launch history (per working directory)
-   Onboarding completion flag
-   Selected theme
-   Diagnostic logs

Nothing is sent over the network by the app itself. Update checks hit the public registries of each CLI (npm, PyPI) and the GitHub releases API.

### Contributing

Pull Requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first — it covers the dev setup, project layout, the conventions used in the monolithic `App.tsx` and `main.rs`, and how to add a new CLI.

Bug reports and feature requests go through the GitHub [issue templates](./.github/ISSUE_TEMPLATE).

### License

[MIT](./LICENSE) — Copyright © 2026 Helbert Moura | DevManiac's.
