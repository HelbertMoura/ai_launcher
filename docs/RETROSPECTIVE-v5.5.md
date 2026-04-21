# Retrospectiva v5.5 — Terminal Dramático

**Período:** 2026-04-20 → 2026-04-21 (aproximadamente 19 horas de trabalho efetivo com pausas por rate limit)
**Branch:** `v5.5-terminal-dramatico` → merged into `main`
**Tags:** `v5.5.0`, `v5.5.1`
**Commits:** 33 na branch, 1 merge commit em main, mais 1 hot-fix patch (v5.5.1)
**Bundle final:** 113.11 KB gzipped (budget 300 KB) — **62% abaixo do orçamento**

## O que saiu bem

- **Subagent-driven development com dispatch paralelo**
  4 agents rodando simultaneamente em arquivos disjuntos (Tasks 17/18/20/21 e depois 25/26 e docs 27/29/30). Todos commitaram verde, zero conflitos. Ganho estimado: ~3x sobre execução sequencial pura.
- **Two-stage review (spec compliance + code quality)**
  Code quality reviewer pegou 4 issues IMPORTANT em cada task grande (keys instáveis, clipboard feedback silencioso, tipagem fraca, brand tokens divergentes). Spec reviewer isolado pegou divergências estruturais que o quality reviewer não priorizaria.
- **Guardrails consistentes**
  Bundle size, tsc clean, clippy clean, schema localStorage inalterado — todos mantidos através de 33 commits sem regressão. Nenhum agent violou guardrail.
- **Recuperação de rate limit sem perda**
  Working tree sempre clean antes de pausar. Re-dispatch reusou os mesmos prompts (salvos no contexto) — tasks 25 e 26 relançadas com prompts idênticos completaram na segunda tentativa.
- **Adaptações inteligentes dos agents**
  Task 16 agent decidiu SKIP days filter quando descobriu que timestamp era string pt-BR já formatada. Task 25 agent verificou localStorage keys reais (`ai-launcher-providers` sem `:`) em vez de usar as do plan (erradas). Esse tipo de julgamento salvou rework.

## O que doeu

- **Plan desatualizado em detalhes estruturais**
  Plan foi escrito antes de grep profundo. Várias suposições erradas: `item.provider.displayName` (não existe — é `providerName`), localStorage keys com `:` (alguns são `-`), `env` field em ProviderProfile (é `apiKey` + `extraEnv`). Retrabalho marginal a cada task.
- **Admin gate compile-time era fricção desnecessária**
  Descoberta tardia. v5.5.0 saiu com gate compile-time; v5.5.1 teve que ser lançada rapidamente com runtime toggle. Poderia ter sido pego no brainstorming inicial se tivéssemos perguntado "como o end user baixa + ativa features avançadas?".
- **Build do Tauri release pegou instaladores históricos**
  `gh release create` sem lista explícita de assets subiu todos os MSI/EXE do diretório `target/release/bundle/` (incluindo v3.2.6, v4.0.0, etc). Tive que deletar a release e recriar passando arquivos específicos. Precisa doc em CONTRIBUTING.
- **Rate limit cortou dispatches paralelos inesperadamente**
  2 agents em paralelo bateram limit enquanto os outros 2 concluíram — divisão arbitrária. Fiquei com 2 tasks não iniciadas (commits vazios) até reset. Futuramente: dispar em batches de 2 para reduzir risco.

## Métricas

| Métrica | Valor |
|---|---|
| Tasks do plan completadas | 33/35 (ref: 28 screenshots + 35 retrospectiva — este doc é o 35) |
| Commits | 33 branch + 1 merge + 1 patch |
| Linhas mudadas | ~+5566 / −1834 |
| Novos arquivos | 30+ (tabs/, layout/, shared/, icons/, styles/, illustrations) |
| Bundle JS gz inicial (v5.1) | 103 KB |
| Bundle JS gz final (v5.5.1) | 113 KB |
| Fonts self-hosted | 4 × ~21 KB = 87 KB woff2 |
| Rust commands novos | 1 (`check_latest_release`) |
| Build time (frontend) | ~700-800ms |
| Build time (Tauri installer) | ~5-8min |

## Ações pra próxima release

1. **Plan deve ter fase "grep realities"** antes de gerar prompts — validar field names, localStorage keys, component signatures
2. **Documentar em CONTRIBUTING.md** como criar release corretamente (limpar `target/release/bundle/` antes, ou passar arquivos explícitos pro `gh release create`)
3. **Screenshots (Task 28)** seguem pendentes — precisa rodar app manualmente em dark + light, capturar 8 surfaces (hero launcher, history timeline, costs, palette, admin, onboarding, help, statusbar) e commitar em `docs/screenshots/`
4. **Considerar testes unitários** para helpers críticos (`configIO.ts`, `isAdminMode` precedência, `isNewer` version parsing) — zero testes hoje
5. **Feature flag mode futuro** — além do admin, talvez beta features também mereçam runtime toggle (`?beta=1`)
6. **Signing dos installers** — atualmente unsigned, SmartScreen warning no Windows. Tratar em release subsequente

## Lições pra continuar com multi-agent

- **Scope estrito por agent** — "touch ONLY these files" + "DO NOT touch X/Y/Z" impediu pisões mútuos em 8 dispatches paralelos
- **Verificação de dados reais é responsabilidade do agent** — agents que confirmaram localStorage keys, data shapes e brand tokens entregaram implementações melhores que as que seguiram o plan literalmente
- **Commit no final de cada task é obrigatório** — um agent (Task 18, Task 24) deixou working tree sujo achando que precisava de confirmação explícita. Prompt precisa ser mais enfático: "Commit step is NOT optional"
- **Reviews podem ficar assíncronos** — spec review + code quality review podem rodar em paralelo (diferentes domínios cognitivos), economizando ~2min por task

## Crédito

Tudo feito via Claude Sonnet/Opus via Claude Code + skill set `superpowers` (brainstorming, writing-plans, subagent-driven-development, dispatching-parallel-agents, verification-before-completion, using-git-worktrees).
