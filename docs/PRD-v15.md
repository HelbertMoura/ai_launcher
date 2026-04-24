# PRD v15 - AI Launcher Pro: AI Ops Command Center

Data: 2026-04-24
Status: Proposto
Base analisada: AI Launcher v14.0.0, branch `main`, repositorio publico `HelbertMoura/ai_launcher`

## 1. Sumario executivo

O AI Launcher ja tem uma base forte: produto local-first, visual proprio, stack moderna com Tauri 2 + React 19, bom historico de documentacao e um escopo claro para desenvolvedores que alternam entre CLIs, IDEs e provedores de IA. A v15 transforma o launcher em um centro operacional completo e confiavel para agentes e ferramentas de IA.

Tese de produto:

> Detectar ambiente, instalar ou reparar dependencias, configurar provedores, lancar sessoes de trabalho, acompanhar historico/status/custos e manter tudo atualizado com baixo atrito.

A v15.0 entrega tudo em uma unica release: confiabilidade, consolidacao de dominio, features novas, UI renovada e distribuicao melhorada.

## 2. Evidencias da auditoria

Validacoes locais executadas:

- `npx tsc --noEmit`: passou.
- `npm test`: passou, 34 testes em 6 arquivos.
- `npm run build`: passou, bundle principal JS ~422 KB.
- `cargo fmt --check`: passou.
- `cargo test`: bloqueado por ambiente Windows sem `link.exe` disponivel.
- `cargo clippy --no-deps -- -D warnings`: bloqueado pelo mesmo problema de linker.
- `npm run e2e`: falhou porque o Playwright nao conseguiu resolver/subir `localhost:5173` (`getaddrinfo EAI_FAIL localhost`).

Fontes e artefatos analisados:

- Frontend: `src/app`, `src/features`, `src/providers`, `src/presets`, `src/theme`, `src/lib`.
- Backend: `src-tauri/src/main.rs`, `src-tauri/src/commands`, `src-tauri/src/util.rs`, capabilities e configuracao Tauri.
- Testes: `src/**/*.test.ts`, `e2e/launcher.spec.ts`, `playwright.config.ts`.
- Docs: `README.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/VISUAL_SYSTEM.md`, roadmap v14 em `docs/superpowers`.
- GitHub: pagina publica do repositorio e pagina de releases.

## 3. Diagnostico do produto

### Pontos fortes

- Nicho claro: launcher local para CLIs, IDEs, providers e setups de IA.
- Boa arquitetura de base: Tauri commands separados, frontend por features, testes unitarios uteis.
- Identidade visual diferenciada: direcao "Command Deck" funciona bem para ferramenta de dev.
- Local-first: historico, providers e configuracoes ficam no dispositivo.
- Documentacao extensa: README, arquitetura, retrospectivas, screenshots e guias de release.
- CI/release ja existem e indicam maturidade operacional acima da media para um projeto desktop.

### Riscos principais

- Fluxo de updates tem bug funcional de chave vs nome exibido, afetando update de CLIs, tools e prerequisitos.
- Existem dois modelos paralelos de presets/templates, criando UX fragmentada e codigo duplicado.
- Ferramentas customizadas existem parcialmente, mas nao aparecem como cidadaas de primeira classe.
- Historico mostra sessoes como "running" sem lifecycle real de processo.
- Providers e chaves sensiveis ainda dependem de `localStorage` e variaveis `VITE_*`.
- E2E falha localmente por resolucao de `localhost`; testes Rust bloqueiam por setup MSVC.
- Docs e screenshots estao parcialmente defasados em relacao ao v14.
- Release mais recente no GitHub exibe muitos assets historicos antigos, o que confunde usuarios.

## 4. Usuarios e problemas

### ICP primario

Desenvolvedor power-user que usa varias CLIs de IA, editores e provedores, trabalha em multiplos repositorios e precisa iniciar contextos rapidamente sem reconfigurar terminal, diretorio, ferramenta e variaveis.

### Personas

- **Dev solo**: quer abrir Claude/Codex/Gemini no repo certo com provider certo em segundos.
- **Engenheiro de plataforma**: quer padronizar toolchain e reduzir setup manual da equipe.
- **Criador de agentes**: quer templates, historico, execucoes reproduziveis e observabilidade basica.
- **Usuario Windows avancado**: quer instalador confiavel, updater, assinatura e menos alertas SmartScreen.

### Jobs to be done

- Quando abro um projeto, quero iniciar a CLI/IDE certa no diretorio certo para comecar sem setup manual.
- Quando meu ambiente esta quebrado, quero que o app detecte o problema e proponha reparo seguro.
- Quando uso varios providers, quero testar conexao, trocar chaves e entender risco/custo.
- Quando executo sessoes, quero ver status real, historico, favoritos e reabrir contexto.
- Quando sai uma versao nova, quero atualizar app e ferramentas sem baixar assets errados.

## 5. Objetivos v15

### Guardrails de qualidade

- Nenhuma chave de API deve ser exportada ou logada em claro.
- Nenhum comando destrutivo deve rodar sem preview e confirmacao explicita.
- Release publica nao deve conter assets historicos ou ambiguos.
- Build, testes unitarios, typecheck e E2E devem passar antes de empacotar.
- Presets/templates existentes devem ser migrados sem perda de dados.

### Criterios de sucesso

- Tempo medio ate primeira sessao iniciada reduz significativamente vs v14.
- Taxa de update/install bem-sucedido por ferramenta acima de 95%.
- Nenhum usuario reporta perda de presets/templates apos upgrade.
- Release v15.0 no GitHub contem apenas assets da versao correta.
- E2E roda verde localmente e em CI.

## 6. Escopo consolidado

### Pilar 1 - Confiabilidade

1. Corrigir mapping de updates (key vs name exibido).
2. Corrigir E2E (`localhost` -> `127.0.0.1`).
3. Consolidar tokens CSS e corrigir indefinidos.
4. Atualizar docs e screenshots para v15.
5. Limpar release assets e criar gate automatizado.

### Pilar 2 - Consolidacao de dominio

1. Unificar presets e session templates em `LaunchProfile`.
2. Integrar custom CLIs e IDEs como cidadaos de primeira classe.
3. Criar lifecycle real de sessoes (`starting`/`running`/`completed`/`failed`/`unknown`).
4. Criar provider adapter matrix com protocolos por endpoint.

### Pilar 3 - Produto novo

1. **Workspace Profiles**: grupos por repo/time/contexto.
2. **Agent Runbooks**: sequencias de passos para preparar ambiente e iniciar agentes.
3. **Provider Budget Guard**: limites locais de custo/uso por provider.
4. **Environment Doctor**: diagnostico e reparo de Node, Git, Rust, Python, Bun, CLIs e IDEs.
5. **Safe Command Preview**: preview, dry-run e explicacao antes de comandos customizados.
6. **Self-updater do app**: update do AI Launcher, separado de update das ferramentas.

### Pilar 4 - UI/UX

1. **Command Deck 2.0**: hierarquia mais clara, light theme com profundidade, density toggle, icones consistentes no lugar de emojis.
2. **Sistema de dialogos**: substituir `alert`/`confirm`/`prompt` nativos por componentes proprios.
3. **Acessibilidade**: labels, estados de foco, auditoria com Playwright + axe.

### Pilar 5 - Distribuicao

1. Assinatura Windows para reduzir SmartScreen.
2. Publicacao em Winget e Chocolatey.
3. `latest.json` ou canal equivalente para updater.
4. Release notes geradas com changelog limpo e checklist de assets.

## 7. Feature specs

### FEAT-15.1 - Updates Reliability

Problema: a UI mistura nome exibido com chave tecnica. Isso pode fazer updates/install falharem para CLIs, tools e prerequisitos.

Requisitos:

- Toda entidade atualizavel deve expor `key`, `name`, `currentVersion`, `latestVersion`, `status`.
- Backend deve aceitar apenas `key` canonica.
- UI deve desabilitar acao quando `key` estiver ausente.
- Status bar, Updates page e backend devem calcular o mesmo total.
- Erros de update devem mostrar ferramenta, comando sugerido e proximo passo.

Aceite:

- Teste unitario cobre `check_all_updates` incluindo tools no total.
- Teste UI garante que `update_cli` recebe `claude`, nao `Claude`.
- Teste UI garante que prerequisito `Node.js / npm` envia `node`.
- Status bar e Updates page exibem o mesmo numero.

### FEAT-15.2 - Unified Presets & Templates

Problema: Admin usa `LaunchPreset`, Launcher usa `SessionTemplate`; os dois nao conversam.

Modelo proposto:

```ts
type LaunchProfile = {
  id: string;
  name: string;
  description?: string;
  directory?: string;
  cliKeys: string[];
  toolKeys: string[];
  providerKey?: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Requisitos:

- Migrar dados de `ai-launcher-presets` e `ai-launcher:session-templates`.
- Admin edita os mesmos perfis que Launcher usa.
- Launcher exibe perfis pinados primeiro.
- Criar, editar, duplicar, exportar, importar e remover perfil.
- Reabrir historico pode virar perfil em um clique.

Aceite:

- Usuarios existentes nao perdem templates.
- `PresetsBar` deixa de ser codigo morto ou e removido.
- Nao ha duas fontes de verdade para presets.

### FEAT-15.3 - Custom Tools Runtime

Problema: custom CLIs e IDEs existem em codigo, mas nao estao integradas ao fluxo principal.

Requisitos:

- Custom CLI aparece junto das CLIs oficiais, com badge `Custom`.
- Custom IDE aparece na Tools page, com teste de path/comando.
- Comando customizado deve ter preview antes de executar.
- Env vars customizadas devem passar por redacao em export/log.
- Import/export deve incluir custom tools sem segredos.

Aceite:

- Criar custom CLI e inicia-la a partir do Launcher.
- Criar custom IDE e inicia-la a partir da Tools page.
- Comando livre sempre mostra preview e confirmacao.
- Historico registra que a sessao veio de ferramenta custom.

### FEAT-15.4 - Session Lifecycle

Problema: historico trata sessoes sem status como `running`, mesmo sem monitoramento real.

Requisitos:

- Backend deve retornar um `sessionId` por launch.
- Quando possivel, manter handle do processo e emitir eventos de status.
- Estados: `starting`, `running`, `completed`, `failed`, `unknown`.
- Se processo for destacado ou nao monitoravel, usar `unknown`, nao `running`.
- Historico deve registrar duracao real quando disponivel.

Aceite:

- Sessao finalizada muda de estado sem acao manual.
- Falha de launch grava `failed` com mensagem util.
- UI nao mostra "running" para sessao sem evidencia.

### FEAT-15.5 - Provider Adapter Matrix

Problema: teste de provider usa formato Anthropic-like para todos, o que nao e correto para todo endpoint.

Requisitos:

- Cada provider define protocolo: `anthropic_messages`, `openai_chat`, `openai_responses`, `custom`.
- Teste de conexao usa path, headers e payload corretos por protocolo.
- Provider deve declarar modelos conhecidos e modelo default.
- UI deve mostrar quando um provider e parcialmente compativel.

Aceite:

- OpenRouter testa com endpoint compativel e headers corretos.
- Anthropic-like continua funcionando.
- Falha mostra se o problema e auth, rede, modelo ou protocolo.

### FEAT-15.6 - Secure Secrets

Problema: chaves em `localStorage` e seeds `VITE_*` aumentam risco de vazamento local/build-time.

Requisitos:

- Mover API keys para storage nativo seguro quando disponivel.
- No Windows, preferir DPAPI ou plugin de stronghold/credential store.
- Quando storage seguro nao estiver disponivel, usar localStorage com aviso explicito de seguranca e opcao de upgrade.
- Export deve continuar redigindo segredos.
- Build publico nao deve embutir API keys de ambiente.
- `.env.example` deve documentar apenas variaveis realmente suportadas e seguras.

Aceite:

- Nenhuma key aparece em bundle, logs, export ou screenshots.
- Usuario pode migrar keys existentes sem reconfigurar tudo.
- Testes cobrem redacao de `apiKey`, `Authorization`, `token`, `secret`.
- Quando fallback e ativado, UI mostra aviso claro e botao para tentar storage seguro.

### FEAT-15.7 - Command Deck 2.0

Problema: visual e memoravel, mas ainda tem inconsistencias de tokens, emojis, light theme plana e dialogs nativos.

Requisitos:

- Consolidar tokens em `src/theme/tokens.css`.
- Remover variaveis inexistentes.
- Fonte escolhida em settings deve alterar tokens realmente usados.
- Trocar emojis por icones consistentes.
- Criar componentes de dialog, toast e confirmacao.
- Melhorar light theme com mais profundidade, contraste funcional e melhor uso de espaco.

Aceite:

- Nenhum `var(--surface)` indefinido.
- Nenhum `alert/confirm/prompt` nos fluxos principais.
- Font selector tem efeito perceptivel.
- Screenshots de README correspondem ao build atual.

### FEAT-15.8 - GitHub & Release Reliability

Problema: a release publica mais recente exibe assets antigos, o que aumenta erro de download e reduz confianca.

Requisitos:

- Workflow deve publicar apenas assets da versao atual.
- Script de auditoria deve validar nomes de assets antes de publicar.
- Release notes devem separar installer, portable, checksum e source.
- README deve apontar claramente para o asset recomendado.
- Criar checklist pre-release com build, smoke test, screenshots e limpeza de assets.

Aceite:

- Release `v15.0.0` contem apenas arquivos `15.0.0`.
- CI falha se encontrar asset de outra versao.
- Usuario consegue identificar o instalador recomendado em menos de 5 segundos.

### FEAT-15.9 - Workspace Profiles

Problema: desenvolvedores que trabalham em multipos repos/contexts nao tem como agrupar configuracoes.

Requisitos:

- Profile agrupa diretorio, CLI, provider, env vars e ferramentas.
- Perfis podem ser pinados, filtrados por tag e buscados.
- Import/export de perfil inclui tudo exceto segredos.
- Perfil pode ser criado a partir de historico de sessao.

Aceite:

- Criar profile com 3 cliques ou menos.
- Trocar de profile alterna diretorio, CLI e provider.
- Export de profile nao contem segredos.

### FEAT-15.10 - Agent Runbooks

Problema: setup de ambiente para agentes e repetitivo e propenso a erro.

Requisitos:

- Runbook define sequencia de passos: instalar prereqs, configurar env, lancar agente.
- Passos podem ser automaticos ou com confirmacao manual.
- Runbook pode ser compartilhado via JSON.
- Execucao de runbook gera log com resultado de cada passo.

Aceite:

- Executar runbook completo em um clique.
- Log mostra sucesso/falha por passo.
- Compartilhar runbook sem segredos embutidos.

### FEAT-15.11 - Provider Budget Guard

Problema: sem visibilidade de uso/custo por provider, gastar demais e invisivel.

Requisitos:

- Definir limite de uso por provider (em USD ou requests).
- Alerta local quando se aproxima do limite.
- Dashboard simples de uso acumulado no periodo.
- Dados ficam locais, sem telemetria.

Aceite:

- Configurar limite em 30 segundos.
- Alerta aparece ao atingir 80% do limite.
- Reset de periodo e manual.

### FEAT-15.12 - Environment Doctor

Problema: ambiente quebrado e descoberto tarde, sem diagnostico automatizado.

Requisitos:

- Verificar presenca e versao de Node, Git, Rust, Python, Bun e CLIs instaladas.
- Classificar problemas por severidade: critico, aviso, informativo.
- Propor reparo com comando seguro e preview.
- Execucao de reparo requer confirmacao explicita.
- Suporte a dry-run para prever acoes sem executar.

Aceite:

- Diagnostico completo em menos de 10 segundos.
- Cada problema tem acao recomendada com nivel de risco.
- Nenhum reparo executa sem confirmacao.

### FEAT-15.13 - Safe Command Preview

Problema: comandos customizados podem ser destrutivos sem o usuario saber.

Requisitos:

- Antes de executar, mostrar: executavel, args, cwd, env (redigido) e nivel de risco.
- Classificar risco: safe, caution, dangerous.
- Comandos dangerous requerem confirmacao explicita.
- Suporte a dry-run quando o comando suportar.
- Historico registra preview executado.

Aceite:

- Todo comando customizado passa por preview.
- Risco e calculado automaticamente por padrao de args.
- Nenhum comando dangerous executa sem confirmacao dupla.

### FEAT-15.14 - Self-Updater

Problema: atualizar o AI Launcher requer download manual do GitHub.

Requisitos:

- Verificar versao disponivel via `latest.json` ou GitHub API.
- Download em background com progresso visivel.
- Validar checksum antes de aplicar.
- Aplicar update ao reiniciar ou com confirmacao.
- Separado de update de ferramentas (CLIs, IDEs, prereqs).

Aceite:

- Verificar update automaticamente ao abrir o app.
- Download e validacao sem interromper uso.
- Update falha graciosamente se checksum nao bater.

### FEAT-15.15 - Windows Distribution

Problema: instalador sem assinatura gera alertas SmartScreen e dificulta adocao.

Requisitos:

- Assinar executavel e installer com certificado Windows.
- Publicar no Winget.
- Publicar no Chocolatey.
- Documentar comando de instalacao por canal.

Aceite:

- Instalador assinado nao gera SmartScreen warning.
- `winget install ai-launcher` funciona.
- `choco install ai-launcher` funciona.

### FEAT-15.16 - Accessibility

Problema: app nao e totalmente acessivel por teclado ou leitor de tela.

Requisitos:

- Todos os elementos interativos tem labels descritivos.
- Estados de foco visiveis e consistentes.
- Navegacao completa por teclado.
- Auditoria automatica com Playwright + axe.

Aceite:

- Axe reporta zero violacoes serias nas telas principais.
- Navegacao por Tab cobre todas as acoes criticas.
- Screen reader consegue identificar todos os controles.

## 8. Arquitetura proposta

### Frontend

Direcoes:

- `src/features/launcher`: composicao de launch, profiles e session start.
- `src/features/tools`: catalogo de official + custom tools.
- `src/features/updates`: health/update/install state machine.
- `src/features/providers`: provider registry + secure secret handles.
- `src/features/history`: session lifecycle e replay.
- `src/features/workspace`: profiles, runbooks e environment doctor.
- `src/domain`: tipos compartilhados de `LaunchProfile`, `ToolDefinition`, `ProviderDefinition`, `SessionRecord`, `Runbook`, `WorkspaceProfile`.

Principios:

- Uma fonte de verdade por dominio.
- UI nunca passa nome exibido para comando backend.
- Todos os comandos destrutivos ou externos passam por preview.
- Stores locais devem ter versao e migracao.

### Backend

Direcoes:

- Dividir `util.rs` em definicoes, paths, process, validation e tests.
- Padronizar `AppError` com codigos.
- `commands::updates` deve operar sobre registry canonico.
- `commands::launcher` deve retornar `sessionId` e status monitoravel quando possivel.
- Custom commands devem usar modelo estruturado de executable + args em vez de string livre quando possivel.
- Comando de self-update separado de update de ferramentas.

### Dados locais

Stores versionados:

- `ai-launcher:v15:profiles`
- `ai-launcher:v15:history`
- `ai-launcher:v15:custom-tools`
- `ai-launcher:v15:providers`
- `ai-launcher:v15:workspace`
- `ai-launcher:v15:runbooks`
- `ai-launcher:v15:appearance`
- `ai-launcher:v15:budget`

Migracoes obrigatorias:

- `ai-launcher-presets` -> `profiles`
- `ai-launcher:session-templates` -> `profiles`
- custom IDEs existentes -> `custom-tools`
- provider keys em localStorage -> storage seguro

## 9. UX proposta

### Navegacao

- **Launcher**: iniciar sessao, perfis pinados, diretorios recentes.
- **Tools**: instalar, abrir, reparar e customizar ferramentas.
- **Providers**: configurar, testar, selecionar default e ver compatibilidade e budget.
- **Updates**: atualizar app, CLIs, tools e prerequisitos.
- **History**: status real, reabrir, transformar em perfil.
- **Workspace**: profiles, runbooks, environment doctor.
- **Admin**: catalogo, import/export, diagnostics, advanced settings.

### Telas novas ou revisadas

- **Profile Builder**: wizard curto para criar workflow de trabalho.
- **Environment Doctor**: diagnostico com severidade, impacto e acao recomendada.
- **Safe Command Preview**: mostra executavel, args, cwd, env redigido e risco.
- **Release Channel**: versao atual do app, changelog e atualizacao do AI Launcher.
- **Budget Dashboard**: uso acumulado por provider com limites configurados.
- **Runbook Editor**: criar e editar sequencias de setup.

### Visual

Manter a identidade "Command Deck", mas deixar a interface mais operacional:

- Cards com status mais escaneavel.
- Menos ornamento em areas de decisao.
- Light theme com melhor profundidade e separacao.
- Animacoes apenas para mudanca de estado, loading e feedback de comando.
- Sem emojis no chrome principal.
- Icones consistentes em toda a interface.

## 10. Plano de entrega

### v15.0.0 - AI Ops Command Center

Uma unica release com todos os pilares. Organizacao interna por milestones para trackear progresso:

#### Milestone 1 - Confiabilidade e Base

- FEAT-15.1: Updates Reliability
- FEAT-15.8: GitHub & Release Reliability
- Correcao de E2E (`localhost` -> `127.0.0.1`)
- Consolidacao de tokens CSS
- Atualizacao de docs e screenshots

#### Milestone 2 - Consolidacao de Dominio

- FEAT-15.2: Unified Presets & Templates
- FEAT-15.3: Custom Tools Runtime
- FEAT-15.4: Session Lifecycle
- FEAT-15.5: Provider Adapter Matrix

#### Milestone 3 - Produto Novo

- FEAT-15.6: Secure Secrets
- FEAT-15.9: Workspace Profiles
- FEAT-15.10: Agent Runbooks
- FEAT-15.11: Provider Budget Guard
- FEAT-15.12: Environment Doctor
- FEAT-15.13: Safe Command Preview

#### Milestone 4 - UI/UX e Polimento

- FEAT-15.7: Command Deck 2.0
- FEAT-15.16: Accessibility
- Sistema de dialogos e toasts
- Light theme reworked

#### Milestone 5 - Distribuicao e Release

- FEAT-15.14: Self-Updater
- FEAT-15.15: Windows Distribution
- Release notes e checksums padronizados
- Smoke test final em ambiente limpo

## 11. Test strategy

### Gates obrigatorios

- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `cargo fmt --check`
- `cargo test`
- `cargo clippy --no-deps -- -D warnings`
- `npm run e2e`
- `axe` accessibility audit nas telas principais

### Testes novos prioritarios

- Updates UI envia keys canonicas.
- Backend soma updates de CLIs, tools e env.
- Migracao de presets/templates preserva dados.
- Custom CLI/IDE aparecem e lancam com preview.
- Provider tests por protocolo.
- Redacao de segredos em export, logs e preview.
- History nao marca sessao como running sem evidencia.
- Axe/Playwright para dialogos principais.
- Workspace profile cria e alterna configuracoes.
- Runbook executa passos em sequencia com log.
- Budget alerta ao atingir limite.
- Environment Doctor detecta problemas e propoe reparo.
- Self-updater valida checksum antes de aplicar.

### Observacao de ambiente

- Para Rust no Windows, documentar instalacao do Visual Studio Build Tools com MSVC linker.
- Garantir que CI cubra o gate Rust quando ambiente local nao estiver completo.

## 12. Riscos e mitigacoes

- **Risco**: migracao de presets/templates quebrar dados antigos.
  **Mitigacao**: backup automatico do localStorage antes da migracao e testes com fixtures.

- **Risco**: storage seguro nativo variar por OS.
  **Mitigacao**: interface com fallback explicito, aviso de seguranca e opcao de upgrade.

- **Risco**: monitorar processos externos ser inconsistente no Windows.
  **Mitigacao**: status `unknown` honesto quando nao houver handle confiavel.

- **Risco**: comandos customizados abrirem superficie de abuso local.
  **Mitigacao**: preview obrigatorio, confirmacao, redacao de env e logs claros.

- **Risco**: self-updater conflitar com release atual.
  **Mitigacao**: separar Updates Hub de ferramentas e App Updater.

- **Risco**: escopo grande demais para uma release.
  **Mitigacao**: milestones internos permitem validar progresso e cortar escopo se necessario sem quebrar a release.

- **Risco**: assinatura Windows requer certificado pago.
  **Mitigacao**: avaliar custo-beneficio; Winget/Chocolatey funcionam sem assinatura, apenas com SmartScreen warning.

## 13. Fora de escopo

- Sync cloud de configuracoes.
- Marketplace publico de presets.
- Execucao remota de agentes.
- Telemetria externa por padrao.
- Multiusuario corporativo com RBAC.
- Suporte a macOS e Linux (futuro).

## 14. Checklist de aceite v15.0.0

- [ ] Usuario novo instala o app e inicia primeira sessao em menos de 3 minutos.
- [ ] Usuario existente mantem presets/templates apos migracao.
- [ ] Updates Hub executa acoes corretas por chave canonica.
- [ ] Tools customizadas aparecem junto das oficiais.
- [ ] Historico nao mente sobre status de execucao.
- [ ] Chaves sensiveis nao ficam em export/log/bundle.
- [ ] E2E roda localmente e em CI.
- [ ] README, screenshots e release assets batem com a versao publicada.
- [ ] Release v15.0.0 no GitHub contem apenas assets da versao correta.
- [ ] Self-updater verifica, baixa e valida update.
- [ ] Environment Doctor diagnostica ambiente e propoe reparos.
- [ ] Workspace profiles criam e alternam configuracoes.
- [ ] Agent runbooks executam sequencias com log.
- [ ] Budget guard alerta ao se aproximar do limite.
- [ ] Light theme tem profundidade e contraste adequados.
- [ ] Nenhum alert/confirm/prompt nativo nos fluxos principais.
- [ ] Axe reporta zero violacoes serias nas telas principais.
- [ ] Instalador assinado (ou documentado por que nao).
- [ ] Winget e/ou Chocolatey publicados.

## 15. Apontamentos para implementacao

### Frontend - Alta prioridade

- `src/features/updates/UpdatesPage.tsx`: corrigir uso de `u.cli`/`p.name` como chave tecnica.
- `src/lib/appearance.ts`: alinhar tokens de fonte e remover legado.
- `src/features/onboarding/OnboardingPage.css`: corrigir `--surface`.
- `src/features/history/HistoryPage.css`: corrigir `--surface` e status hardcoded.
- `src/presets/*` e `src/features/launcher/sessionTemplates.ts`: unificar dominio.
- `src/lib/customClis.ts` e `src/features/admin/CustomIdesSection.tsx`: integrar ao fluxo principal.
- `src/providers/*`: separar segredo real de metadata e adaptar teste por protocolo.

### Frontend - Novos modulos

- `src/features/workspace/`: profiles, runbooks, environment doctor, budget guard.
- `src/features/tools/`: catalogo unificado de official + custom tools.
- `src/domain/`: tipos compartilhados (`LaunchProfile`, `ToolDefinition`, `ProviderDefinition`, `SessionRecord`, `Runbook`, `WorkspaceProfile`).
- `src/components/ui/`: dialog, toast, confirm components.

### Backend - Alta prioridade

- `src-tauri/src/commands/updates.rs`: retornar `key` para CLI updates e somar tools em `total`.
- `src-tauri/src/commands/launcher.rs`: estruturar lifecycle e seguranca de comandos customizados.

### Backend - Novos modulos

- `src-tauri/src/commands/workspace.rs`: profiles, runbooks.
- `src-tauri/src/commands/doctor.rs`: environment diagnostics.
- `src-tauri/src/commands/self_update.rs`: app updater.
- `src-tauri/src/secrets.rs`: secure storage interface.

### Infra

- `playwright.config.ts`: evitar dependencia de `localhost`.
- `.github/workflows/release.yml`: validar assets por versao.
- `.github/workflows/quality.yml`: garantir gates Rust e E2E.
- `docs/screenshots/*`: regenerar imagens atuais.

## 16. Decisoes recomendadas

1. Tratar todos os pilares como parte da v15.0, com milestones internos para trackear progresso.
2. Nao construir features novas antes de unificar presets/templates (Milestone 2 bloqueia Milestone 3).
3. Separar "update do app" de "update de ferramentas" na linguagem do produto.
4. Parar de usar nome exibido como identificador tecnico em qualquer comando.
5. Trocar "local-first" por "local-first com segredo seguro", porque plaintext localStorage e insuficiente para o posicionamento atual.
6. Manter Command Deck como direcao visual, mas remover inconsistencias e emojis de chrome.
7. Corrigir release assets antes de divulgar a release v15 para novos usuarios.
8. Secure Secrets com fallback transparente: se storage seguro nao estiver disponivel, avisar o usuario e nao falhar silenciosamente.
9. Se escopo se tornar inviavel, cortar do Milestone 5 (Distribuicao) para tras, nunca da base de confiabilidade.
