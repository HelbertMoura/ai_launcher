# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.1.0] — 2026-04-20

### 🎨 "Terminal Refinado" — fix MiniMax + refatoração visual completa

Release consolidada: remove **todas** as causas do `Auth conflict` / `Failed to fetch`
do MiniMax (diagnóstico revelou 3 bugs independentes no launcher, não só um),
substitui a paleta `#8B1E2A` vermelho-vinho por tokens `oklch` com accent
esmeralda perceptivamente uniforme, e adiciona a primeira camada responsiva do app.

### Fixed

#### MiniMax `Auth conflict` — causa raiz real (nunca era só envs herdadas)
- **Injeção dupla de chave em `storage.ts:buildLaunchEnv`** — o launcher setava
  `ANTHROPIC_AUTH_TOKEN` E `ANTHROPIC_API_KEY` com o mesmo valor. Claude Code
  detectava os dois e emitia o erro. Agora injeta só `AUTH_TOKEN` (padrão da spec).
- **Defense-in-depth em `launch_cli` (`main.rs:1680`)** — script PowerShell agora
  limpa `ANTHROPIC_*`, `CLAUDE_CODE_*` e `API_TIMEOUT_MS` herdados do shell pai
  **antes** de injetar os novos valores. Recomendação oficial da MiniMax
  ("Clear the following Anthropic-related environment variables to avoid conflicts").

#### MiniMax `Failed to fetch` no teste de conexão
- **`testConnection.ts` era bloqueado por CORS no webview do Tauri** (origin
  `tauri://localhost` contra `api.minimax.io` que não retorna
  `Access-Control-Allow-Origin`). Movido para comando Rust
  `test_provider_connection` (via `ureq`) — backend faz a chamada direta, sem
  política CORS. Mensagens de erro agora são específicas por status (401/403/404/429).

#### Envs oficiais Anthropic-compatible faltando
- `buildLaunchEnv` agora injeta, para qualquer provider ≠ anthropic:
  `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`,
  `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `API_TIMEOUT_MS=3000000`,
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. Sem esses, Claude Code tentava
  resolver aliases que não existem nos endpoints de terceiros.

### Added

- **Botão "🧹 Reset Claude state"** no Admin Panel — comando Rust `reset_claude_state`
  limpa `customApiKeyResponses`, `oauthAccount` e `model` custom do
  `~/.claude.json` (faz backup em `.claude.json.bak` antes). Útil quando o CLI
  fica "travado" em provider antigo.
- **`src/styles/tokens.css`** — fonte única de verdade para cores/spacing/typography/
  radius/motion/shadows. Paleta oklch com accent esmeralda (substitui vermelho-vinho
  `#8B1E2A` que conflitava com verdes de status). Aliases legados mapeados pra
  não quebrar nenhum selector existente.
- **Primeira camada responsiva** — media queries `@max-width:1100px` e `@max-width:720px`
  em `providers.css` (o app tinha ZERO media queries até agora). Grid admin colapsa,
  modais ocupam 95vw, header empilha.
- **Monogramas SVG (`PresetIcon.tsx`)** — 12 ícones vetoriais substituem os emojis
  do `PresetsBar`. Rendering consistente entre Win10/11/Linux/macOS. Backward-compat
  via `LEGACY_EMOJI_MAP` (presets antigos com emoji continuam funcionando).
- **Reduced motion** — `tokens.css` zera durations quando `prefers-reduced-motion:reduce`
  (WCAG 2.3.3).

### Changed

- **Base tipográfica 12px → 13px** (body). Escala completa em tokens
  (`--fs-xs` 11px até `--fs-3xl` 32px). Abolidos valores <11px. Section titles
  recebem `text-transform: uppercase` + `letter-spacing: 0.08em`.
- **Providers.css tokenizado** — todas as cores `#8B1E2A`, `#4285F4`, `#4ade80`,
  `#ffa500`, `#ff8a80`, e `rgba(...)` de brands substituídas por
  `color-mix(in oklch, var(--color-*) X%, transparent)`. Radius consistente
  (`--radius-sm/md/lg/full`), spacing em grade 4px.
- **CommandPalette harmonizado** — mesmos tokens, mesmos radius, mesma accent.
  Hover/selected usam `color-mix` oklch.
- **Selected state do `.preset-emoji`** — borda 2px + bg 20% + accent, em vez do
  fill opaco que destoava dos cards não selecionados.

### Accessibility

- `aria-label` adicionado em botões icon-only: refresh CLIs, theme toggle,
  delete profile, remove env var, fechar preview.
- `role="radiogroup"` + `role="radio"` + `aria-checked` no seletor de ícones de preset.

### Notes

- **Zero breaking.** Perfis salvos em `localStorage` pela v5.0/v5.0.1 continuam
  funcionando identicamente (schema inalterado). Presets com emoji legado
  renderizam via fallback SVG.
- Cargo.lock bump automático 5.0.1 → 5.1.0.
- Plano executável desta release: `docs/PLAN_v5.1.md` (no repo).

---

## [5.0.1] — 2026-04-20

### 🔧 Hotfix: MiniMax provider (URL + model)

O provider MiniMax pré-cadastrado vinha com endpoint e modelo desatualizados,
resultando em falha 100% das tentativas de uso. Corrigido para o formato atual
da documentação oficial.

### Fixed

- **MiniMax baseUrl**: `api.minimaxi.chat/v1/anthropic` ❌ → `api.minimax.io/anthropic` ✅
  (endpoint Anthropic-compatible internacional).
- **MiniMax model**: `MiniMax-M2` ❌ → `MiniMax-M2.7` ✅ em `seeds.ts` (main + fast)
  e `modelCatalog.ts` (primeiro da lista; `MiniMax-M2` mantido como fallback).
- **Nota do seed MiniMax**: agora inclui instrução para trocar p/ `api.minimaxi.com/anthropic`
  em contas chinesas, e link direto para a doc oficial.

### Docs

- README/FAQ: seção sobre regiões (Internacional vs China) do MiniMax.

### Notes

- Nenhuma mudança de API, dados ou schema. Usuários da v5.0.0 podem atualizar
  sem perda de configuração (perfis custom permanecem no `localStorage`).
- Após instalar, entre no **Admin Panel** e, se você tinha um perfil MiniMax
  customizado, atualize manualmente. Os **seeds built-in** já vêm corrigidos.

---

## [5.0.0] — 2026-04-20

### 🎉 Major: Alternative Providers & Launch Presets

Claude Code agora pode ser lançado apontando para providers Anthropic-compatible
alternativos (Z.AI / GLM, MiniMax) com um clique. Opt-in via flag
`VITE_ADMIN_MODE=1` em `.env.local` — sem afetar o fluxo padrão.

### Added

#### Provider system (opt-in, admin mode)
- **Admin Panel** (`⚙️ Admin`) — CRUD completo de perfis Anthropic-compatible
  com teste de conexão, editor de env vars extras, import/export JSON.
- **Seeds pré-cadastrados**: Anthropic (oficial), Z.AI (`glm-5.1` / `glm-4.7`),
  MiniMax (`MiniMax-M2`).
- **Provider Selector** na aba Lançar — dropdown + aviso de context cap quando
  o provider ativo tem janela menor que Anthropic.
- **Provider Badge** no header mostrando provider ativo + modelo principal.
- **Override de modelo por launch** — sobrescreve main/fast só pra próxima
  execução sem editar perfil.
- **Test de conexão** com `max_tokens:1` (zero custo) + latência + eco do modelo.
- **Env vars custom por perfil** — campos livres adicionados às envs do launch.
- **Autocomplete de modelos por kind** (`<datalist>`): glm-\*, MiniMax-\*,
  claude-\*.
- **Estimador de custo** por sessão típica + comparativo vs. Anthropic.
- **Budget diário** por perfil com alerta quando gasto do dia ultrapassa.
- **Docs link** por perfil abre documentação oficial do provider.

#### Launch presets
- **Presets bar** na aba Lançar — salva combinação atual (CLI + provider +
  diretório + args + noPerms) como chip clicável.
- **Atalhos Ctrl+1..9** para disparar presets diretamente.
- Renomear, excluir e reordenar presets inline.

#### Quick-switch
- **Ctrl+P** abre modal de busca de provider (setas + Enter para ativar).
- **Submenu "Provider Claude" no tray** com radio pros 3 built-ins
  (Anthropic / Z.AI / MiniMax).

#### Preview & observabilidade
- **🔬 Preview button** no Lançar — mostra CMD + envs (redacted) + copia
  script `.bat` equivalente.
- **Histórico enriquecido** — cada launch grava o provider usado (`via Z.AI ·
  glm-5.1`).
- **Cost Aggregator provider-aware** — reestima custos usando preços do Admin
  quando o modelo não é reconhecido pela tabela padrão.

#### Backend (Rust)
- `open_external_url` command com validação http(s) only.
- Submenu `Provider Claude` no tray + evento `tray-set-provider`.

### Privacy & security
- Admin mode é 100% opt-in (`VITE_ADMIN_MODE=1` em `.env.local` ignorado pelo
  git). Sem a flag, o app se comporta como na v4.
- Chaves API ficam no `localStorage` (plain text, escopo local) e são
  redacted em todos os toasts/logs da UI.
- `.env.local`, `.env.*` (exceto `.env.example`) permanecem no `.gitignore`.

### Notes
- **Não quebra nada da v4**: usuários sem admin mode continuam com o app
  exatamente como antes.
- Changelog v4.1.0 preservado abaixo.

---

## [4.1.0] — 2026-04-17

First public release.

### Added

- Unified launcher window for AI coding CLIs: Claude Code, Codex, Gemini, Qwen,
  Kilo Code, OpenCode, Crush, and Droid.
- Unified launcher for developer IDE tools: VS Code, Cursor, Windsurf, AntGravity,
  Claude Desktop, Codex Desktop.
- Environment wizard that detects which CLIs and tools are already installed on
  first run.
- Silent install flow with live progress output in the UI (no flashing terminal
  windows during `npm install -g` / `pip install`).
- Update checker with three sections: CLIs, prerequisites (Node, Python, Git,
  Rust), and IDEs.
- Per-CLI permission flag toggle (e.g. `--dangerously-skip-permissions`,
  `--yolo`).
- Execution history with deduplication.
- Command palette (Ctrl+K) for quick CLI launch.
- Cost aggregator for reading local Claude Code token usage.
- Orchestrator tab for running multiple CLIs side-by-side against the same
  working directory.
- Onboarding flow shown on first launch.
- Dark and light themes; brand color #8B1E2A.
- Global shortcut registration (Ctrl+L focus directory, Ctrl+K launch).
- Windows launch strategy with cascading fallback: Windows Terminal → PowerShell
  7 (pwsh) → cmd.
- Code signing helpers for self-signed certificates (`scripts/gen-cert.ps1`,
  `scripts/sign-build.ps1`).
