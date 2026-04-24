> [🇺🇸 English](./README.md) | 🇧🇷 Português (Brasil)

<div align="center">

<img src="./docs/terminal-hero.svg" alt="AI Launcher Pro — Command Deck Terminal" width="720">

**Um app desktop para detectar, instalar, executar, atualizar e monitorar todas as suas ferramentas de IA.**

[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](./LICENSE)
[![Versão 15.0.0](https://img.shields.io/badge/vers%C3%A3o-15.0.0-ff3131?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
[![Plataforma: Windows](https://img.shields.io/badge/plataforma-Windows-0078D4?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
![React 19](https://img.shields.io/badge/React-19-61dafb?labelColor=1a1a1d)
![Tauri v2](https://img.shields.io/badge/Tauri-v2-ffc131?labelColor=1a1a1d)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?labelColor=1a1a1d)
![Rust](https://img.shields.io/badge/Rust-stable-dea584?labelColor=1a1a1d)

</div>

---

## Funcionalidades

| | Funcionalidade | Descrição |
|---|---------------|-----------|
| 🚀 | **Launcher de CLIs** | Detecte, instale e execute Claude Code, Codex, Gemini CLI, Qwen, Crush, Droid, Kilocode, OpenCode e mais |
| 🔧 | **Gerenciador de Tools** | Gerencie VS Code, Cursor, Windsurf, Google Antigravity, JetBrains AI e IDEs customizadas |
| ⬆️ | **Hub de Atualizações** | Aba dedicada para updates de CLIs, ferramentas e pré-requisitos com instalação em um clique |
| 💰 | **Rastreamento de Custos** | Acompanhe gastos por provider com breakdown diário e mensal |
| 📋 | **Histórico Waterfall** | Timeline estilo terminal + log de sessões com reabertura, status dots e duração |
| 🔍 | **Verificação de Pré-requisitos** | Cheque Node, npm, Bun, Python, Rust, Cargo, Git, Docker e mais |
| 🔌 | **Providers** | Anthropic, Z.AI, MiniMax, Moonshot, Qwen, OpenRouter + endpoints customizados com botão de teste de API |
| 🎨 | **4 Temas + Densidade** | Dark / Light / Amber (CRT retro) / Glacier (frio azul) + toggle compacto/confortável |
| 🌐 | **i18n** | Inglês e Português (Brasil) com alternância instantânea |
| ⌨️ | **Keyboard-First** | Paleta rica `Ctrl+K`, navegação `Ctrl+1-8`, admin `Ctrl+,`, ajuda `?` |
| 🔒 | **Privacidade Primeiro** | Tudo fica local — sem telemetria, sem sync na nuvem |
| 🏢 | **Workspace Profiles** | Agrupe configurações por repositório, time ou contexto com troca em um clique |
| 🧩 | **Agent Runbooks** | Sequências automatizadas de setup de ambiente para workflows de agentes IA |
| 🛡️ | **Budget Guard** | Limites locais de custo por provider com alertas em thresholds configuráveis |
| 🩺 | **Environment Doctor** | Diagnostique e repare ambientes de dev quebrados com fixes guiados |
| 👁️ | **Safe Command Preview** | Revise executável, args, env e nível de risco antes de rodar comandos customizados |
| 🔄 | **Auto-Atualização** | Verificação de updates in-app, download com progresso, validação por checksum |

## Screenshots

<div align="center">

### Command Deck 2.0 · Dark, Light, Amber, Glacier

| Launcher de CLIs | Ferramentas | Paleta de Comandos Rica |
|:---:|:---:|:---:|
| ![Launcher](./docs/screenshots/v15/01-launcher.png) | ![Tools](./docs/screenshots/v15/02-tools.png) | ![Command Palette](./docs/screenshots/v15/08-palette.png) |

### Workspace bento · History waterfall · Environment Doctor

| Workspace Profiles | Timeline de Histórico | Environment Doctor |
|:---:|:---:|:---:|
| ![Workspace](./docs/screenshots/v15/05-workspace.png) | ![History](./docs/screenshots/v15/03-history.png) | ![Doctor](./docs/screenshots/v15/06-doctor.png) |

### Atualizações · Custos · Variantes de Tema

| Updates Hub | Rastreamento de Custos | 4 Variantes de Tema |
|:---:|:---:|:---:|
| ![Updates](./docs/screenshots/v15/07-updates.png) | ![Costs](./docs/screenshots/v15/04-costs.png) | ![Glacier Palette](./docs/screenshots/v15/v15-glacier-palette.png) |

| Tema Light | Amber (CRT Retro) | Glacier + Densidade Compacta |
|:---:|:---:|:---:|
| ![Light](./docs/screenshots/v15/v15-light-doctor.png) | ![Amber](./docs/screenshots/v15/v15-amber-doctor.png) | ![Glacier Compacto](./docs/screenshots/v15/v15-glacier-compact.png) |

</div>

## Instalação Rápida

### Download (Windows)

Baixe o instalador `.msi` ou `.exe` no [último release](https://github.com/HelbertMoura/ai_launcher/releases).

```bash
# Opção 1: Winget (em breve)
winget install DevManiacs.AILauncher

# Opção 2: Chocolatey (em breve)
choco install ai-launcher -y

# Opção 3: Download manual
# Pegue o .msi ou .exe do último release em:
# https://github.com/HelbertMoura/ai_launcher/releases
```

> O SmartScreen pode alertar em builds sem assinatura — clique em **Mais informações → Executar mesmo assim**.

### Build a Partir do Código

**Pré-requisitos:** Node 20+, Rust stable, Visual Studio Build Tools com **Desktop development with C++**.

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri build
```

O `.msi` é gerado em `src-tauri/target/release/bundle/msi/`.
O `.exe` NSIS é gerado em `src-tauri/target/release/bundle/nsis/`.

## Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Abrir paleta rica de comandos |
| `Ctrl+1` | Aba Lançar |
| `Ctrl+2` | Aba Ferramentas |
| `Ctrl+3` | Aba Histórico (timeline waterfall) |
| `Ctrl+4` | Aba Custos |
| `Ctrl+5` | Aba Workspaces (grid bento) |
| `Ctrl+6` | Aba Doctor (diagnóstico do ambiente) |
| `Ctrl+7` | Aba Atualizações |
| `Ctrl+8` | Aba Pré-requisitos |
| `Ctrl+,` | Aba Admin |
| `?` | Aba Ajuda |
| `Esc` | Fechar diálogo |

## Superfícies

O app tem 10 superfícies principais acessíveis pela sidebar:

| Aba | O que faz |
|-----|-----------|
| **Lançar** | Escaneie CLIs de IA, instale as faltantes, lance com diretório e args customizados |
| **Ferramentas** | Detecte e gerencie IDEs — instale ferramentas faltantes com um clique |
| **Histórico** | Timeline waterfall estilo terminal + log de sessões com reabertura e dots de status |
| **Custos** | Breakdown de custo por CLI — totais diários e mensais com tracking de tokens |
| **Workspaces** | Grid bento: Profiles, Budget, resumo do Doctor, Runbooks, Sessões Recentes |
| **Doctor** | Health check do ambiente com severidade (crítico/aviso/info) + fixes guiados |
| **Atualizações** | Hub centralizado para updates de CLIs, ferramentas e pré-requisitos |
| **Pré-reqs** | Health check do sistema — Node, npm, Bun, Python, Rust, Git, Docker, Terminal |
| **Admin** | Providers (com teste de API), perfis, aparência, overrides de CLIs, IDEs customizadas |
| **Ajuda** | Atalhos, FAQ, terminal animado demo, replay do tour de boas-vindas |

## 🚀 Novidades da v15 — AI Ops Command Center

- **Workspace Profiles** — agrupe configs por repo, time ou contexto com troca em um clique
- **Agent Runbooks** — sequências automatizadas de setup para workflows de agentes
- **Provider Budget Guard** — limites locais de custo com alertas configuráveis
- **Environment Doctor** — diagnostique e repare ambientes de dev quebrados
- **Safe Command Preview** — revise nível de risco antes de rodar comandos customizados
- **Auto-Atualização** — verificação de updates in-app com validação por checksum
- **Launch Profiles unificados** — presets e templates de sessão fundidos em um só modelo
- **Session Lifecycle** — tracking real de status de processo (iniciando/rodando/completo/falhou)
- **4 Temas** — dark, light, amber (CRT retro), glacier (frio azul) com ciclagem por `☾`
- **Paleta de Comandos Rica** — categorias, ícones, chips de atalho, sessões recentes
- **Bento Workspace** — layout editorial com 5 cards de navegação direta
- **History Waterfall** — timeline horizontal terminal-native das últimas 24h/7d
- **Density Toggle** — alternância compacto/confortável via `▦` no topo
- **Secure Secrets** — API keys via DPAPI (Windows) com fallback transparente
- **Command Deck 2.0** — hierarquia limpa, zero `alert()` nativo, focus trap em dialogs

### 🐛 Fix crítico (afetava v13/v14)

Os botões **Instalar** em Pré-reqs, **Corrigir** no Doctor e **Install prereq** em Updates **não faziam nada ao clicar** em versões anteriores. Corrigido adicionando chave canônica ao `CheckResult` e botão real no `PrereqCard`.

<details><summary>Destaques da v14</summary>

- **Início com Windows + atalho global** — abre junto com o sistema, foca de qualquer lugar
- **Diretórios fixados + templates de sessão** — um clique para relançar seus setups favoritos
- **Filtros no histórico, export de custos, notificações** — observabilidade completa
- **Cor de destaque livre** — qualquer hex, não só os 5 presets
- **Backend modularizado** — `main.rs` de 3105 → ~120 linhas, erros tipados, testes unitários
- **CI com quality gates** — tsc, vitest, clippy, cargo audit, Playwright E2E em cada PR

</details>

<details><summary>Destaques da v13</summary>

- **Novo ícone minimalista** — Design Hex Hub em vermelho, limpo e reconhecível em qualquer tamanho
- **Provider persiste no histórico** — Ao reabrir uma sessão do Claude, restaura o provider exato usado
- **Dropdown de diretórios recentes** — Últimos 10 diretórios por CLI ao focar no campo
- **Screenshots na documentação** — Galeria completa de todas as telas do app no README

</details>

<details><summary>Destaques da v12.5</summary>

- Aba Atualizações — Superfície dedicada para updates de CLIs, ferramentas e pré-requisitos
- Instalar pelos cards — Instale CLIs e ferramentas faltantes direto nas abas
- Histórico avançado — Reabra sessões, descrições, badges de status, tracking de duração
- Botão Testar API — Teste conexões de providers com exibição de latência
- Ícones oficiais — Logos reais via LobeHub Icons e devicons
- Tela de boas-vindas — Branding DevManiacs, tour guiado

</details>

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 6 + Vite |
| Backend | Rust (Tauri v2) com DPAPI nativo para secrets |
| Estilo | CSS Custom Properties (sistema de tokens · 4 temas) |
| Typography | JetBrains Mono · Inter · Space Grotesk (display) |
| Ícones | Logos oficiais (LobeHub Icons, devicons) + Phosphor Icons |
| i18n | i18next 24 |
| Testes | Vitest (61 testes), Playwright E2E, cargo test |
| Build | Tauri CLI → `.msi` + `.exe` (NSIS) |
| Distribuição | GitHub Releases · Winget (em breve) · Chocolatey (em breve) |

## Contribuindo

Faça fork do repositório, crie uma branch de feature e abra um PR contra `main`. Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para setup, convenções e checklist de PR.

## Licença

MIT — veja [LICENSE](./LICENSE).

## Créditos

- **Autor:** Helbert Moura — [DevManiac's](https://github.com/HelbertMoura)
- **Ícones** — [LobeHub Icons](https://github.com/lobehub/lobe-icons), [devicons](https://github.com/devicons/devicon), [Phosphor Icons](https://phosphoricons.com/)
- Nomes de marcas e marcas registradas pertencem aos seus respectivos donos.

---

<div align="center">

**[Download](https://github.com/HelbertMoura/ai_launcher/releases/tag/v15.0.0)** · **[Reportar Bug](https://github.com/HelbertMoura/ai_launcher/issues)** · **[Sugerir Feature](https://github.com/HelbertMoura/ai_launcher/issues)**

</div>
