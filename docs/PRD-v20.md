# PRD v20 - AI Launcher Command OS

Data: 2026-07-07
Status: Proposto
Base: AI Launcher v16.0.1 publicado em `main`
Release alvo: `v20.0.0`

## 1. Sumario executivo

A v20 transforma o AI Launcher de um launcher local para CLIs/IDEs em um sistema operacional de comando para projetos com IA: abrir o contexto certo, preparar ambiente, gerenciar MCP/agents, executar runbooks, acompanhar sessoes e publicar releases com confianca.

Tese de produto:

> Um dev abre um projeto e o AI Launcher entende o contexto, prepara o ambiente, sugere a melhor CLI/provider/runbook, mostra o que esta ativo e permite repetir o fluxo sem reconfigurar tudo.

Estrategia de release:

- Nao publicar v17/v18/v19 como releases grandes separadas.
- Trabalhar em marcos internos `v20-alpha.N` e `v20-beta.N`.
- Publicar uma mega release unica `v20.0.0` quando Command Center, Project Intelligence, Runbooks 2.0, MCP/Agents Hub, Sessions 2.0 e Trust/Release estiverem estaveis.

## 2. Diagnostico apos v16.0.1

### Pontos fortes

- Base local-first ja madura: Tauri 2, React, storage local, historico, workspaces, MCP, runbooks, providers e analytics.
- Fluxo de launch foi consolidado em `launchCliSession`, com precedencia correta de env `project > workspace > provider`.
- Vite/browser QA ganhou fallback para invokes nao criticos, facilitando design check.
- Release hygiene melhorou: assets limpos, body por `docs/releases/<tag>.md`, checksums e `latest.json`.
- CI/release consegue bloquear problemas reais, como asset audit e `cargo audit`.

### Problemas que ainda impedem a "mega atualizacao"

- A home principal ainda e mais uma colecao de paginas do que um command center diario.
- Workspaces existem, mas nao comandam claramente o fluxo de trabalho do usuario.
- `.ailauncher.json` existe, mas ainda nao tem geracao/edicao assistida, deteccao de stack e recomendacoes.
- Runbooks sao uteis, mas ainda parecem recurso auxiliar, nao fluxo central de setup/execucao.
- MCP e agentes ainda nao sao apresentados como um hub de contexto por projeto.
- Sessions/history precisam virar painel operacional: ativos, replay, kill, filtros, duracao e contexto.
- Trust/distribuicao ainda tem pendencias grandes: updater completo, assinatura, canais e backups melhores.

## 3. ICP e jobs to be done

### ICP primario

Dev power-user Windows que trabalha em varios repositorios e alterna entre Claude, Codex, Antigravity, IDEs, MCP servers e provedores. Ele quer iniciar um contexto produtivo em segundos sem lembrar flags, chaves, paths e comandos de setup.

### Personas

- **Dev solo com varios projetos**: quer abrir o repo certo com CLI/provider/runbook certo.
- **Criador de agentes**: quer perfis de agente, MCP e runbooks versionaveis por projeto.
- **Engenheiro de plataforma**: quer padronizar setup e reduzir suporte manual.
- **Usuario Windows avancado**: quer instalador confiavel, update seguro e menos atrito de ambiente.

### Jobs

- Quando abro o app, quero ver o workspace ativo e as proximas acoes mais provaveis.
- Quando entro em um repo novo, quero detectar stack e gerar um perfil `.ailauncher.json`.
- Quando preciso preparar ambiente, quero rodar um runbook confiavel com logs e condicoes.
- Quando uso agentes, quero validar MCP/configs antes de iniciar a sessao.
- Quando uma sessao esta rodando, quero entender status, duracao, processo e custo/contexto.
- Quando uma release sai, quero atualizar com assets corretos e descricao clara.

## 4. Objetivos da v20

1. Fazer a primeira tela virar um **Command Center** util e operacional.
2. Tornar workspaces/projetos o eixo principal do produto.
3. Criar inteligencia local de projeto: deteccao de stack, sugestoes e `.ailauncher.json` assistido.
4. Evoluir runbooks para setup/automacao real com condicoes e presets.
5. Criar um hub de Agents + MCP por projeto.
6. Evoluir sessions/history para observabilidade e replay.
7. Fortalecer trust: backup, updater, release workflow, checks e docs.

## 5. Nao objetivos

- Cloud sync obrigatorio na v20. Se entrar, deve ser opcional e depois de backup/export estar robusto.
- Marketplace remoto completo. A v20 pode ter catalogo/presets locais; marketplace publico fica pos-v20.
- Rodar comandos destrutivos sem preview/confirmacao.
- Guardar ou exportar API keys em claro.
- Trocar stack visual inteira sem necessidade. A v20 deve melhorar a experiencia sobre a base atual.

## 6. Pilares da release

### Pilar A - Command Center

Primeira tela focada no workspace/projeto ativo:

- resumo do workspace ativo;
- status rapido de CLIs, provider, doctor, MCP e runbooks;
- acoes rapidas: Launch, Run setup, Open IDE, Doctor, MCP;
- sessoes ativas/recentes;
- favoritos e templates;
- alerta de pendencias relevantes.

### Pilar B - Project Intelligence

Deteccao local e perfil assistido:

- detectar stack por arquivos: `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `.csproj`, `docker-compose.yml`, etc.;
- sugerir CLI/provider/runbook;
- criar/editar `.ailauncher.json` via UI;
- validar schema e mostrar preview;
- importar/exportar perfis sem secrets.

### Pilar C - Runbooks 2.0

Runbooks como automacao central:

- editor visual com passos;
- presets por stack;
- condicoes simples: arquivo existe, comando existe, env existe, ultimo passo passou/falhou;
- logs por passo;
- retry/timeout configuravel;
- dry-run/preview quando aplicavel;
- "setup completo" por workspace.

### Pilar D - Agents + MCP Hub

Hub de contexto agentico:

- MCP por app: Claude, Codex, Gemini quando aplicavel;
- health check por servidor;
- presets locais de MCP;
- perfis de agente por projeto;
- "prepare agent environment" com check de MCP + runbook + launch;
- backup antes de editar config do usuario.

### Pilar E - Sessions 2.0

Operacao de sessoes:

- painel de sessoes ativas;
- kill/reopen/replay;
- filtros por workspace, CLI, provider, status e data;
- duracao real quando possivel;
- eventos na Inbox;
- vinculo claro entre sessao, runbook e profile.

### Pilar F - Trust, Release e Distribuicao

Confianca operacional:

- backup/export/import mais robusto;
- migracoes versionadas de storage;
- release checklist automatizado;
- updater do app mais claro;
- assinatura/winget/choco como trilha separada se certificado estiver disponivel;
- docs, changelog e release notes geradas do que foi realmente implementado.

## 7. Criterios de sucesso

- O usuario consegue abrir o app, escolher um workspace e iniciar uma sessao correta em menos de 30 segundos.
- Um repo novo gera sugestao de profile e runbook sem configuracao manual pesada.
- Runbooks conseguem preparar pelo menos Node/Tauri/Rust/Python em presets locais.
- MCP Hub valida configs sem vazar secrets e faz backup antes de escrita.
- History permite replay de launch com o mesmo contexto.
- Release v20 contem apenas assets corretos, checksums, latest.json e descricao completa.
- `npx tsc --noEmit`, `npm test`, `npm run build`, `cargo test`, `cargo audit`, `npm run e2e` e `npm run tauri build` passam antes da tag.

## 8. Marcos internos

### v20-alpha.1 - Command Center foundation

- rota/tela Command Center;
- resumo do workspace ativo;
- quick actions reais;
- cards de doctor/MCP/runbooks/sessions;
- sem quebrar tabs existentes.

### v20-alpha.2 - Project Intelligence

- detector de stack;
- profile editor para `.ailauncher.json`;
- sugestoes de CLI/provider/runbook.

### v20-alpha.3 - Runbooks 2.0

- editor melhorado;
- presets;
- condicoes simples;
- logs por passo.

### v20-beta.1 - Agents + MCP Hub

- MCP health por workspace;
- presets locais;
- agent profiles;
- backup e validacao reforcados.

### v20-beta.2 - Sessions 2.0 + Trust

- painel de sessoes ativas;
- replay/kill/filtros;
- backup/export/import;
- updater/release polish.

### v20.0.0 - Mega release

- docs finais;
- changelog;
- release notes;
- build local completo;
- GitHub release.

## 9. Riscos

- Escopo grande demais: mitigar com marcos alpha/beta e validação por fase.
- Runbooks executam comandos: manter preview, sanitizacao, timeout e confirmacao.
- MCP edita config do usuario: backup obrigatorio.
- UI ficar pesada: preservar code splitting e medir bundle.
- Release longa quebrar CI: manter gates verdes por marco, sem empilhar meses de mudanca sem validar.

## 10. Decisoes iniciais

- A v20 sera tratada como uma release publica unica, mas desenvolvida por marcos internos.
- A primeira entrega concreta sera Command Center, porque ela muda a percepcao do app imediatamente e organiza os outros pilares.
- Cloud/marketplace ficam fora do escopo obrigatorio da v20.
- Qualquer fase so avanca apos typecheck/test/build local minimo verde.
