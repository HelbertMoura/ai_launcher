> [🇺🇸 English](./README.md) | 🇧🇷 Português (Brasil)

<div align="center">

```text
   ┌─ AI LAUNCHER PRO ────────────────────────── v12.5.0 ──┐
   │                                                        │
   │   ▎ COMMAND DECK                                       │
   │                                                        │
   │   ● claude-code    online     v4.7                     │
   │   ● codex          online     v1.0                     │
   │   ○ gemini         ausente                            │
   │   ● qwen           online     v0.9                     │
   │   ● crush          online     v1.2                     │
   │   ● droid          online     v0.8                     │
   │   ▲ kilocode       update     v0.5 → v0.6             │
   │   ● opencode       online     v0.3                     │
   │                                                        │
   │   7/8 online    ⬆ 1 update    ● ADMIN    $0.42 hoje   │
   └────────────────────────────────────────────────────────┘
```

**Um app desktop para detectar, instalar, executar, atualizar e monitorar todas as suas ferramentas de IA.**

[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](./LICENSE)
[![Versão 12.5.0](https://img.shields.io/badge/vers%C3%A3o-12.5.0-ff3131?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
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
| 📋 | **Histórico Avançado** | Log de sessões com reabertura, descrições, badges de status e duração |
| 🔍 | **Verificação de Pré-requisitos** | Cheque Node, npm, Bun, Python, Rust, Cargo, Git, Docker e mais |
| 🔌 | **Providers** | Anthropic, Z.AI, MiniMax, Moonshot, Qwen, OpenRouter + endpoints customizados com botão de teste de API |
| 🎨 | **Customização Completa** | Tema Dark/Light, 5 cores de destaque, 5 fontes mono, overrides de CLIs |
| 🌐 | **i18n** | Inglês e Português (Brasil) com alternância instantânea |
| ⌨️ | **Keyboard-First** | Paleta `Ctrl+K`, navegação `Ctrl+1-6`, admin `Ctrl+,`, ajuda `?` |
| 🔒 | **Privacidade Primeiro** | Tudo fica local — sem telemetria, sem sync na nuvem |

## Instalação Rápida

### Download (Windows)

Baixe o instalador `.msi` no [último release](https://github.com/HelbertMoura/ai_launcher/releases).

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

## Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Abrir paleta de comandos |
| `Ctrl+1` | Aba Launch |
| `Ctrl+2` | Aba Ferramentas |
| `Ctrl+3` | Aba Histórico |
| `Ctrl+4` | Aba Custos |
| `Ctrl+5` | Aba Atualizações |
| `Ctrl+6` | Aba Pré-requisitos |
| `Ctrl+,` | Aba Admin |
| `?` | Aba Ajuda |
| `Esc` | Fechar diálogo |

## Superfícies

O app tem 8 superfícies principais acessíveis pela sidebar:

| Aba | O que faz |
|-----|-----------|
| **Launch** | Escaneie CLIs de IA, instale as faltantes, lance com diretório e args customizados |
| **Ferramentas** | Detecte e gerencie IDEs — instale ferramentas faltantes com um clique |
| **Histórico** | Navegue sessões passadas com reabertura, descrições inline, badges de status e duração |
| **Custos** | Breakdown de custo por CLI — totais diários e mensais com tracking de tokens |
| **Atualizações** | Hub centralizado para updates de CLIs, ferramentas e pré-requisitos — atualize tudo ou individualmente |
| **Pré-reqs** | Health check do sistema — Node, npm, Bun, Python, Rust, Git, Docker, Terminal |
| **Admin** | Providers (com teste de API), presets, aparência, overrides de CLIs, IDEs customizadas |
| **Ajuda** | Atalhos, FAQ, terminal animado demo, replay do tour de boas-vindas |

## Novidades da v12.5

- **Aba Atualizações** — Superfície dedicada para updates de CLIs, ferramentas e pré-requisitos com botão Atualizar Tudo
- **Instalar pelos cards** — Instale CLIs e ferramentas faltantes direto nas abas Launch e Tools
- **Histórico avançado** — Reabra sessões, adicione descrições, badges de status (rodando/terminado/erro), tracking de duração, lembra último diretório por CLI
- **Botão Testar API** — Teste conexões de providers direto do Admin com exibição de latência
- **Ícones oficiais** — Logos reais dos vendors via LobeHub Icons e devicons, visíveis em ambos os temas
- **Tela de boas-vindas** — Reformulada com branding DevManiacs, tour guiado e opção "sempre mostrar"
- **i18n** — Cobertura completa pt-BR e EN para todas as novas funcionalidades

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 6 + Vite |
| Backend | Rust (Tauri v2) |
| Estilo | CSS Custom Properties (sistema de tokens) |
| i18n | i18next 24 |
| Ícones | Logos oficiais de marca (LobeHub Icons, devicons) |
| Build | Tauri CLI → `.msi` + `.exe` |

## Contribuindo

Faça fork do repositório, crie uma branch de feature e abra um PR contra `main`. Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para setup, convenções e checklist de PR.

## Licença

MIT — veja [LICENSE](./LICENSE).

## Créditos

- **Autor:** Helbert Moura — [DevManiac's](https://github.com/HelbertMoura)
- **Ícones** — [LobeHub Icons](https://github.com/lobehub/lobe-icons), [devicons](https://github.com/devicons/devicon)
- Nomes de marcas e marcas registradas pertencem aos seus respectivos donos.

---

<div align="center">

**[Download](https://github.com/HelbertMoura/ai_launcher/releases)** · **[Reportar Bug](https://github.com/HelbertMoura/ai_launcher/issues)** · **[Sugerir Feature](https://github.com/HelbertMoura/ai_launcher/issues)**

</div>
