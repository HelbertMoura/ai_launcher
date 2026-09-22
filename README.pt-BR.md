> [🇺🇸 English](./README.md) | 🇧🇷 Português (Brasil)

<div align="center">

<img src="./docs/terminal-hero.svg" alt="AI Launcher Pro — Command Deck Terminal" width="760">

<!-- demo gif: recorded by the Demo GIF workflow (scripts/record-demo.mjs) -->
<img src="./docs/demo.gif" alt="Demonstração do AI Launcher — paleta de comandos e temas" width="760">

# AI Launcher
### O Command Deck Open Source para Agentes de Código com IA & MCPs

**Uma central desktop nativa, ultra leve e segura para detectar, executar, orquestrar e monitorar todos os seus agentes CLI de IA, IDEs customizadas, servidores MCP e limites de custo por provedor.**

[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](./LICENSE)
[![Versão 23.0.0](https://img.shields.io/badge/vers%C3%A3o-23.0.0-ff3131?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
[![Plataforma: Windows | macOS | Linux](https://img.shields.io/badge/plataforma-Windows%20%7C%20macOS%20%7C%20Linux-0078D4?labelColor=1a1a1d)](https://github.com/HelbertMoura/ai_launcher/releases)
[![Quality Gates](https://github.com/HelbertMoura/ai_launcher/actions/workflows/quality.yml/badge.svg)](https://github.com/HelbertMoura/ai_launcher/actions/workflows/quality.yml)
![React 19](https://img.shields.io/badge/React-19-61dafb?labelColor=1a1a1d)
![Tauri v2](https://img.shields.io/badge/Tauri-v2-ffc131?labelColor=1a1a1d)
![Rust](https://img.shields.io/badge/Rust-stable-dea584?labelColor=1a1a1d)
![Memória <40MB](https://img.shields.io/badge/RAM-%3C40MB-success?labelColor=1a1a1d)

[📥 Baixar Instalador](https://github.com/HelbertMoura/ai_launcher/releases/latest) · [💡 Por que o AI Launcher?](#-por-que-o-ai-launcher) · [📸 Tour Visual](#-galeria--tour-visual) · [🌟 Os 4 Pilares](#-os-4-pilares-do-sistema) · [⚡ Instalação Rápida](#-instalação-rápida) · [🗺️ Roadmap](./ROADMAP.pt-BR.md) · [🤝 Código de Conduta](./CODE_OF_CONDUCT.md)

</div>

---

## 💡 Por que o AI Launcher?

Desenvolver com IA hoje se tornou um desafio de organização: múltiplos CLIs espalhados, configurações `.mcp.json` desorganizadas a cada repositório, faturas surpresa no cartão de crédito por consumo de tokens e aplicativos pesados em Electron que consomem gigabytes de memória.

**O AI Launcher devolve o controle, a fluidez e o foco para o seu ambiente de desenvolvimento:**

- 🚀 **Hub Único & Centralizado:** Execute Claude Code, Antigravity, Codex, Aider, Goose, Cline, Roo Code, Qwen, Kilo Code, OpenCode, Crush, Factory Droid, Continue, Cody, Copilot, VS Code, Cursor e Windsurf em 1 clique.
- 🧩 **Hub MCP por Projeto:** Detecta automaticamente a stack do repositório e configura servidores MCP validados sem esforço manual.
- 💰 **Budget Guard & Gestão de Custos:** Acompanhe gastos com tokens em tempo real com alertas proativos antes de estourar seu teto de gastos.
- ⚡ **Local-First & Alta Performance:** Desenvolvido em **Tauri v2 + Rust**, inicializa em <300ms, consome menos de 40MB de RAM, sem telemetria e com armazenamento criptografado no seu próprio computador.

---

## 🌟 Os 4 Pilares do Sistema

### 1. 🚀 Command Center Multi-Agente & Workspaces
- **Launcher Inteligente:** Detecta ferramentas instaladas no sistema e oferece botões de lançamento, atualização e execução instantânea.
- **Perfis de Workspace:** Agrupe diretórios, variáveis de ambiente, modelos de IA e projetos fixados para alternar de contexto sem fricção.
- **Agent Runbooks:** Crie rotinas de automação declarativas para preparar ambientes de desenvolvimento com logs em tempo real.

### 2. 🧠 Inteligência de Projeto & Diagnóstico
- **Detecção Automática de Stack:** Lê com segurança os arquivos de configuração do repositório (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Dockerfile`) sem acessar dados sensíveis.
- **Gestão de Servidores MCP:** Vincula ferramentas MCP aos projetos ativos, monitora integridade e aplica templates testados pela comunidade.
- **Environment Doctor:** Diagnósticos paralelos ultra rápidos com Tokio (`check_environment`) verificam 15 ferramentas e oferecem reparo guiado em 1 clique.

### 3. 💰 Governança de Custos, Segurança & Privacidade
- **Analytics de Custos 2.0:** Painel em tempo real por provedor (Anthropic, OpenRouter, MiniMax, Qwen, Moonshot) com filtros de 7d, 14d, 30d e 90d.
- **Budget Guard:** Defina limites financeiros mensais e receba notificações imediatas antes de surpresas no faturamento.
- **Cofre Local Seguro:** Sem telemetria, sem contas na nuvem. Todas as chaves e tokens de API são criptografados no cofre nativo do sistema — Windows Credential Manager, macOS Keychain ou Secret Service do Linux — com comportamento fail-closed quando não há cofre disponível.

### 4. ⚡ Ergonomia para Desenvolvedores & Customização
- **Keyboard-First:** Paleta global `Ctrl+K`, alternância de abas `Ctrl+1-9/0`, preferências `Ctrl+,` e ajuda rápida `?`.
- **7 Temas:** Dark, Light, Amber, Glacier, Phosphor, Midnight e um High Contrast dedicado, com ajuste dinâmico de densidade (Compacto / Confortável).
- **Atualização Criptografada (OTA):** Atualizações automáticas verificadas com assinatura digital minisign para upgrades silenciosos e seguros.

---

## 📸 Galeria & Tour Visual

<div align="center">

<p><strong>Uma experiência de Command Deck fluida, moderna e pensada exclusivamente para desenvolvedores.</strong></p>

<table>
  <tr>
    <td width="50%" align="center">
      <h3>🧭 Command Center & Workspace Readiness</h3>
      <a href="./docs/screenshots/v22/01-command-center.png"><img src="./docs/screenshots/v22/01-command-center.png" alt="Command Center & Workspace Readiness" width="100%"></a>
      <p><em>Score de readiness em tempo real, detecção de stack de projeto, ações rápidas e sessões ativas.</em></p>
    </td>
    <td width="50%" align="center">
      <h3>🚀 Hub Multi-Agente & Launcher</h3>
      <a href="./docs/screenshots/v22/07-launcher-multi-agent.png"><img src="./docs/screenshots/v22/07-launcher-multi-agent.png" alt="Hub Multi-Agente & Launcher" width="100%"></a>
      <p><em>Detecção, instalação e execução em 1 clique para Claude Code, Antigravity, Codex, Aider, Goose e mais.</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <h3>🧩 Runbooks & Automação de Setup</h3>
      <a href="./docs/screenshots/v22/02-runbooks-command-deck.png"><img src="./docs/screenshots/v22/02-runbooks-command-deck.png" alt="Runbooks Command Deck" width="100%"></a>
      <p><em>Fluxos automatizados e reproduzíveis de ambiente com aprovação por etapa e logs em tempo real.</em></p>
    </td>
    <td width="50%" align="center">
      <h3>🔗 Hub MCP por Projeto</h3>
      <a href="./docs/screenshots/v22/03-mcp-hub.png"><img src="./docs/screenshots/v22/03-mcp-hub.png" alt="Hub MCP por Projeto" width="100%"></a>
      <p><em>Mapeamento automático de servidores MCP requeridos pelo projeto, status de saúde e presets validados.</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <h3>💰 Analytics de Custos 2.0 & Budget Guard</h3>
      <a href="./docs/screenshots/v22/08-costs-analytics.png"><img src="./docs/screenshots/v22/08-costs-analytics.png" alt="Analytics de Custos 2.0 & Budget Guard" width="100%"></a>
      <p><em>Gráficos de consumo por provider com filtros dinâmicos (7d, 14d, 30d, 90d) e alertas de teto de gastos.</em></p>
    </td>
    <td width="50%" align="center">
      <h3>📋 Linha do Tempo & Histórico Waterfall</h3>
      <a href="./docs/screenshots/v22/04-history-timeline.png"><img src="./docs/screenshots/v22/04-history-timeline.png" alt="Linha do Tempo & Histórico Waterfall" width="100%"></a>
      <p><em>Histórico estilo terminal com rastreamento de duração, status e reabertura em 1 clique.</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <h3>🩺 Environment Doctor & Diagnósticos</h3>
      <a href="./docs/screenshots/v22/05-doctor-readiness.png"><img src="./docs/screenshots/v22/05-doctor-readiness.png" alt="Environment Doctor & Diagnósticos" width="100%"></a>
      <p><em>Verificação proativa de runtimes (Node, Python, Rust, Docker) com reparo guiado em 1 clique.</em></p>
    </td>
    <td width="50%" align="center">
      <h3>🎨 Ajuda, Suporte & Múltiplos Temas</h3>
      <a href="./docs/screenshots/v22/06-help-support.png"><img src="./docs/screenshots/v22/06-help-support.png" alt="Ajuda, Suporte & Múltiplos Temas" width="100%"></a>
      <p><em>Central de suporte, guia completo de atalhos e links oficiais da Dev Maniac's.</em></p>
    </td>
  </tr>
</table>

</div>

---

## ⚡ Instalação Rápida

### Download (Windows)

Baixe o instalador no [último release do GitHub](https://github.com/HelbertMoura/ai_launcher/releases/latest):

- `.exe` (NSIS) — recomendado para a maioria dos usuários.
- `.msi` — útil para instalações gerenciadas ou administrativas.

> O SmartScreen pode alertar em builds sem assinatura — clique em **Mais informações → Executar mesmo assim**.

Ou instale via **Scoop**:

```powershell
scoop bucket add ai-launcher https://github.com/HelbertMoura/ai_launcher
scoop install ai-launcher/ai-launcher
```

### Download (macOS)

Baixe o `.dmg` correspondente ao seu Mac no [último release do GitHub](https://github.com/HelbertMoura/ai_launcher/releases/latest):

- `*-aarch64.dmg` — Apple Silicon (M1/M2/M3/M4).
- `*_x64.dmg` — Macs Intel.

Abra o `.dmg` e arraste o **AI Launcher** para **Aplicativos**. O app ainda não é notarizado, então o Gatekeeper alerta na primeira abertura: clique com o botão direito no app em Aplicativos e escolha **Abrir**, depois confirme — da segunda abertura em diante ele abre normalmente.

### Download (Linux)

Pelo [último release do GitHub](https://github.com/HelbertMoura/ai_launcher/releases/latest):

- **AppImage** — torne o arquivo executável e execute:

  ```bash
  chmod +x AI.Launcher_<versão>_amd64.AppImage
  ./AI.Launcher_<versão>_amd64.AppImage
  ```

- **Debian / Ubuntu (.deb)**:

  ```bash
  sudo apt install ./AI.Launcher_<versão>_amd64.deb
  ```

> **Gerenciadores de pacote:** o **Scoop já está disponível** pelo bucket do próprio repositório (veja a seção do Windows acima) e se atualiza automaticamente a cada novo release.

### Build a Partir do Código

**Pré-requisitos:** Node.js 20.19+ ou 22.12+, Rust stable e Visual Studio Build Tools com **Desktop development with C++**.

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm ci
npm run tauri build
```

Os instaladores são gerados em:

- MSI: `src-tauri/target/release/bundle/msi/`
- EXE (NSIS): `src-tauri/target/release/bundle/nsis/`

---

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Abrir paleta rica de comandos |
| `Ctrl+1` | Command Center |
| `Ctrl+2` | Aba Lançar |
| `Ctrl+3` | Aba Ferramentas |
| `Ctrl+4` | Aba MCP |
| `Ctrl+5` | Aba Histórico (dashboard de sessões) |
| `Ctrl+6` | Aba Analytics |
| `Ctrl+7` | Aba Workspaces |
| `Ctrl+8` | Aba Doctor (diagnóstico do ambiente) |
| `Ctrl+9` | Aba Atualizações |
| `Ctrl+0` | Aba Pré-requisitos |
| `Ctrl+,` | Aba Admin |
| `?` | Aba Ajuda |
| `Esc` | Fechar diálogo |

---

## 🧭 Superfícies

O app tem 11 superfícies principais acessíveis pela sidebar:

| Aba | O que faz |
|-----|-----------|
| **Command Center** | Comece pelo workspace ativo, lance agentes, veja readiness, sessões e inteligência do projeto |
| **Lançar** | Escaneie CLIs de IA, instale as faltantes, lance com diretório e args customizados |
| **Ferramentas** | Detecte e gerencie IDEs — instale ferramentas faltantes com um clique |
| **MCP** | Gerencie configs MCP de Claude/Codex/Gemini com backups, catálogo e health checks |
| **Histórico** | Dashboard de sessões com filtros, replay, kill e badges de workspace/agente |
| **Analytics** | Breakdown de custo por provider — totais diários e mensais com tracking de tokens |
| **Workspaces** | Profiles, Agent Profiles, Budget, resumo do Doctor, Runbooks e Sessões Recentes |
| **Doctor** | Health check do ambiente com severidade (crítico/aviso/info) + fixes guiados |
| **Atualizações** | Hub centralizado para updates de CLIs, ferramentas e pré-requisitos |
| **Pré-reqs** | Health check do sistema — Node, npm, Bun, Python, Rust, Cargo, Git, Docker e PowerShell |
| **Admin** | Providers (com teste de API), perfis, aparência, overrides de CLIs, IDEs customizadas |
| **Ajuda** | Atalhos, FAQ, terminal animado demo, replay do tour de boas-vindas |

---

## 🚀 Novidades da v22 — Ecossistema Multi-Agente & Núcleo Modular

- **Backend Rust Modular** — Núcleo monolítico refatorado em sub-módulos coesos (`definitions`, `process`, `terminal`, `versions`, `tray_cfg`) para máxima manutenibilidade e performance nativa.
- **Suporte Expandido a Novos Agentes** — Integração de primeira classe e ícones vetoriais nativos para Aider, Goose, Cline e Roo Code junto aos motores existentes.
- **Analytics & Inteligência de Custos 2.0** — Seletor de período dinâmico (7d, 14d, 30d, 90d), projeção de run-rate de tokens e telemetria de consumo em tempo real.
- **Identidade Oficial Dev Maniac's** — Rodapé oficial e pontos de contato integrados em todas as superfícies com acionamento nativo de navegador externo.
- **Decomposição de Componentes React** — Visual Command Deck polido com componentes desacoplados (`ProjectIntelligence`, `ReadinessCard`).

Leia as [notas da release v22](./docs/releases/v22.0.0.md).

<details><summary>Destaques da v21</summary>

- **Trust Foundation** — secrets de providers falham fechado no Windows Credential Manager, com migração legada mais segura e guardrails de storage.
- **Sistema visual Command Deck** — app shell mais claro, tipografia melhor, controles de densidade/acento, baselines light/dark/high-contrast e layouts keyboard-first.
- **Command Center 2.0** — estados guiados, readiness do projeto, revisão de `.ailauncher.json`, sessões ativas e ações primárias mais seguras.
- **Runbooks 3.0** — dry-run, aprovações, retry/resume, stop real, output limitado e timeline de atividade por workspace.
- **Páginas operacionais renovadas** — Launcher, Workspaces, History, MCP, Updates, Admin, Analytics, Doctor, Prereqs, Onboarding e Help.
- **Release readiness** — E2E de workflows críticos, matriz visual, audits de capabilities/storage e smoke do executável Windows empacotado.

</details>

<details><summary>Destaques da v20</summary>

- **Command Center** — home default com workspace ativo, launch, readiness cards, sessões e inteligência do projeto
- **Project Intelligence** — detector de stack para Node/React/Vite/Tauri/Rust/Python/Go/Docker/MCP e criação de `.ailauncher.json`
- **Runbooks 2.0** — presets locais, steps condicionais e timelines persistidas de execução
- **MCP por Projeto** — resolve MCPs exigidos no profile do projeto e mostra saudáveis/faltantes
- **Agent Profiles** — presets reutilizáveis de launch com CLI, args e provider
- **Sessions 2.0** — métricas, filtros persistidos, replay pelo fluxo compartilhado e kill com confirmação
- **Backup Trust** — manifest de export, redaction recursiva de secrets e preview antes de restaurar
- **Updater Trust** — cadeia `latest.json`/SHA-256/GitHub Release visível e auditoria do manifesto

</details>

<details><summary>Destaques da v16</summary>

- **Agent Analytics** — série de custos 30d, top projetos, breakdown por modelo e export CSV/JSON
- **Inbox Center** — notificações locais de update, budget, doctor e sessões com estado de leitura
- **Acessibilidade AA** — correções de contraste, cobertura axe e foco mais seguro
- **MCP Manager** — gerencie configs MCP de Claude, Codex e Gemini com backup e health checks
- **Theme Foundry** — temas Phosphor, Midnight e High Contrast com testes de contrato de tokens
- **Project Profiles** — `.ailauncher.json` preenche CLI, provider, diretório e env por repo
- **Workspace Profiles** — agrupe configs por repo, time ou contexto com troca em um clique

</details>

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

---

## 🛠️ Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 7 + Vite |
| Backend | Rust (Tauri v2) com o keyring nativo do sistema (Windows Credential Manager / macOS Keychain / Linux Secret Service) |
| Estilo | CSS Custom Properties (sistema de tokens · 7 temas: dark, light, amber, glacier, phosphor, midnight, high-contrast) |
| Typography | JetBrains Mono · Inter · Space Grotesk (display) |
| Ícones | Logos oficiais (LobeHub Icons, devicons) + Phosphor Icons |
| i18n | i18next 26 |
| Testes | Vitest (239 testes), Playwright E2E/visual, cargo test (127 testes Rust) |
| Build | Tauri CLI → `.msi` + `.exe` (NSIS) · `.dmg` (Apple Silicon + Intel) · AppImage + `.deb` |
| Distribuição | GitHub Releases · Scoop (auto-update no Windows) |

---

## 🤝 Contribuindo

Faça fork do repositório, crie uma branch de feature e abra um PR contra `main`. Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para setup, convenções e checklist de PR.

---

## 📄 Licença

MIT — veja [LICENSE](./LICENSE).

---

## ☕ Créditos & Suporte

- **Desenvolvido à base de ☕ e ⚡ por:** [Dev Maniac's](https://devmaniacs.com.br/) · [Redes e contatos](https://linktr.ee/helbertmoura)
- **Autor:** Helbert Moura — [DevManiac's](https://devmaniacs.com.br/)
- **Ícones** — [LobeHub Icons](https://github.com/lobehub/lobe-icons), [devicons](https://github.com/devicons/devicon), [Phosphor Icons](https://phosphoricons.com/)
- Nomes de marcas e marcas registradas pertencem aos seus respectivos donos.

---

<div align="center">

Desenvolvido à base de ☕ e ⚡ por **[Dev Maniac's](https://devmaniacs.com.br/)** · **[Redes e contatos](https://linktr.ee/helbertmoura)**

**[Download](https://github.com/HelbertMoura/ai_launcher/releases)** · **[Reportar Bug](https://github.com/HelbertMoura/ai_launcher/issues)** · **[Sugerir Feature](https://github.com/HelbertMoura/ai_launcher/issues)**

</div>
