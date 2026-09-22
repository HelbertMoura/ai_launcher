# AI Launcher — Roadmap

Para onde o projeto está indo. Prioridades, não promessas: este roadmap não carrega datas de propósito — cada item sai quando estiver pronto.

## Onde estamos — v22.9.0

O AI Launcher é um command deck desktop nativo (Tauri v2 + React 19 + Rust) para descobrir, lançar e monitorar agentes CLI de IA, IDEs e servidores MCP — local-first, zero telemetria, licença MIT.

Pilares já entregues:

- **Launcher Multi-Agente** — execução em 1 clique para Claude Code, Codex, Antigravity, Aider, Goose, Cline, Roo Code, Continue, Cody, Copilot, VS Code e Cursor
- **Hub MCP por Projeto** — detecção automática de stack, presets validados e monitoramento de saúde
- **Analytics de Custos & Budget Guard** — rastreio de gasto por provedor em tempo real, com tetos mensais configuráveis e alertas
- **Environment Doctor** — diagnóstico concorrente de runtimes (Node, Python, Rust, Docker e mais) com reparo guiado em 1 clique
- **Agent Runbooks** — scripts declarativos e repetíveis de setup, com logs em tempo real, dry-run e aprovações
- **Command Palette e navegação keyboard-first** — paleta `Ctrl+K`, troca de abas `Ctrl+1-9/0`
- **7 temas com controles de densidade** e i18n (inglês e português do Brasil)
- **Updater OTA criptográfico** — atualizações verificadas com Minisign (hoje no Windows)

## Entregas recentes

Ondas recentes de engenharia (higiene → rede de proteção → plataforma), até a v22.9.0:

- [x] Higiene do núcleo — helpers de segurança deduplicados, camada de erro tipada (`AppError`) nos commands Rust, varreduras de rede/arquivo tiradas da thread de comandos
- [x] Segurança de shell — escaping de metacaracteres no fallback `cmd /K`, tokens de comando custom sob guarda, probe HTTP real para o health check de MCP
- [x] Rede de proteção — primeiros testes de componente React, Playwright E2E e regressão visual rodando no CI, novos testes Rust para helpers puros (366 testes automatizados: 239 Vitest + 127 Rust)
- [x] Quality gates em 9/9 entre Windows e Ubuntu — tsc, Vitest, clippy, cargo audit, Playwright E2E, métricas de build, readiness
- [x] Núcleo multiplataforma — secrets no Windows Credential Manager, Keychain no macOS e Secret Service no Linux, com UI de credenciais fail-closed quando não há vault
- [x] Bundles macOS e Linux — dmg (Apple Silicon + Intel), AppImage e deb gerados no CI e anexados aos releases
- [x] Manifestos de empacotamento — winget, Scoop e Chocolatey com script gerador (submissão às lojas pendente do 1º release estável)
- [x] Guia público de instalação multiplataforma — instruções NSIS/MSI, dmg e AppImage/deb para usuários finais

## v23.0.0 — "Fleet Command" (planejado — explorando)

A próxima onda maior, aprovada como direção: executar e observar vários
agentes ao mesmo tempo, com salvaguardas de custo e segurança. Sem datas,
de propósito.

- [ ] **Multi-agente paralelo com isolamento por git worktree** — rode vários agentes no mesmo projeto em worktrees isolados, além do Race Mode: diffs lado a lado em que você adota o melhor resultado
- [ ] **Diff & Review Cockpit** — superfície de revisão por sessão do que cada agente mudou antes do merge
- [ ] **Cost Governance 3.0** — orçamento por projeto, projeção de gastos e custo por sessão
- [ ] **Registry de Runbooks assinado** — distribuição de runbooks verificada com minisign
- [ ] **Agendador local de runbooks** — execute runbooks em horários programados, totalmente offline
- [ ] **Reagrupamento da sidebar** — grupos Executar / Observar / Conectar-Sistema com atalhos fixados
- [ ] **Reavaliar canais de distribuição** — os manifestos de winget/Chocolatey seguem dormentes em `packaging/`; revisitamos só se surgir demanda de usuários (GitHub Releases + Scoop cobrem as necessidades atuais)

## Próximo

Em ordem de prioridade. Sem datas, de propósito.

- [ ] Auto-updater multiplataforma — `latest.json` assinado para macOS e Linux
- [ ] Notarização Apple e assinatura Authenticode (EV) no Windows
- [ ] Submissões nas lojas winget / Scoop / Chocolatey
- [ ] Paridade de sessões em Unix — duração e kill de processo para sessões macOS/Linux
- [ ] Paridade do Environment Doctor — diagnósticos completos e correções guiadas em todos os sistemas

---

Dúvidas ou sugestões? Abra uma [issue](https://github.com/HelbertMoura/ai_launcher/issues) ou leia o [CONTRIBUTING.md](./CONTRIBUTING.md).
