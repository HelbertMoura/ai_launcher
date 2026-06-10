# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-05-19

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

- **Idioma:** sempre pt-BR nas conversas; código e logs em inglês ok.
- **Build:** valida tudo local antes de pensar em GitHub; não pushar sem confirmação explícita.
- **Estilo de execução:** brainstorming → spec → plan → execute inline com checkpoints. Confirmação por pergunta antes de cada mudança de fase.

## Key Learnings

- **Project:** ai-launcher
- **Description:** Desktop launcher for AI coding CLIs — by Helbert Moura | DevManiac's
- **Antigravity CLI real**: o binário se chama `agy`, NÃO `antigravity`. Instalado por script PowerShell em `%LOCALAPPDATA%\agy\bin\agy.exe`. Não existe pacote npm — `@google/antigravity` retorna 404.
- **Manifesto de update do agy**: `https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json` — campo `.version` é SemVer puro.
- **Flag de skip-permissions do agy**: `--dangerously-skip-permissions` (igual ao Claude). Confirmado via `agy help`.
- **IDEs Electron não respondem a `--version`** (Antigravity, Cursor, Windsurf). Para a versão real, ler `ProductVersion` do PE via `(Get-Item).VersionInfo.ProductVersion`.
- **DnD em Cards interativos**: aplicar `draggable` no wrapper que contém botões NÃO funciona porque os filhos consomem `mousedown`. Solução: handle dedicado isolado dos botões.
- **CliInfo struct serializa para o frontend**: novos campos opcionais precisam `#[serde(default)]` para não quebrar JSON salvo previamente.
- **`npm run build` NÃO roda tsc** — o script é só `vite build` (rolldown transpila TS mas não checa tipos com rigor). Para validar tipos (incl. `noUnusedLocals`/`noUnusedParameters` que estão `true` no tsconfig), rodar `npx tsc --noEmit` separadamente. `npm run test` = `vitest run`.
- **i18n type-safe**: `en.ts` importa `Dictionary` derivado de `pt-BR.ts`. Ao adicionar chave nova, adicionar em pt-BR.ts PRIMEIRO (fonte do tipo) e depois em en.ts, senão tsc quebra.
- **toastStore**: `import { showToast } from "../ui/toastStore"` — `showToast(message, variant)` com variant `success|error|warning|info`. Auto-dismiss em 4s.
- **ConfirmDialog** (`src/ui/ConfirmDialog.tsx`): modal de confirmação reutilizável; aceita `children` opcional renderizado entre `message` e as actions (ex: embutir um `SafeCommandPreview`). `variant="danger"` foca o botão Cancel no open. NÃO há handler global de Enter (botão focado dispara click nativo).
- **SafeCommandPreview** (`src/ui/SafeCommandPreview.tsx`): preview de comando com gating de risco. Prop `hideActions` esconde os botões próprios (para usar dentro de outro dialog que dona as actions); `onAckChange(boolean)` reporta o acknowledge do checkbox "dangerous" para o host gatar o confirm. Padrão de composição: `ConfirmDialog` + `SafeCommandPreview hideActions onAckChange` (usado em DoctorPage para o fix).
- **npm install exige `--legacy-peer-deps`**: `typescript@^6` conflita com o peerOptional `typescript@^5` de `i18next@24` (via react-i18next). `npm install <pkg>` falha com ERESOLVE; usar `npm install <pkg> --legacy-peer-deps`. Não há `.npmrc` no repo.
- **E2E (Playwright)**: `playwright.config.ts` tem `webServer.command="npm run dev"` na porta `5173` com `reuseExistingServer: !CI`. Rodar specs isolados sem dev server ativo dá timeout no `page.goto` (boot do Vite + 30s test timeout). Para iterar rápido: subir `npm run dev` em background, esperar HTTP 200 na 5173, depois `npx playwright test`. O diretório `e2e/` NÃO está no `tsconfig.json` (só `src`) — para typecheck do spec, usar tsconfig temporário ou rodar o próprio Playwright.
- **A11y test (axe-core)**: `@axe-core/playwright` instalado. O tema dark atual viola WCAG AA `color-contrast` em labels dimmed (~3.7:1, esperado 4.5:1). O teste de a11y desabilita a regra `color-contrast` (dívida de design, TODO) e ainda guarda regressões estruturais (labels/roles/aria/names). Tauri é stubado via `window.__TAURI_INTERNALS__` no `beforeEach`.
- **ChromeConnector (App.tsx)**: usa `useClis()` (não `useSyncExternalStore` cru) — o hook já subscreve E dispara `ensureLoaded`, garantindo que a StatusBar popule no boot. `useClis()` retorna `State & { refresh }`; `snapshot.clis`/`snapshot.checks` são os campos usados pela StatusBar.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

- **[2026-05-19]** Adicionar CLI nova: SEMPRE validar o nome do binário e a existência do pacote npm rodando `where <cmd>` e `npm view <pkg> version` na máquina real antes de commitar. A entrada original do Antigravity ficou quebrada porque os campos foram preenchidos sem validação (`@google/antigravity` 404, `command: "antigravity"` inexistente).
- **[2026-05-19]** Para IDEs Electron, NUNCA confiar em `<exe> --version` — Electron mostra dialog/no-op. Ler `ProductVersion` direto do PE.
- **[2026-05-19]** Drag-and-drop dentro de `<Card>` com botões: NÃO aplicar `draggable` no wrapper externo. Usar handle dedicado isolado dos botões.
- **[2026-05-19]** HTML5 native drag (`draggable={true}` + `onDragStart`) tem comportamento inconsistente em Windows + WebView2 (Tauri). Mesmo com handle dedicado o gesto pode não disparar. **Solução padrão: usar `@dnd-kit` (pointer events) para qualquer DnD em apps Tauri.**
- **[2026-05-19]** Não confiar em CHANGELOG pré-existente. Quando há esboço de uma versão ainda não lançada, reescrever do zero com base no que realmente foi implementado.

- **[2026-06-10]** Reviewers de workflow (spec/quality) que avaliam só o RELATÓRIO TEXTUAL do implementer aprovam coisas que não estão na árvore. O Batch E de CSS foi "aprovado" mas as mudanças de tema nunca persistiram (provável perda por limite de sessão). SEMPRE rodar git diff/npm run build real e conferir os arquivos antes de commitar output de workflow — o finalReview que lê o diff real pegou; os reviewers por-batch que liam só o relatório não pegaram.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->

- **2026-05-19** — Generalizar `CliInfo` com `extra_paths`+`update_manifest_url` em vez de hardcode por CLI. Razão: o droid já é script-installed; agy seria o segundo caso — abstrair foi mais barato que duplicar.
- **2026-05-19** — Ler `ProductVersion` via PowerShell em vez de crate `windows` nativa. Razão: 4 linhas de código vs nova dependência; tempo extra é aceitável (~200ms) e cacheável depois.
- **2026-05-19** — Drag handle `⋮⋮` visível em vez de drag invisível no wrapper. Razão: affordance + zero conflito de `mousedown` com botões filhos. UX fica óbvio para o usuário.
- **2026-05-19** — Update do IDE Antigravity adiado para v15.3. Razão: endpoint web (`antigravity-hub-auto-updater-...`) retorna 404 nos paths comuns; investigação requer captura de tráfego do app rodando. Versão local (ProductVersion) já mostra "2.0.0" — suficiente para v15.2.
- **2026-05-19** — Tasks do plano executadas inline com agrupamento (1+2, 4+5+6, 7-12) em vez de commit por task. Razão: dependências fortes entre tasks (clippy reclama de dead_code antes do consumidor existir). Granularidade do plano serve ao tracking, não à granularidade de commit.
- **2026-05-19** — Trocar HTML5 drag por `@dnd-kit` na v15.2.1. Razão: HTML5 native drag não disparava no ambiente Windows + WebView2 do usuário. `@dnd-kit` usa pointer events (universais), inclui suporte a teclado out-of-the-box e tem `activationConstraint` para não conflitar com cliques. +22 kB gzipped, vale a pena pela robustez.
