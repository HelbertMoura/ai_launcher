<div align="center">
  <img src="./public/images/banner.svg" alt="AI Launcher Pro" width="100%" />

  <br />

  <h1>AI Launcher Pro</h1>

  <p>
    <strong>O launcher terminal-native para todas as CLIs de IA.</strong>
  </p>

  <p>
    Oito CLIs built-in. Seis providers Anthropic-compatible. CLIs e IDEs custom. Bilíngue. Local-first. Zero telemetria.
  </p>

  <p>
    <a href="https://github.com/HelbertMoura/ai_launcher/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/HelbertMoura/ai_launcher?style=flat-square&color=0a0a0a&labelColor=0a0a0a" /></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0a0a0a?style=flat-square&labelColor=0a0a0a" /></a>
    <img alt="Tauri" src="https://img.shields.io/badge/tauri-v2-ffc131?style=flat-square&labelColor=0a0a0a" />
    <img alt="React" src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&labelColor=0a0a0a" />
    <img alt="Platform" src="https://img.shields.io/badge/platform-windows-0078d6?style=flat-square&labelColor=0a0a0a" />
  </p>
</div>

<hr />

**Idioma:** [English](./README.md) · Português

**Plataformas:** Windows ✅ · macOS 🔜 · Linux 🔜

<br />

## O que é

AI Launcher Pro é um app desktop keyboard-first que unifica todas as CLIs de coding com IA em uma única janela. Em vez de abrir terminais soltos, memorizar comandos de instalação por CLI e gerenciar tokens espalhados em arquivos `.env`, você roda, atualiza e monitora cada ferramenta a partir de um painel consistente — com histórico, custos e perfis de provider lado a lado. A stack é Tauri v2 + React 19 + Rust, binário nativo, janela única com ~113 KB de JS gzipped.

O app se encaixa no workflow de quem troca entre Claude Code, Codex, Cursor, Gemini e outras CLIs ao longo do dia. O LauncherTab detecta o que já está instalado, a aba Install resolve o que falta com output ao vivo do `npm install -g` / `pip install` dentro da UI (sem terminal piscando), e o Admin Panel permite trocar do provider Anthropic oficial para Z.AI (GLM), MiniMax, Moonshot (Kimi), Qwen, OpenRouter ou qualquer endpoint Anthropic-compatible custom — sem recompilar nada. Presets salvam combinações CLI + provider + diretório + args pra launch de um atalho só.

Três pilares diferenciam o projeto: **terminal-native** (tipografia mono, prompt `>`, histórico estilo git-log, sparklines de custo), **bilíngue** (interface EN e pt-BR com troca em runtime, zero reload), e **extensível** (adicione suas próprias CLIs e IDEs em 30 segundos via formulário, ou substitua nome e icon de qualquer built-in sem tocar no código). Tudo local, zero telemetria, zero login, zero analytics — se quiser auditar, compile do código-fonte e inspecione o binário Rust.

<br />

## Destaques

### Launch & gerenciamento

- 8 CLIs built-in (Claude Code, Codex, Cursor, Gemini, Qwen, iFlow, Copilot CLI, Kilo, Crush, Droid, OpenCode) detectadas ou instaladas pelo app
- Adicione sua própria CLI em 30 segundos — só preencher nome, comando de install, version check e icon
- Histórico estilo git-log com re-run, copiar args e contexto de provider
- 9 abas keyboard-first (⌘K paleta, ⌘⇧1-4 abas primárias, ⌘/ help)
- Cadeia de fallback no launch: Windows Terminal → pwsh → powershell → cmd
- Install silencioso com output ao vivo na UI — sem janelas piscando
- Botão "Reset Claude state" pra desbloquear CLI travada em provider antigo

### Multi-provider

- 6 providers Anthropic-compatible seeded: **Anthropic**, **Z.AI (GLM)**, **MiniMax**, **Moonshot / Kimi**, **Qwen / DashScope (beta)**, **OpenRouter**
- Troca de provider ativo num clique no Admin ou via `Ctrl+P` quick-switch
- Override de modelo por perfil + tracking de budget diário com alerta
- Perfis custom pra qualquer endpoint Anthropic-compatible
- Teste de conexão via backend Rust (sem CORS) com diagnóstico por status HTTP
- Env vars custom por perfil injetadas no launch (redacted em logs e toasts)
- Preview do comando: gera `.bat` equivalente copiável antes de disparar

### UX

- Linguagem visual terminal-native — tipografia mono, prompt `>`, listas git-log, sparklines de custo
- **Interface bilíngue** — auto-detecta EN ou pt-BR do navegador, troca em runtime via dropdown globo ou ⌘⇧L
- Agregação de custo em tempo real com budget diário + sparkline 7-dias por CLI
- Command palette com painel de preview, pinned/recent, ícones lucide, footer com keycaps
- HistoryTab com multi-select de CLIs, filtros de provider e rail vertical tracejado estilo git
- StatusBar com versão, provider ativo, aba atual e link pra update disponível

### Polish

- 5 opções de fonte (JetBrains Mono padrão, IBM Plex, Cascadia, Berkeley, System)
- Temas claro/escuro com suporte a `prefers-reduced-motion`
- Customize nome e icon de qualquer CLI ou IDE built-in (hover ✎)
- Checker de update in-app via GitHub Releases
- Modal de ajuda (`⌘/`) com todos os atalhos
- Onboarding 5-step com tour de 9 slides

<br />

## Screenshots

<div align="center">
  <table>
    <tr>
      <td><img src="./docs/screenshots/launcher.png" alt="LauncherTab" width="100%" /></td>
      <td><img src="./docs/screenshots/history.png" alt="HistoryTab" width="100%" /></td>
    </tr>
    <tr>
      <td><img src="./docs/screenshots/costs.png" alt="CostsTab" width="100%" /></td>
      <td><img src="./docs/screenshots/palette.png" alt="CommandPalette" width="100%" /></td>
    </tr>
  </table>
</div>

<br />

## Instalação

### Usuário final

Baixe o `.msi` ou `.exe` mais recente na [página de releases](https://github.com/HelbertMoura/ai_launcher/releases/latest).

O Windows SmartScreen pode avisar em builds não-assinadas. Clique **Mais informações → Executar mesmo assim** ou compile do código-fonte pra auditoria completa.

### A partir do código

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev             # dev com hot-reload
npm run tauri build           # installers em src-tauri/target/release/bundle/
VITE_ADMIN_MODE=1 npm run tauri build  # build admin-sempre-ativo
```

**Pré-requisitos:** Node 18+, Rust stable, Windows 10/11, Visual Studio Build Tools com o workload "Desktop development with C++".

<br />

## CLIs suportadas

| CLI | Install (comando detectado) | Auto-detect |
|---|---|---|
| Claude Code | `npm install -g @anthropic-ai/claude-code` | ✅ |
| Codex CLI | `npm install -g @openai/codex` | ✅ |
| Gemini CLI | `npm install -g @google/gemini-cli` | ✅ |
| Qwen Code | `npm install -g @qwen-code/qwen-code` | ✅ |
| iFlow CLI | `npm install -g @iflow-ai/iflow-cli` | ✅ |
| Kilo Code | `npm install -g kilocode` | ✅ |
| Crush | `npm install -g crush` | ✅ |
| Droid | `npm install -g @factoryai/droid` | ✅ |
| OpenCode | `npm install -g opencode-ai` | ✅ |
| Cursor CLI | via installer oficial | ✅ |
| GitHub Copilot CLI | `gh extension install github/gh-copilot` | ✅ |

<br />

## Providers

### Seeds built-in

| Provider | Tipo | Base URL (intl) | Modelo principal | Contexto | Notas |
|---|---|---|---|---|---|
| **Anthropic** | Oficial | `https://api.anthropic.com` | `claude-sonnet-4` | 200K | Padrão; suporte Claude Code nativo |
| **Z.AI (GLM)** | Anthropic-compat | `https://api.z.ai/api/anthropic` | `glm-5.1` | 128K | Alternativa CN com `glm-5.1` + `glm-4.7` |
| **MiniMax** | Anthropic-compat | `https://api.minimax.io/anthropic` | `MiniMax-M2.7` | 200K | Endpoint intl; use `api.minimaxi.com` em CN |
| **Moonshot / Kimi** | Anthropic-compat | `https://api.moonshot.ai/anthropic` | `kimi-k2-0905-preview` | 256K | Plano oficial "Kimi for Code" com suporte Claude Code |
| **Qwen / DashScope** ⚠️ beta | Anthropic-compat | `https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code` | `qwen3-coder-plus` | 256K | Integração Anthropic-compat ainda em rollout; endpoint pode mudar |
| **OpenRouter** | Aggregator | `https://openrouter.ai/api/v1` | `anthropic/claude-sonnet-4` | varia | Uma chave → dezenas de modelos (Anthropic, Moonshot, Qwen, GLM, etc.) |
| **Custom** | Qualquer Anthropic-compat | livre | livre | livre | Para endpoints self-hosted ou providers futuros |

### Regiões / endpoints CN

Alguns providers chineses expõem endpoints distintos para contas intl e contas CN:

- **MiniMax** — intl `api.minimax.io/anthropic` · CN `api.minimaxi.com/anthropic`
- **Moonshot** — intl `api.moonshot.ai/anthropic` · CN `api.moonshot.cn/anthropic`
- **Qwen** — intl `dashscope-intl.aliyuncs.com` · CN `dashscope.aliyuncs.com`

Edite a `baseUrl` no Admin Panel para alternar entre regiões.

### Portals de API key

- Anthropic — https://console.anthropic.com/settings/keys
- Z.AI — https://z.ai/manage-apikey/apikey-list
- MiniMax — https://www.minimax.io/platform/user-center/basic-information/interface-key
- Moonshot — https://platform.moonshot.ai/console/api-keys
- Qwen / DashScope — https://bailian.console.aliyun.com
- OpenRouter — https://openrouter.ai/keys

<br />

## Exemplo de terminal

```text
$ ai_launcher --provider kimi
● kimi.moonshot · kimi-k2-0905-preview
  contexto 256k · pricing $0.60/M in
> lançar claude em ./meu-projeto
  running · pid 44892 · sessão pronta em 184ms
  env injetado: ANTHROPIC_BASE_URL + 2 vars
  entrada de histórico salva com atribuição de provider

$ ai_launcher
[abre GUI no browser padrão; launcher keyboard-first pronto]
```

<br />

## Atalhos de teclado

| Atalho | Ação |
|---|---|
| `⌘K` / `Ctrl+K` | Abre command palette |
| `⌘⇧1` ... `⌘⇧4` | Troca entre abas primárias (Launcher / Install / Tools / History) |
| `Ctrl+1` ... `Ctrl+9` | Dispara preset de launch |
| `⌘L` / `Ctrl+L` | Foca campo de diretório |
| `⌘P` / `Ctrl+P` | Abre quick-switch de provider |
| `⌘⇧A` / `Ctrl+Shift+A` | Alterna admin mode em runtime |
| `⌘⇧L` / `Ctrl+Shift+L` | Cicla idioma EN ↔ pt-BR |
| `⌘/` / `Ctrl+/` | Abre modal de ajuda (cheatsheet completo) |
| `Esc` | Fecha modal ativo |

<br />

## Idioma

A interface auto-detecta inglês ou português do Brasil a partir de `navigator.language` e persiste a escolha em `localStorage['ai-launcher:locale']`. Qualquer variante `pt*` (`pt`, `pt-BR`, `pt-br`, `pt-PT`) resolve para `pt-BR`; o resto cai no fallback `en`.

Troque em runtime via dropdown do globo na HeaderBar ou pelo chord `⌘⇧L` — sem reload, sem rebuild. Todos os textos visíveis (abas, modais, toasts, onboarding, ajuda, seeds de provider, command palette, Admin Panel) passam pelo `react-i18next` com 520+ chaves por locale e paridade zero entre EN e pt-BR.

Conteúdo digitado pelo usuário (nomes de preset, entradas de histórico, displayName de perfis, overrides de CLI/IDE) permanece como foi inserido — não é traduzido. O inglês é a língua-primária pra strings novas a partir da v6.0; o catálogo pt-BR preserva o copy original verbatim onde existia antes.

<br />

## Modo admin

| Método | Como | Persistência |
|---|---|---|
| **Chord em runtime** | `⌘⇧A` / `Ctrl+Shift+A` | `localStorage['ai-launcher:admin-mode']` |
| **Query na URL** | `?admin=1` ou `?admin=0` | Persistido em localStorage |
| **Build flag** | `VITE_ADMIN_MODE=1 npm run tauri build` | Permanente (admin-sempre-ativo; chord não desliga) |

Ordem de precedência: build flag vence sempre, URL override persiste, chord alterna. Tokens de API ficam em `localStorage` no escopo da app; nada é enviado pra servidor — o admin UI só edita dados locais.

<br />

## Customizar

### Adicionar sua própria CLI

Admin → **Add Custom CLI** abre um formulário com nome, key, comando de install, comando de version check, argumentos de launch, URL de docs e emoji. O card renderiza no LauncherTab com borda tracejada e dispara via `launch_custom_cli` com a mesma cadeia de fallback dos built-ins (Windows Terminal → pwsh → powershell → cmd).

### Adicionar seu próprio IDE

Tools → **Add Custom IDE** segue o mesmo padrão — nome, key, comando de detecção, comando de launch com placeholder `<dir>`, URL de docs e emoji. Persistido em `ai-launcher:custom-ides`, disparado via `launch_custom_ide`.

### Override do nome + icon de CLIs/IDEs built-in

Hover num card de CLI ou IDE built-in revela o botão ✎. Troque o nome de exibição ou substitua o icon (emoji/texto). Override vazio limpa automaticamente; "Reset" volta ao padrão. O código-fonte e a chave interna ficam intocados — o comando de install segue funcionando.

### Preferências (Admin → Preferências)

- **Max de entradas no histórico** (padrão 50)
- **Intervalo de auto-refresh** em segundos (padrão 0 = manual)
- **Timeout de comando** em segundos (padrão 300s para installs/updates)
- **Reset-to-defaults** num clique

<br />

## Modos de build

| Modo | Comando | Quando usar |
|---|---|---|
| Dev (hot-reload) | `npm run tauri dev` | Desenvolvimento local |
| Release padrão | `npm run tauri build` | Distribuição pra usuário final |
| Release admin-full | `VITE_ADMIN_MODE=1 npm run tauri build` | Builds internas com admin sempre ligado |
| Release signed | Ver `scripts/sign-build.ps1` | Distribuição com cert self-signed ou EV |

Env vars opcionais de build:

- `VITE_ADMIN_MODE=1` — força admin mode sempre ligado
- `VITE_ANTHROPIC_API_KEY` — pre-fill da chave no onboarding
- `VITE_ZAI_API_KEY`, `VITE_MINIMAX_API_KEY`, `VITE_MOONSHOT_API_KEY`, `VITE_QWEN_API_KEY`, `VITE_OPENROUTER_API_KEY` — opcionais

Nenhuma dessas vars é obrigatória; o Admin Panel permite adicionar as chaves em runtime.

<br />

## Arquitetura em resumo

```text
ai_launcher/
├── src/                       # React 19 + TypeScript + Vite 8
│   ├── App.tsx                # Router de abas + estado global
│   ├── tabs/                  # LauncherTab, InstallTab, ToolsTab, HistoryTab,
│   │                          # CostsTab, HelpTab, AdminTab, UpdatesTab
│   ├── components/            # HeaderBar, StatusBar, CommandPalette, modals
│   ├── shared/                # TerminalFrame, PromptLine, KeyCap, Sparkline
│   ├── lib/                   # customClis, customIdes, appSettings, storage,
│   │                          # providers, seeds, testConnection, i18n
│   ├── icons/                 # Curated lucide-react re-exports
│   ├── locales/               # en.json, pt-BR.json (520+ keys cada)
│   └── styles/                # tokens.css, tokens-dark.css, tokens-light.css
├── src-tauri/                 # Rust + Tauri v2
│   ├── src/main.rs            # Comandos: launch_cli, launch_custom_cli,
│   │                          # launch_custom_ide, install_cli, update_cli,
│   │                          # test_provider_connection, check_latest_release,
│   │                          # reset_claude_state, open_external_url
│   └── Cargo.toml
└── public/images/             # banner.svg, ícones, assets
```

Veja [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) para fluxo de launch, comandos Rust, schema do localStorage.

<br />

## Sistema visual

Tipografia mono-first (JetBrains Mono padrão, 4 weights self-hosted, ~87 KB total), paleta oklch, grade de 4px, motion coreografada com suporte a `prefers-reduced-motion`. Ícones `lucide-react` em vez de emoji.

Design tokens vivem em `src/styles/tokens.css` (compartilhados) + `tokens-dark.css` / `tokens-light.css` (overrides por tema). Accent color atual: warm-red `oklch(62% 0.210 25)` em ambos os temas. O budget de bundle é 300 KB gzipped pra JS; a release atual consome ~113 KB.

Veja [`docs/VISUAL_SYSTEM.md`](./docs/VISUAL_SYSTEM.md) pra paleta completa, escala tipográfica e referência de motion.

<br />

## Privacidade & segurança

- **Zero telemetria, zero analytics, zero login.** O app não faz nenhuma chamada pra servidor do autor.
- **Tokens locais.** Chaves de API ficam em `localStorage` no escopo da app; nunca saem da máquina exceto quando o CLI chamado decide usar pra falar com o provider.
- **Redacted em toda UI.** Toasts, logs, preview de comando e export de config mostram chaves mascaradas.
- **`.env.local` no `.gitignore`.** Exemplos ficam em `.env.example`; segredos reais nunca são commitados.
- **Backend direto.** Teste de conexão passa por comando Rust via `ureq` (sem CORS, sem proxy terceiro).
- **Updates opt-in.** Checker consulta GitHub Releases API com cache de 6h; nenhum ping automático pra servidor proprietário.

<br />

## Contribuir

PRs bem-vindos. Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md) pra setup, convenções, formato de commit.

<br />

## Changelog

Veja [`CHANGELOG.md`](./CHANGELOG.md). Destaques recentes:

| Versão | Tema |
|---|---|
| **v7.1.0** | Polish & Wire — bug fixes, custom launches, override built-ins |
| **v7.0.0** | Extensible — CLIs custom, IDEs custom, aba FAQ, preferências admin |
| **v6.1.0** | More providers — Moonshot, Qwen beta, OpenRouter |
| **v6.0.0** | Bilingual — EN / pt-BR com troca em runtime |
| **v5.5.1** | Runtime admin toggle |
| **v5.5.0** | Terminal Dramático — redesign visual completo |

<br />

## Licença

MIT. Veja [LICENSE](./LICENSE). Copyright © 2026 Helbert Moura | DevManiac's.

<br />

## Créditos

Feito com [Tauri v2](https://v2.tauri.app), [React 19](https://react.dev), [Vite 8](https://vite.dev), [lucide-react](https://lucide.dev), [cmdk](https://cmdk.paco.me), [JetBrains Mono](https://www.jetbrains.com/lp/mono), [react-i18next](https://react.i18next.com).
