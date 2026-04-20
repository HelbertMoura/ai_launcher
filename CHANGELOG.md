# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
