# v20 "Command OS" - Design Spec

**Data:** 2026-07-07
**Base:** v16.0.1
**Release alvo:** v20.0.0

## Direcao de produto

AI Launcher v20 deve parecer menos uma lista de ferramentas e mais uma cabine operacional por projeto. O usuario abre o app e entende:

- em qual workspace/projeto esta;
- quais CLIs, providers e MCPs estao prontos;
- qual acao faz sentido agora;
- quais sessoes estao ativas/recentes;
- que setup/runbook pode preparar o ambiente.

## Arquitetura de informacao

### Navegacao

Manter as abas atuais para preservar memoria muscular, mas promover Command Center como primeira experiencia.

Proposta:

- `command-center` ou reaproveitar `workspace` como primeira tela enriquecida.
- `launcher` continua existindo para grid completo de CLIs.
- `workspace` pode virar area de gerenciamento se Command Center for rota propria.

Decisao recomendada: criar `command-center` como nova pagina e manter `workspace` para CRUD/configuracao. Isso evita sobrecarregar `WorkspacePage.tsx`, que ja esta grande.

### Dados consumidos pelo Command Center

Sem backend novo no primeiro alpha:

- workspaces: `workspaceStore`;
- CLIs/checks: `useClis`;
- usage/budget: `useUsage`;
- runbooks: store atual de runbooks;
- sessions/history: stores existentes;
- MCP: comandos/stores existentes;
- project profile: `readProjectProfile` + `.ailauncher.json`.

### Novo modulo recomendado

`src/features/command-center/`

- `CommandCenterPage.tsx`
- `CommandCenterPage.css`
- `commandCenterModel.ts`
- `commandCenterModel.test.ts`

`commandCenterModel.ts` deve ser puro e montar view-models:

- `workspaceSummary`
- `quickActions`
- `readinessCards`
- `recentSessions`
- `recommendedNextStep`

## UX da primeira tela

Layout denso e operacional, sem hero marketing.

Topo:

- nome do workspace/projeto ativo;
- path curto;
- badges: CLI padrao, provider, doctor status, MCP status;
- acoes primarias iconicas: Launch, Run setup, Open IDE, Doctor.

Miolo:

- coluna esquerda: "Next actions" e quick launches;
- coluna central: readiness/status cards;
- coluna direita: active/recent sessions + inbox highlights.

Rodape:

- runbooks favoritos;
- project profile status;
- ultimo backup/export.

## Regras visuais

- Usar cards apenas para itens repetidos ou painéis de ferramenta, nao criar card dentro de card.
- Manter densidade de app operacional, nao landing page.
- Icon buttons com lucide/icone existente quando possivel.
- Textos compactos e scannable.
- Todos os estados vazios devem ter acoes reais.
- Nada de gradientes/orbs decorativos.

## Project Intelligence

### Detector de stack

Criar modulo puro:

`src/features/project-intelligence/stackDetector.ts`

Entrada:

- lista de arquivos do diretorio;
- opcionalmente conteudo de manifestos principais.

Saida:

```ts
type DetectedStack = {
  id: string;
  label: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  recommendedClis: string[];
  recommendedRunbooks: string[];
};
```

Backend Tauri pode expor depois um comando seguro:

`scan_project_stack(directory: String) -> Result<ProjectStackScan, String>`

Limites:

- nao recursar o repo inteiro no primeiro alpha;
- ler apenas arquivos conhecidos e pequenos;
- nunca ler `.env` nem secrets.

### `.ailauncher.json` editor

UI deve permitir:

- visualizar profile detectado;
- criar profile;
- editar CLI/provider/directory/env/runbook/MCP refs;
- validar schema antes de salvar;
- mostrar diff/preview;
- salvar com confirmacao.

## Runbooks 2.0

Manter o executor atual seguro e evoluir modelo.

Campos novos possiveis:

```ts
type RunbookStepCondition =
  | { type: "fileExists"; path: string }
  | { type: "commandExists"; command: string }
  | { type: "envExists"; key: string }
  | { type: "previousSucceeded" }
  | { type: "previousFailed" };
```

Primeiro alpha de runbooks:

- presets locais;
- logs persistidos por execucao;
- condicoes simples apenas no frontend ou backend com validacao forte;
- sem shell livre perigoso fora do `SafeCommandPreview`.

## Agents + MCP Hub

Evoluir a pagina MCP para contexto por projeto.

Cards esperados:

- Claude MCP config;
- Codex MCP config;
- Gemini MCP config, se aplicavel;
- health check;
- backup status;
- presets locais.

Agent profile local:

```ts
type AgentProfile = {
  id: string;
  name: string;
  cli: string;
  provider?: string;
  mcpServers: string[];
  runbookId?: string;
  defaultDirectory?: string;
};
```

## Sessions 2.0

Base ja existe no backend para `list_active_sessions` e `kill_session`.

Melhorias:

- painel ativo no Command Center;
- replay via `launchCliSession`;
- filtros salvos;
- vinculo com workspace/profile;
- eventos de termino na Inbox.

## Trust e Release

### Storage e backup

Antes de alterar configs externas:

- criar backup datado;
- mostrar caminho do backup;
- permitir restore manual.

### Release

Antes da tag v20:

- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `cargo fmt --check`
- `cargo clippy --no-deps -- -D warnings`
- `cargo test`
- `cargo audit`
- `npm run e2e`
- `npm run tauri build`
- smoke test do exe com instancia antiga fechada.

## Ordem tecnica recomendada

1. Command Center page + view-model puro.
2. Integrar workspace/CLI/session/runbook summaries.
3. Project stack detector puro + testes.
4. Backend scan seguro.
5. Profile editor.
6. Runbook presets/conditions/logs.
7. MCP Hub por projeto.
8. Sessions replay/filters.
9. Trust/release polish.

## Guardrails

- Nao criar chamada direta nova a `launch_cli` na UI; usar `launchCliSession`.
- Nao exportar secrets.
- Nao editar MCP/config externa sem backup.
- Nao adicionar dependencias sem necessidade clara.
- Nao promover feature para proximo marco sem validacao local verde.
