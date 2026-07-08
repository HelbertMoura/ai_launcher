# v20 "Command OS" Implementation Plan

> Objetivo: construir a mega release v20.0.0 em marcos internos alpha/beta, mantendo build e testes verdes a cada fase.

## Estado inicial

- Base: v16.0.1 publicado.
- Branch recomendada: `codex/v20-command-os` ou `feat/v20-command-os` quando formos commitar trabalho de produto.
- Primeira fase executavel: `v20-alpha.1 - Command Center foundation`.

## Validacao padrao por fase

Minimo por tarefa frontend:

- `npx tsc --noEmit`
- `npm test`
- `npm run build`

Minimo por tarefa backend:

- `cargo fmt --check`
- `cargo clippy --no-deps -- -D warnings`
- `cargo test`
- `cargo audit`

Antes de alpha/beta/release:

- tudo acima;
- `npm run e2e`;
- `npm run tauri build`.

## Fase A - v20-alpha.1 Command Center foundation

### A1 - Criar rota/pagina Command Center

Arquivos:

- Criar `src/features/command-center/CommandCenterPage.tsx`
- Criar `src/features/command-center/CommandCenterPage.css`
- Criar `src/features/command-center/commandCenterModel.ts`
- Criar `src/features/command-center/commandCenterModel.test.ts`
- Editar `src/app/App.tsx`
- Editar `src/domain/tabs.ts` ou arquivo equivalente de tabs
- Editar `src/i18n/locales/pt-BR.ts`
- Editar `src/i18n/locales/en.ts`

Passos:

- [x] Adicionar tab `command-center` com label i18n.
- [x] Criar page shell sem depender de backend novo.
- [x] Criar model puro para summary/quick actions.
- [x] Testar model com vitest.
- [x] Garantir lazy loading igual as paginas v16.

Aceite:

- App abre direto no Command Center quando onboarding ja terminou.
- Sidebar/TopBar navegam sem quebrar abas antigas.
- Estados vazios tem acoes reais.

### A2 - Workspace summary e quick actions reais

Arquivos provaveis:

- `CommandCenterPage.tsx`
- `commandCenterModel.ts`
- `workspaceStore.ts`
- `launchSession.ts`

Passos:

- [x] Mostrar workspace ativo e path.
- [x] Mostrar CLI/provider default quando houver.
- [x] Acoes: Launch, Doctor, Runbooks, MCP, Open IDE quando dados existirem.
- [x] Quick Launch usa `launchCliSession`.
- [x] Toasts para sucesso/erro.

Aceite:

- Nenhuma chamada direta nova a `launch_cli`.
- Sem erro no Vite/browser por invoke de boot.

### A3 - Readiness cards

Cards:

- CLIs instaladas/prontas;
- Doctor status;
- MCP health;
- Runbook status;
- Project profile status.

Passos:

- [x] Consolidar dados em view-model.
- [x] Mostrar skeleton/loading sem layout shift.
- [x] Empty/error states claros.

Aceite:

- Informacao util mesmo sem workspace configurado.
- Sem cards aninhados.

### A4 - Active/recent sessions

Passos:

- [x] Consumir historico/sessoes existentes.
- [x] Mostrar status, CLI, directory, duration.
- [x] Acoes: replay, abrir history, matar sessao quando ativa e suportado.
- [x] Replay usa `launchCliSession`.

Aceite:

- Sessoes detached/running/completed aparecem sem quebrar UI.
- Kill exige confirmacao quando aplicavel.

## Fase B - v20-alpha.2 Project Intelligence

### B1 - Stack detector puro

Arquivos:

- Criar `src/features/project-intelligence/stackDetector.ts`
- Criar `src/features/project-intelligence/stackDetector.test.ts`

Passos:

- [x] Detectar Node/React/Vite/Tauri/Rust/Python/Go/Docker.
- [x] Retornar evidencias e confidence.
- [x] Sugerir CLIs/runbooks.

### B2 - Backend scan seguro

Arquivos:

- `src-tauri/src/commands/*`
- `src-tauri/src/main.rs`
- frontend hook de scan

Passos:

- [x] Ler apenas arquivos conhecidos.
- [x] Cap de tamanho por arquivo.
- [x] Nao ler `.env`.
- [x] Validar directory com util existente.

### B3 - Profile editor `.ailauncher.json`

Passos:

- [x] UI para criar/editar profile.
- [x] Validacao schema.
- [x] Preview JSON antes de salvar.
- [x] Salvar com confirmacao.

## Fase C - v20-alpha.3 Runbooks 2.0

### C1 - Presets locais

- [x] Node/Vite setup.
- [x] Tauri/Rust setup.
- [x] Python setup.
- [x] MCP sanity check.

### C2 - Condicoes simples

- [x] `fileExists`
- [x] `commandExists`
- [x] `envExists`
- [x] previous step status

### C3 - Logs por execucao

- [x] Persistir run id, step id, status, output capado, duration.
- [x] Mostrar timeline no runner.

## Fase D - v20-beta.1 Agents + MCP Hub

### D1 - MCP por projeto

- [x] Relacionar workspace/profile com MCP servers.
- [x] Health check resumido no Command Center.

### D2 - Presets MCP locais

- [x] Catalogo local.
- [x] Validacao antes de aplicar.
- [x] Backup obrigatorio.

### D3 - Agent profiles

- [x] Modelo local.
- [x] UI CRUD.
- [x] Launch preparado por profile.

## Fase E - v20-beta.2 Sessions 2.0 + Trust

### E1 - Sessions dashboard

- [x] Filtros persistidos.
- [x] Replay.
- [x] Kill com confirmacao.
- [x] Vinculo com workspace/profile.

### E2 - Backup/export/import robusto

- [x] Manifest de backup.
- [x] Redacao de secrets.
- [x] Restore/import com preview.

### E3 - Updater/release polish

- [x] Validar `latest.json`.
- [x] Melhorar UI de update do app.
- [x] Checklist release v20.

## Fase F - v20.0.0 Release

### F1 - Bump e changelog

- [x] Bump package/Cargo/Tauri para `20.0.0`.
- [x] CHANGELOG do que foi realmente implementado.
- [x] `docs/releases/v20.0.0.md`.

### F2 - Docs publicas

- [x] README/README.pt-BR.
- [x] Screenshots novas.
- [x] Guia de Command Center/Runbooks/MCP.

### F3 - Build e release

- [x] Validacao completa local.
- [ ] Tag `v20.0.0`.
- [ ] GitHub release com assets corretos.
- [ ] Conferir Actions e assets.

## Backlog pos-v20

- Cloud sync opcional.
- Marketplace de presets remoto.
- Assinatura Windows se certificado estiver disponivel.
- Winget/Chocolatey publicos.

## Regra de ouro

Cada marco precisa deixar o app melhor e shippable. A v20 pode ser grande, mas nao pode virar uma pilha invisivel de mudancas sem build verde.
