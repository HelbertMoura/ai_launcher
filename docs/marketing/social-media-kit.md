# 🚀 AI Launcher · Kit Oficial de Lançamento & Divulgação
> **Criado por:** Helbert Moura · [Dev Maniac's](https://devmaniacs.com.br/)  
> **Repositório:** [https://github.com/HelbertMoura/ai_launcher](https://github.com/HelbertMoura/ai_launcher)  
> **Licença:** MIT · Open Source

---

## 🎨 Identidade Visual & Brand Assets (Dev Maniac's)

- **Website Oficial:** [https://devmaniacs.com.br/](https://devmaniacs.com.br/)
- **Cores Principais:**
  - **Navy Deep Background:** `#061637`
  - **Glacier Blue (High-tech):** `#61dafb` / `#00d2ff`
  - **Terminal Amber (CRT Retro):** `#ffb000` / `#ffa500`
  - **DevManiac's Crimson:** `#ff3131`
- **Slogan Oficial:** *"Tecnologia feita de perto. Ideias que viram produtos reais."*
- **Imagens Geradas para o Lançamento:**
  1. `ai_launcher_social_hero.jpg` — Hero Banner 16:9 para Twitter/X, LinkedIn e Reddit
  2. `ai_launcher_features_card.jpg` — Card 1:1 com os 4 Pilares (Multi-Agent, MCP Hub, Budget Guard, Rust <40MB)

---

## 🐦 Twitter / X

### 📌 Post Principal (Anúncio de Lançamento)
```markdown
🚀 Apresentando o AI Launcher: o Command Deck open source para desenvolvedores que usam IA.

Cansado de gerenciar dezenas de CLIs, MCP servers, limites de tokens e chaves de API espalhadas?

Centralize Claude Code, Codex, Antigravity, Aider, Cursor, Windsurf e Runbooks em um único painel desktop ultra leve.

⚡ Construído em Tauri v2 + Rust + React 19 (<40MB RAM)
🔒 100% Local-First & Sem Telemetria
💰 Rastreamento de custos e alertas de budget por provider
🧩 Hub MCP com detecção automática por projeto

👉 Código aberto no GitHub: https://github.com/HelbertMoura/ai_launcher
⚡ Feito pela @devmaniacs

#buildinpublic #opensource #rustlang #reactjs #tauri #ai #claude #coding
```

### 🧵 Thread de Engajamento (5 Tweets)
```markdown
🧵 1/5 Por que criamos o AI Launcher?
O ecossistema de coding com IA explodiu (Claude Code, Aider, Antigravity, OpenCode, Cursor, MCPs). Mas a experiência do desenvolvedor virou um caos: terminal bagunçado, APIs sem controle de custo e setups manuais a cada repositório.

🧵 2/5 🧭 Command Center Unificado
Detecte a stack do seu projeto em 1 clique. O launcher lê seu workspace e sugere os melhores agentes, runbooks e servidores MCP necessários para você começar a codar na hora.

🧵 3/5 🛡️ Budget Guard & Analytics
Evite surpresas no final do mês. Configure limites mensais por provider (Anthropic, OpenRouter, MiniMax, Qwen, etc.) e receba alertas proativos antes de estourar seus créditos.

🧵 4/5 ⚡ Performance Nativa & Privacidade
Sem Electron consumindo 1GB de RAM. O AI Launcher roda em Rust + Tauri v2, consome menos de 40MB e guarda todas as suas credenciais no cofre seguro do seu sistema operacional.

🧵 5/5 ⭐ O projeto é 100% Open Source (MIT) e já está disponível para download!
Dê uma estrela no GitHub e teste agora:
🔗 https://github.com/HelbertMoura/ai_launcher
```

---

## 🔴 Reddit

### 1. `r/LocalLLaMA` & `r/ChatGPTCoding`
> **Título:** *I built an open-source desktop Command Deck for AI coding CLIs (Claude Code, Aider, Antigravity, Cursor) & MCP servers with local cost tracking*

```markdown
Hey everyone!

As someone using multiple AI agents and CLIs daily (Claude Code, Aider, Antigravity, OpenCode, plus Cursor/Windsurf), I got frustrated having to manually manage API keys, configure project-specific MCP servers, and constantly monitor spending across different model providers.

To solve this, I built **AI Launcher** — a native desktop launcher and control deck built with **Tauri v2, Rust, and React 19**.

### 🌟 Key Features:
- **Unified Multi-Agent Launcher**: One-click detection, install, and execution of Claude Code, Codex, Aider, Goose, Cline, Roo Code, etc.
- **MCP Hub & Project Intelligence**: Automatically detects your repository stack (Node, Rust, Python, Go) and configures the right MCP servers and runbooks safely.
- **Budget Guard & Cost Analytics**: Real-time spending charts by provider, token usage estimations, and customizable alert thresholds.
- **Environment Doctor & Prereqs**: Integrated diagnosis to detect broken Node, Python, Rust, Git, and Docker environments with guided fixes.
- **Privacy-First & Native**: Less than 40MB RAM usage, no cloud lock-in, zero telemetry, and secure OS credential storage.

The project is completely open source under the MIT license. I'd love to hear your thoughts, feedback, and feature requests!

📦 **GitHub:** https://github.com/HelbertMoura/ai_launcher
💻 **Releases (.exe / .msi):** https://github.com/HelbertMoura/ai_launcher/releases
```

### 2. `r/rust` & `r/tauri`
> **Título:** *AI Launcher: A modern desktop application built with Tauri v2, Rust & React 19 to manage AI coding agents*

```markdown
Hi all!

Wanted to share a real-world Tauri v2 application: **AI Launcher**.

It serves as a developer dashboard for running and orchestrating AI CLIs, managing MCP (Model Context Protocol) configurations, and tracking API costs.

### Technical Highlights:
- **Tauri v2 + Tokio**: Asynchronous system process probing and streaming installation directly in Rust.
- **Windows Credential Manager Integration**: Securely encrypts and stores developer API tokens using native platform APIs (`windows-sys`).
- **React 19 Frontend**: Keyboard-driven UI (`Ctrl+K` command palette, `Ctrl+1-9` quick switching, multiple themes including retro Amber CRT and Glacier).
- **Lightweight Footprint**: Cold boot in <300ms and ~35MB working memory.

Repository: https://github.com/HelbertMoura/ai_launcher

Feedback on the Rust codebase and architecture is very welcome!
```

---

## 🟠 Hacker News (Show HN)

> **Título:** `Show HN: AI Launcher – Open source local desktop hub for AI coding CLIs and MCPs`

```markdown
Hi HN! I'm Helbert, founder of Dev Maniac's.

I built AI Launcher (https://github.com/HelbertMoura/ai_launcher) to solve the tooling fatigue that came with the rise of AI coding agents.

Instead of writing scripts to switch API keys, manually creating `.mcp.json` configs for every repository, or keeping spreadsheets to track Anthropic/OpenRouter spending, AI Launcher provides a single desktop command deck:

1. One-click CLI & Tool Orchestration (Claude Code, Aider, Antigravity, Cursor, Windsurf).
2. Workspace & Agent Runbooks (automated reproducible agent setup pipelines).
3. Project Intelligence (detects stack files and wires appropriate MCP servers).
4. Local Cost & Budget Guard (alert thresholds before unexpected bills).
5. 100% Local-first (Tauri v2, Rust, React 19, zero telemetry).

Installers and source code are on GitHub: https://github.com/HelbertMoura/ai_launcher

Would love to hear how you manage your local AI workflows and any ideas for improvements!
```

---

## 💼 LinkedIn

```markdown
💡 O ecossistema de desenvolvimento assistido por IA amadureceu, mas a experiência do desenvolvedor ficou fragmentada.

Hoje um engenheiro moderno alterna entre Claude Code, Aider, Antigravity, Cursor, múltiplos servidores MCP e diferentes provedores de IA, acumulando chaves de API dispersas e sem visibilidade clara dos custos mensais.

Para resolver essa dor, desenvolvemos na Dev Maniac's o **AI Launcher** — uma aplicação desktop open source de alta performance desenvolvida com Tauri v2, Rust e React 19.

Principais recursos:
🔹 Central de Lançamento de Agentes e CLIs de IA
🔹 Gestor de MCP (Model Context Protocol) integrado por projeto
🔹 Monitoramento de Custos e Alertas de Budget em tempo real
🔹 Diagnóstico de Ambiente e Pré-requisitos (Node, Python, Rust, Docker)
🔹 100% Local-First, seguro e com consumo mínimo de memória (<40MB)

O projeto é código aberto (MIT) e está disponível para a comunidade.

🔗 Repositório oficial no GitHub: https://github.com/HelbertMoura/ai_launcher
⚡ Conheça a Dev Maniac's: https://devmaniacs.com.br/

#EngenhariaDeSoftware #OpenSource #InteligenciaArtificial #Rust #React #Tauri #DevManiacs
```

---

## 💬 Mensagem para Canais de Discord & Comunidades Dev

```markdown
Fala pessoal! 👋

Lancei um app open source chamado **AI Launcher** para quem usa ferramentas e CLIs de IA no dia a dia (Claude Code, Aider, Antigravity, OpenCode, Cursor, MCPs, etc.).

O objetivo foi criar uma central leve (Tauri v2 + Rust) que resolve:
- Iniciar qualquer agente/IDE em 1 clique
- Gerenciar servidores MCP por projeto
- Monitorar gastos com tokens e evitar surpresas no cartão (Budget Guard)
- Diagnosticar pré-requisitos do ambiente (Node, Python, Rust, Docker)
- 100% local e seguro (sem telemetria)

Quem quiser testar e contribuir com feedback ou estrelas no repo:
👉 https://github.com/HelbertMoura/ai_launcher
```
