# AI Launcher Pro

**Oito CLIs de IA. Um launcher terminal-native.**

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Rust](https://img.shields.io/badge/Rust-2021-orange)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

![AI Launcher Pro](./public/images/banner.svg)

**Idioma:** [English](./README.md) · Português

<br />

**Plataformas:** Windows ✅ · macOS 🔜 · Linux 🔜

> Windows 10/11 é o único suporte oficial por enquanto. Builds macOS e Linux estão planejadas — acompanhe a [página de releases](https://github.com/HelbertMoura/ai_launcher/releases) ou dê star no repo pra ser notificado.

<br />

---

## O que é

**AI Launcher Pro** é um aplicativo desktop construído com Tauri v2 para centralizar o dia a dia de quem usa ferramentas CLI de IA para programar. Em vez de memorizar comandos, variáveis de ambiente e endpoints por provider, você tem um painel terminal-native que detecta, instala, configura e executa cada CLI com um atalho.

Oito CLIs são suportadas de fábrica — Claude Code, Codex, Cursor, Gemini, Qwen, iFlow, Copilot e outras — com troca dinâmica entre providers (Anthropic oficial, Z.AI, MiniMax e qualquer base URL customizada). Tudo roda local: histórico, presets, tokens e custos ficam no seu disco. Zero telemetria, zero sincronização remota.

---

## Screenshots

<table>
  <tr>
    <td><img src="./docs/screenshots/launcher.png" alt="Aba Launcher" /></td>
    <td><img src="./docs/screenshots/history.png" alt="Aba Histórico" /></td>
  </tr>
  <tr>
    <td><img src="./docs/screenshots/costs.png" alt="Aba Custos" /></td>
    <td><img src="./docs/screenshots/palette.png" alt="Command Palette" /></td>
  </tr>
</table>

---

## Features

- **Interface terminal-native** com tipografia monoespaçada, prompts `>` e painéis inspirados em tmux.
- **Multi-CLI launcher** com 8+ CLIs detectadas ou instaláveis in-app (Claude Code, Codex, Cursor, Gemini, Qwen, iFlow, Copilot e mais).
- **Switch de provider** — Anthropic, Z.AI, MiniMax, **Moonshot/Kimi, Qwen (beta), OpenRouter** e base URLs custom, sem reabrir o terminal.
- **Presets** com diretório de trabalho e argumentos salvos, prontos pra lançar com um atalho.
- **Histórico estilo git-log** com filtros por CLI e preset, re-run em um clique e cópia dos args originais.
- **Agregação de custo** com orçamento diário configurável e sparklines de 7 dias por CLI.
- **Command palette** com painel de preview contextual e seções de pinned/recent.
- **Font picker** (JetBrains Mono, IBM Plex Mono, Cascadia Code, Berkeley Mono, System UI).
- **Checker de update in-app** usando a GitHub Releases API — notifica sem depender de auto-updater.
- **Modal de ajuda** acessível via `⌘/` com todos os atalhos documentados.
- **Toggle admin em runtime** via chord (`⌘⇧A`) ou query string (`?admin=1`) — **v5.5.1+**.
- **Interface bilíngue (EN / pt-BR)** com detecção automática do idioma do sistema — **v6.0+**.
- **Temas claro e escuro** com respeito total a `prefers-reduced-motion`.

---

## Instalação

### Para usuário final

1. Baixe o instalador mais recente na página de [Releases](https://github.com/HelbertMoura/ai_launcher/releases).
2. Execute o `.msi` (Windows), `.dmg` (macOS) ou `.AppImage` (Linux).
3. Abra o AI Launcher Pro e configure seu primeiro provider na aba **Admin** (ou via atalho `⌘⇧A` se a build for pública).

### A partir do código-fonte

Pré-requisitos: Node.js 20+, Rust 1.77+, toolchain Tauri v2.

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev
```

Para gerar um build de produção:

```bash
npm run tauri build
```

Os artefatos ficam em `src-tauri/target/release/bundle/`.

---

## Atalhos de teclado

| Teclas       | Ação                                                  |
| ------------ | ----------------------------------------------------- |
| `⌘K`         | Abre a paleta de comandos                             |
| `⌘⇧1`–`⌘⇧4`  | Alterna entre abas (Launcher / Install / Histórico / Custos) |
| `⌘1`–`⌘9`    | Lança um preset pelo índice                           |
| `⌘/`         | Abre o modal de ajuda                                 |
| `⌘⇧A`        | Alterna o admin mode em runtime                       |
| `⌘⇧L`        | Troca o idioma (EN ↔ pt-BR)                          |
| `F5`         | Re-verifica quais CLIs estão instaladas               |
| `Esc`        | Fecha modais e overlays                               |

> No Windows/Linux `⌘` = `Ctrl`, `⇧` = `Shift`.

---

## Idioma

O AI Launcher Pro auto-detecta o idioma do navegador/sistema e carrega **pt-BR** quando aplicável, com fallback para **EN**. Você pode forçar a troca de duas formas:

- pelo dropdown do globo no **HeaderBar**;
- pelo atalho `⌘⇧L`.

A preferência é persistida em `localStorage['ai-launcher:locale']` e respeitada em todas as aberturas subsequentes.

---

## Modo admin

A aba **Admin** expõe CRUD completo de providers e presets, além de controles sensíveis (limpeza de histórico, exportação de dados). Existem três formas de ativá-la:

1. **Chord de runtime:** pressione `⌘⇧A` a qualquer momento na build pública.
2. **Query string:** abra o launcher com `?admin=1` na URL (útil para sessões temporárias).
3. **Flag de build:** gere uma build com `VITE_ADMIN_MODE=1` para deixar o modo sempre ligado.

Veja as [release notes da v5.5.1](./CHANGELOG.md) para detalhes sobre a implementação do toggle runtime.

---

## Providers

O AI Launcher Pro aponta qualquer CLI Anthropic-compatible para um backend diferente injetando as env vars certas no launch. Seeds built-in (todas editáveis/removíveis em Admin → Providers):

| Provider              | Tipo       | Base URL (intl)                                        | Modelo principal            | Contexto | Notas |
| :-------------------- | :--------- | :----------------------------------------------------- | :-------------------------- | :------- | :---- |
| Anthropic             | oficial    | —                                                      | `claude-opus-4-7`           | 1M       | Config padrão — sem override de env |
| Z.AI (GLM)            | nativa     | `api.z.ai/api/anthropic`                               | `glm-5.1`                   | 200K     | Mapeia opus/sonnet → glm-5.1, haiku → glm-4.7 |
| MiniMax               | nativa     | `api.minimax.io/anthropic`                             | `MiniMax-M2.7`              | 200K     | China: `api.minimaxi.com/anthropic` |
| **Moonshot / Kimi**   | nativa     | `api.moonshot.ai/anthropic`                            | `kimi-k2-0905-preview`      | 256K     | Plano oficial "Kimi for Code". China: `api.moonshot.cn/anthropic` |
| **Qwen / DashScope**  | **beta**   | `dashscope-intl.aliyuncs.com/api/v2/apps/claude-code`  | `qwen3-coder-plus`          | 256K     | ⚠️ Integração Claude Code ainda em validação. Endpoint pode mudar durante rollout |
| **OpenRouter**        | aggregator | `openrouter.ai/api/v1`                                 | qualquer slug (ex: `anthropic/claude-sonnet-4`) | varia    | Uma chave, dezenas de modelos (Anthropic, Moonshot, Qwen, GLM, Gemini, GPT) |
| Custom                | custom     | qualquer URL Anthropic-compat                          | —                           | —        | Roll your own |

Tokens ficam local only. Sem telemetria, sem conta, sem relay. Cada provider injeta `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` + overrides de modelo quando selecionado.

### Regiões / endpoints CN

- **MiniMax** — internacional `api.minimax.io/anthropic`, China `api.minimaxi.com/anthropic`
- **Moonshot** — internacional `api.moonshot.ai/anthropic`, China `api.moonshot.cn/anthropic`
- **Qwen** — internacional `dashscope-intl.aliyuncs.com/...`, China `dashscope.aliyuncs.com/...`

### Chaves de API

Obtenha uma chave em:

- **Anthropic** — https://console.anthropic.com/
- **Z.AI** — https://z.ai/model-api
- **MiniMax** (Intl) — https://platform.minimax.io/ · (CN) — https://api.minimaxi.com/
- **Moonshot** (Intl) — https://platform.moonshot.ai/ · (CN) — https://platform.moonshot.cn/
- **Qwen (DashScope)** (Intl) — https://dashscope-intl.console.aliyun.com/ · (CN) — https://bailian.console.aliyun.com/
- **OpenRouter** — https://openrouter.ai/keys

---

## Modos de build

| Modo             | Comando                                    | Admin disponível?                     |
| ---------------- | ------------------------------------------ | ------------------------------------- |
| Release público  | `npm run tauri build`                      | Sim — via toggle runtime (`⌘⇧A`)     |
| Admin-full       | `VITE_ADMIN_MODE=1 npm run tauri build`    | Sempre ligado, sem possibilidade de desligar |

Use o modo **Admin-full** em ambientes internos ou para o seu próprio setup; use o **Release público** para distribuição.

---

## Arquitetura

- Shell desktop em **Tauri v2** (Rust 2021 + `tokio` no backend).
- Frontend em **React 19 + TypeScript strict**, build com **Vite 8**.
- CSS 100% escrito à mão com design tokens (sem utility-first framework).
- Command menu via **cmdk**, ícones via **lucide-react**.
- IPC via `@tauri-apps/api` (`invoke()` + event channel).
- Persistência local em `localStorage` e arquivos JSON no diretório de dados do usuário.

Para o mapa completo de diretórios, comandos IPC e fluxos de estado, consulte [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Sistema visual

Tokens de cor, tipografia, espaçamento, movimento e regras de contraste estão documentados em [`docs/VISUAL_SYSTEM.md`](./docs/VISUAL_SYSTEM.md).

---

## Contribuir

Issues e pull requests são bem-vindos. Antes de abrir um PR, leia o [`CONTRIBUTING.md`](./CONTRIBUTING.md) para entender o fluxo de desenvolvimento, padrões de commit e requisitos de testes.

---

## Changelog

A história completa está em [`CHANGELOG.md`](./CHANGELOG.md). Destaques recentes:

- **v6.1.0** — Mais providers (Moonshot, Qwen beta, OpenRouter).
- **v6.0** — Interface bilíngue (EN / pt-BR) com detecção automática.
- **v5.5.1** — Toggle de admin em runtime (chord + query string + flag de build).
- **v5.5.0** — Redesign terminal-native: painéis estilo tmux, prompts `>`, typography mono-first.

---

## Licença

Distribuído sob licença **MIT**. Veja [`LICENSE`](./LICENSE) para o texto completo.

Copyright © 2026 Helbert Moura | DevManiac's

---

## Créditos

Construído com:

- [Tauri](https://tauri.app/) — shell desktop cross-platform
- [React](https://react.dev/) — UI declarativa
- [Vite](https://vitejs.dev/) — bundler e dev server
- [lucide-react](https://lucide.dev/) — biblioteca de ícones
- [cmdk](https://cmdk.paco.me/) — command menu
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — tipografia monoespaçada padrão
- [react-i18next](https://react.i18next.com/) — internacionalização
