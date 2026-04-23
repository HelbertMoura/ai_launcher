# AI Launcher Pro — PRD v12.0

> **Versão**: 12.0.0 | **Data**: 2025-04-23
> **Autor**: Helbert Moura · DevManiac's
> **Status**: Aprovado para implementação

---

## 1. Visão Geral

AI Launcher Pro v12.0 é a *evolution release* que fecha os gaps da v11 e adiciona funcionalidades significativas: keyboard shortcuts funcionais, StatusBar com dados reais, verificação de pré-requisitos e check de updates automático + manual.

### Métricas de Sucesso

| Métrica | Alvo |
|---------|------|
| Shortcuts funcionais | 6/6 (Ctrl+1-4, Ctrl+,, ?) |
| StatusBar dados reais | online/total conectado ao store |
| Pré-requisitos cobertos | node, npm, bun, python, rust, cargo |
| Updates detectados | Todas as CLIs e tools versionadas |
| README score | Visual profissional, badges, EN + pt-BR |

---

## 2. Mudanças por Prioridade

### P0 — Bugs (deve corrigir antes de features)

#### BUG-1: Keyboard Shortcuts não funcionam
- **Arquivo**: `src/app/App.tsx`
- **Problema**: Shortcuts Ctrl+1-4, Ctrl+,, ? estão documentados na UI mas não têm event listeners
- **Solução**: Adicionar `useEffect` com `keydown` listener global no App.tsx
- **Mapeamento**:
  - `Ctrl+1` / `Cmd+1` → Tab launcher
  - `Ctrl+2` / `Cmd+2` → Tab tools
  - `Ctrl+3` / `Cmd+3` → Tab history
  - `Ctrl+4` / `Cmd+4` → Tab costs
  - `Ctrl+,` / `Cmd+,` → Tab admin
  - `?` → Tab help
- **Edge cases**: Não ativar dentro de inputs/textareas. Respeitar modifier keys.

#### BUG-2: StatusBar desconectada
- **Arquivo**: `src/app/App.tsx`
- **Problema**: `online={0} total={0}` hardcoded, `todaySpend="$0.00"` hardcoded
- **Solução**: Consumir dados de `clisStore` (online/total) e `useUsage` (spend)

#### BUG-3: Chave i18n faltando
- **Arquivo**: `src/i18n/locales/pt-BR.ts`
- **Problema**: `nav.launcher = "Launch"` (inglês)
- **Solução**: Alterar para `"Lançar"`

#### BUG-4: Cores hardcoded no TopBar
- **Arquivo**: `src/app/layout/TopBar.css`
- **Problema**: Accent buttons usam hex direto (#ff3131, etc.)
- **Solução**: Migrar para CSS variables do token system

---

### P1 — Features Novas

#### FEAT-1: Verificação de Pré-requisitos (Tela Dedicada)

**Descrição**: Nova tela que verifica se ferramentas essenciais estão instaladas no sistema, mostra versões e oferece orientação de instalação.

**Localização**: Novo tab na sidebar — `prereqs` (entre Costs e Admin)

**Ferramentas verificadas**:
- Node.js (`node --version`)
- npm (`npm --version`)
- Bun (`bun --version`)
- Python (`python --version` / `python3 --version`)
- Rust (`rustc --version`)
- Cargo (`cargo --version`)
- Git (`git --version`)

**UI**:
- Grid de cards, um por ferramenta
- Cada card mostra: nome, ícone, status (✓ instalado / ✗ ausente), versão
- Se ausente: mostrar comando de instalação (copy-paste friendly)
- Botão "Reverificar" no topo

**Implementação**:
- Tauri command: `check_prerequisites()` em Rust
- Retorna `{ name: string, installed: boolean, version: string | null }[]`
- Hook: `usePrerequisites.ts`
- Store: cache em sessionStorage TTL 30 min
- Página: `src/features/prereqs/PrereqsPage.tsx`

**i18n**: Adicionar seção `prereqs` em ambos locales

#### FEAT-2: Check de Updates (Automático + Manual)

**Descrição**: Verificar se há versões mais recentes das CLIs e ferramentas instaladas.

**Comportamento**:
- **Automático**: Ao abrir o app, background check com debounce 30s
- **Manual**: Botão "Check Updates" no TopBar ou StatusBar
- **Badge**: Mostrar dot/badge nos cards quando update disponível

**Implementação**:
- Tauri command: `check_cli_update(cli_key: string)` em Rust
- Para cada CLI: compara versão local vs latest (npm view, pip show, etc.)
- Hook: `useUpdates.ts` com polling state
- Store: cache em sessionStorage TTL 1 hora
- UI: Badge "⬆ update" nos CliCard/ToolCard
- StatusBar: indicador "X updates" quando houver

**Edge cases**:
- CLI sem versionamento detectável → skip silencioso
- Sem internet → não mostrar erro, só não checar
- Rate limiting → debounce entre checks

#### FEAT-3: StatusBar Rica

**Melhorias na StatusBar existente**:
- `online/total` → dados reais do `clisStore`
- `todaySpend` → dados reais do `useUsage`
- **Novo**: Horário atual (atualiza a cada minuto)
- **Novo**: "DevManiac's" branding (lado esquerdo, muted)
- **Novo**: Indicador de updates disponíveis (se FEAT-2 detectar updates)
- **Novo**: Botão "Reverificar tudo" (ícone refresh)

---

### P2 — UX / Documentação

#### FEAT-4: Terminal Fake no Help

**Descrição**: Substituir/melhorar o terminal animado atual para mostrar o AI Launcher Pro sendo usado de forma realista.

**Animação**:
```
$ ai-launcher --scan
▸ Scanning system for AI CLIs...
  ✓ Claude Code v4.7.0        [installed]
  ✓ Gemini CLI v1.2.0         [installed]
  ✓ Codex CLI v1.0.0          [installed]
  ✗ Aider                     [not found]
  ✓ Qwen CLI v0.9.0           [installed]

5 CLIs detected | 4 online | 1 missing

$ ai-launcher --launch claude --dir ~/project
▸ Launching Claude Code...
▸ Working directory: ~/project
▸ Provider: anthropic (default)
✓ Claude Code ready.

$ ai-launcher --costs --today
Today's spend: $3.42
  Claude Code   $2.10  (12 sessions)
  Gemini CLI    $0.92  (5 sessions)
  Codex CLI     $0.40  (3 sessions)
```

**Implementação**: CSS animation com timed steps, blinking cursor, auto-scroll

#### FEAT-5: README Profissional (EN + pt-BR)

**Estrutura**:
1. **Hero section**: Logo ASCII + tagline + badges
2. **Badges**: version, license, platform, React, Tauri
3. **Screenshot/GIF**: Placeholder para demo visual
4. **Features grid**: Ícones + descrição das 7 superfícies
5. **Quick Start**: Install (MSI + source)
6. **Keyboard Shortcuts**: Tabela visual
7. **Customization**: Theme, accent, fonts, providers
8. **Tech Stack**: Tauri + React 19 + TypeScript + Rust
9. **Contributing**: Guidelines
10. **License**: MIT
11. **Credits**: DevManiac's

**Descrição do repositório GitHub**:
```
🚀 AI Launcher Pro — The unified command deck for AI coding tools
Manage, launch, and monitor all your AI CLIs from one sleek desktop app
Built with Tauri v2 + React 19 | [v12.0.0] [MIT] [Windows/macOS/Linux]
```

---

## 3. Arquitetura

### Novos Arquivos

```
src/
├── features/
│   └── prereqs/                    # FEAT-1
│       ├── PrereqsPage.tsx
│       ├── PrereqsPage.css
│       ├── PrereqCard.tsx
│       ├── usePrerequisites.ts
│       └── prereqsStore.ts
├── hooks/
│   └── useUpdates.ts              # FEAT-2
├── app/
│   └── layout/
│       └── TabId.ts               # Atualizar: adicionar "prereqs"
src-tauri/
└── src/
    └── commands/
        └── prereqs.rs             # Tauri commands
        └── updates.rs             # Tauri commands
```

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/app/App.tsx` | Shortcuts listener + StatusBar props reais + tab prereqs |
| `src/app/layout/TopBar.css` | Migrar accent colors para tokens |
| `src/app/layout/StatusBar.tsx` | Horário, DevManiac's, updates, refresh |
| `src/app/layout/StatusBar.css` | Novos elementos visuais |
| `src/app/layout/Sidebar.tsx` | Tab prereqs |
| `src/app/layout/TabId.ts` | Adicionar "prereqs" |
| `src/i18n/locales/pt-BR.ts` | Fix nav.launcher + seção prereqs |
| `src/i18n/locales/en.ts` | Seção prereqs |
| `src/features/help/AnimatedTerminal.tsx` | Nova animação do Launcher |
| `src/features/launcher/CliCard.tsx` | Badge de update |
| `src/features/tools/ToolCard.tsx` | Badge de update |
| `README.md` | Reformulação completa EN |
| `README.pt-BR.md` | Reformulação completa pt-BR |
| `CHANGELOG.md` | Entrada v12 |
| `package.json` | Bump 12.0.0 |
| `src-tauri/tauri.conf.json` | Bump 12.0.0 |
| `src-tauri/Cargo.toml` | Bump 12.0.0 |

---

## 4. Plano de Implementação (Sprints)

### Sprint 1: Bugs (P0)
1. BUG-1: Keyboard shortcuts no App.tsx
2. BUG-2: StatusBar conectada
3. BUG-3: i18n fix
4. BUG-4: TopBar accent tokens

### Sprint 2: Pré-requisitos (P1)
5. Tauri commands: `check_prerequisites`
6. prereqsStore + usePrerequisites hook
7. PrereqsPage + PrereqCard
8. Tab prereqs no Sidebar + TabId
9. i18n prereqs (EN + pt-BR)

### Sprint 3: Updates (P1)
10. Tauri commands: `check_cli_update`
11. useUpdates hook
12. Badge nos CliCard/ToolCard
13. Updates indicator na StatusBar

### Sprint 4: UX + Docs (P2)
14. StatusBar enriquecida (horário, DevManiac's, refresh)
15. Terminal fake melhorado no Help
16. README EN reformulado
17. README pt-BR reformulado
18. GitHub description
19. Version bump + CHANGELOG

---

## 5. Decision Log

| # | Decisão | Alternativas | Motivo |
|---|---------|-------------|--------|
| D1 | Prereqs como tab dedicado | Dentro do Admin, Modal | Usuário pediu tela própria; mais visibilidade |
| D2 | Updates automático + manual | Só manual, Só automático | Usuário pediu ambos; automático em background não incomoda |
| D3 | Terminal fake (CSS animação) | Terminal real (Tauri) | Fake é suficiente para demo; real precisaria de sandbox |
| D4 | README moderno com badges | Clássico limpo, Startup | Usuário escolheu visual rico |
| D5 | Versão 12.0.0 (pula 11.5) | v11.5 incremental | Escopo de features justifica major bump |
| D6 | Cache prereqs: 30 min TTL | 10 min, 1 hora | Ferramentas mudam raramente; 30 min é equilibrado |
| D7 | Cache updates: 1 hora TTL | 30 min, 4 horas | Updates não são urgentes; 1 hora evita rate limit |

---

## 6. Não-Goals (v13+)

- Tutorial interativo
- Vídeo tutorial
- Animações e transições complexas
- Sistema de plugins
- Sync na nuvem
- Extensões de IDE
- Suporte a mais idiomas (es, fr, etc.)
