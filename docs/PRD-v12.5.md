# AI Launcher Pro — PRD v12.5

> **Versão**: 12.5.0
> **Data**: 2026-04-23
> **Autor**: Helbert Moura | DevManiac's
> **Status**: Aprovado

---

## Resumo

v12.5 é uma evolução focada em **UX, completude funcional e identidade visual**. Não é uma reescrita — é um polimento profundo com novas funcionalidades de instalação/update, reformulação visual e melhorias de histórico.

---

## Estado Atual (v12.0.0)

### O que já funciona
- 7 tabs funcionais (launcher, tools, history, costs, prereqs, admin, help)
- Onboarding com 3 passos
- Atalhos de teclado (Ctrl+1-5, Ctrl+,, ?)
- StatusBar com dados reais
- Terminal animado na Help
- i18n EN + pt-BR (230+ chaves)
- Detecção de updates via `useUpdates()`
- Backend Rust com 33 comandos (install, update, launch, etc.)

### Lacunas identificadas
- Ícones genéricos que não condizem com ferramentas oficiais
- Sem fluxo de instalação/atualização no UI (backend existe!)
- Sem botão "Testar API" no UI (backend existe!)
- Histórico limitado (não reabre sessão, sem descrição, sem duração)
- Tela de boas-vindas sem identidade forte da DevManiacs
- Ícones não aparecem no dark mode
- Ícone do instalador/área de trabalho desatualizado

---

## Eixos de Trabalho

### EIXO 1 — Tela de Boas-vindas (Welcome/Onboarding)

**Objetivo**: Reformular onboarding com branding DevManiacs + tour guiado.

#### FEAT-1.1: Branding DevManiacs
- Tela inicial com logo DevManiacs e descrição do projeto
- Seção "Sobre a DevManiacs" com missão/contato
- Visual premium: gradientes, animações sutis

#### FEAT-1.2: Tour Guiado
- 4 passos: Welcome → DevManiacs → Scan CLIs → Pronto!
- Cada passo com ilustração/ícone relevante
- Progress indicator visual

#### FEAT-1.3: Config "Sempre Mostrar"
- Checkbox "Mostrar ao iniciar" na tela de boas-vindas
- Toggle nas Configurações > Aparência para reativar
- Persistido em localStorage (`ai-launcher:show-onboarding`)

**Arquivos**: `src/features/onboarding/`, `src/i18n/locales/`, `src/features/admin/sections/AppearanceSection.tsx`

---

### EIXO 2 — Updates e Instalação

**Objetivo**: Nova aba "Updates" + botões de instalar/atualizar em todos os cards.

#### FEAT-2.1: Nova Aba "Updates" no Sidebar
- Novo TabId: `"updates"`
- Posição: após "prereqs" no sidebar (Workspace)
- Atalho: `Ctrl+6`
- Conteúdo:
  - Resumo no topo: X updates disponíveis, Y ferramentas faltando
  - Seção "CLIs com update" — lista com botão "Atualizar"
  - Seção "Ferramentas com update" — lista com botão "Atualizar"
  - Seção "Pré-requisitos faltando" — lista com botão "Instalar"
  - Seção "CLIs não instalados" — lista com botão "Instalar"
  - Botão "Atualizar tudo" no header
- Usa dados do `useUpdates()` + `useClis()` + `useTools()` + `usePrerequisites()`

#### FEAT-2.2: Botão "Instalar" nos Cards
- LauncherPage: cards de CLIs não instalados mostram "Instalar"
- ToolsPage: cards de ferramentas não instaladas mostram "Instalar"
- PrereqsPage: cards de pré-reqs faltando mostram "Instalar"
- Fluxo:
  1. Clica "Instalar"
  2. Botão muda para spinner + "Instalando..."
  3. Backend executa `install_cli`/`install_prerequisite`/`install_tool`
  4. Progresso em tempo real via evento `install-progress`
  5. Ao final: card atualiza para "Instalado ✓"

#### FEAT-2.3: Botão "Atualizar" nos Cards
- LauncherPage: badge ⬆ + botão "Atualizar" quando update disponível
- ToolsPage: mesmo padrão
- PrereqsPage: mesmo padrão
- Fluxo: `update_cli` / `update_prerequisite` com progress streaming

#### FEAT-2.4: Progresso de Instalação
- Reutilizar infra existente do `stream_install` (Rust)
- Frontend escuta evento `install-progress`
- Toast/notification com status em tempo real
- Ao finalizar: refresh automático dos dados

**Arquivos**: novo `src/features/updates/`, `src/app/layout/TabId.ts`, `src/app/layout/Sidebar.tsx`, `src/features/launcher/CliCard.tsx`, `src/features/tools/ToolCard.tsx`, `src/features/prereqs/PrereqCard.tsx`, `src/i18n/locales/`

**Backend**: Já existe! (`install_cli`, `update_cli`, `install_prerequisite`, `update_prerequisite`, `install_tool`, `stream_install`)

---

### EIXO 3 — Histórico Avançado

**Objetivo**: Histórico funcional com reabertura de sessão e metadados.

#### FEAT-3.1: Reabrir Sessão
- Cada item do histórico tem botão "Reabrir"
- Clicar reabre o CLI com os mesmos parâmetros (diretório, args, provider)
- Usa `launch_cli` com os dados salvos

#### FEAT-3.2: Lembrar Último Diretório
- Ao lançar CLI, o campo de diretório pré-preenche com o último usado
- Persistido por CLI: `ai-launcher:last-dir:{cliKey}`
- Funciona no LaunchDialog

#### FEAT-3.3: Descrição nas Sessões
- Campo de texto para adicionar nota/descrição a cada sessão
- Editável inline no histórico
- Persistido em localStorage junto com o registro de lançamento

#### FEAT-3.4: Status e Duração
- Cada sessão mostra:
  - Status: em andamento (🟢), finalizada (✓), erro (✗)
  - Duração: calculada a partir do timestamp de início
- Monitoramento via Tauri events

**Arquivos**: `src/features/history/`, `src/features/launcher/LaunchDialog.tsx`, `src/i18n/locales/`

---

### EIXO 4 — Ícones e Visual

**Objetivo**: Ícones condizentes com ferramentas oficiais + dark mode funcionando.

#### FEAT-4.1: Ícones Oficiais dos CLIs
- Buscar SVGs oficiais de cada CLI (Claude, Codex, Gemini, Aider, etc.)
- Mostrar opções no navegador para aprovação visual
- Implementar como componentes SVG inline ou img
- Garantir visibilidade em light e dark mode

#### FEAT-4.2: Ícones Oficiais das Ferramentas
- Buscar SVGs oficiais (VS Code, Cursor, Windsurf, JetBrains, etc.)
- Mesmo processo: opções no navegador → aprovação → implementação

#### FEAT-4.3: Corrigir Dark Mode
- Garantir que TODOS os ícones apareçam corretamente em dark mode
- Usar SVGs com `currentColor` ou versões invertidas
- Testar visualmente em ambos os temas

#### FEAT-4.4: Ícone do App (Instalador + Área de Trabalho)
- Criar 2-3 opções de ícone para o app
- Mostrar no navegador para escolha
- Gerar `.ico` e `.png` em todos os tamanhos necessários
- Atualizar `src-tauri/icons/` e `tauri.conf.json`

**Arquivos**: ícones em `src/features/launcher/`, `src/features/tools/`, `src-tauri/icons/`

---

### EIXO 5 — Funcionalidades

**Objetivo**: Fechar gaps de funcionalidade existente.

#### FEAT-5.1: Botão "Testar API" nos Providers
- Adicionar botão "Testar" no card de cada provider
- Adicionar botão "Testar Conexão" no formulário de edição
- Chama `test_provider_connection` (JÁ EXISTE no backend!)
- Mostra resultado: ✓ Conectado (latência) ou ✗ Erro (mensagem)
- Loading state durante o teste

#### FEAT-5.2: Verificar/Validar Aba Custos
- Confirmar que a aba custos funciona com dados reais
- Adicionar botão de refresh manual
- Mostrar warnings quando arquivos de log não existem
- Melhorar empty state com instruções claras

#### FEAT-5.3: Reformular GitHub Repo
- README.md reformulado com visual premium
- README.pt-BR.md sincronizado
- Badges atualizados
- Screenshots atualizados
- Seções: Features, Instalação, Uso, Stack, Contribuição, Licença

**Arquivos**: `src/features/admin/sections/ProvidersSection.tsx`, `src/features/admin/editors/ProviderEditor.tsx`, `src/features/costs/CostsPage.tsx`, `README.md`, `README.pt-BR.md`

---

### EIXO 6 — Release

**Objetivo**: Buildar, versionar e lançar.

#### FEAT-6.1: Atualizar Changelog
- Adicionar seção v12.5.0 no CHANGELOG.md
- Listar todas as mudanças por categoria

#### FEAT-6.2: Version Bump
- `package.json`: 12.5.0
- `src-tauri/tauri.conf.json`: 12.5.0
- `src-tauri/Cargo.toml`: 12.5.0
- `Cargo.lock`: sync

#### FEAT-6.3: Build Local
- `pnpm tauri build` — gerar MSI + EXE
- Verificar que ambos buildam sem erros

#### FEAT-6.4: GitHub Release
- Criar tag v12.5.0
- Criar release com notas do changelog
- Upload dos assets (MSI, EXE)

---

## Ordem de Implementação

```
Fase 1 — Visual & Ícones
  FEAT-4.1 → FEAT-4.2 → FEAT-4.3 → FEAT-4.4

Fase 2 — Funcionalidades Core
  FEAT-5.1 (Test API) → FEAT-5.2 (Custos) → FEAT-2.1 (Aba Updates) → FEAT-2.2/2.3 (Botões)

Fase 3 — UX Avançada
  FEAT-1.1/1.2/1.3 (Welcome) → FEAT-3.1-3.4 (Histórico)

Fase 4 — Release
  FEAT-5.3 (GitHub) → FEAT-6.1-6.4 (Release)
```

---

## Decision Log

| # | Decisão | Alternativa | Motivo |
|---|---------|-------------|--------|
| 1 | Nova aba "Updates" no sidebar | Seção no Admin | Updates são ação frequente, merecem destaque |
| 2 | Instalar via app (Tauri exec) | Abrir terminal externo | UX mais fluida, progresso em tempo real |
| 3 | Branding DevManiacs + Tour guiado | Tela simples | Primeira impressão forte, onboard completo |
| 4 | Ícones oficiais SVG | Custom unificados | Reconhecimento e profissionalismo |
| 5 | Mostrar opções de ícones no navegador | Escolher diretamente | Decisão visual requer aprovação |
| 6 | Backend já suporta tudo | N/A | Reutilizar infra existente (install_cli, test_provider, etc.) |
| 7 | GitHub repo = README reformulado | Não | Apresentação do projeto no GitHub |

---

## Métricas de Sucesso

- [ ] Todos os ícones visíveis em light e dark mode
- [ ] Fluxo completo: detectar → instalar → usar (CLIs, tools, prereqs)
- [ ] Histórico permite reabrir sessão com mesmos parâmetros
- [ ] Provider "Testar API" funciona com feedback visual
- [ ] Aba Updates funcional com "Atualizar tudo"
- [ ] Onboarding mostra DevManiacs e pode ser reexibido
- [ ] Build MSI + EXE sem erros
- [ ] Release v12.5.0 publicada no GitHub

---

## Non-Goals (Não-escopo)

- Integração com Git (commits, branches)
- Login/autenticação de usuário
- Cloud sync de configurações
- Suporte a macOS/Linux nesta versão
