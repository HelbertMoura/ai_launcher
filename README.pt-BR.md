> [🇺🇸 English](./README.md) | 🇧🇷 Português (Brasil)

```text
   ┌─ AI LAUNCHER ─────────────────────────── v11.0.0 ──┐
   │                                                    │
   │   ▎ COMMAND DECK                                   │
   │                                                    │
   │   ● claude-code   online    v2.1.0                 │
   │   ● codex         online    v1.4.2                 │
   │   ○ gemini        missing                          │
   │   ● qwen          online    v0.9.1                 │
   │   ▲ aider         update    v0.5 → v0.6            │
   │   ● copilot       online    v1.2.0                 │
   │                                                    │
   │   5/8 online         ● ADMIN         $0.42 today   │
   └────────────────────────────────────────────────────┘
```

Launcher desktop para CLIs de codificação com IA — detecte, instale, execute e acompanhe custos.

![Licença: MIT](https://img.shields.io/badge/license-MIT-blue)
![Versão 11.0.0](https://img.shields.io/badge/version-11.0.0-ff3131)
![Plataforma: Windows](https://img.shields.io/badge/platform-Windows-0078D4)

## O que é

O AI Launcher é um app desktop em Tauri v2 que gerencia CLIs de IA para codificação — Claude Code, Codex, Gemini, Qwen, Aider, Copilot e outros — junto com IDEs como VSCode, Cursor, Windsurf e JetBrains AI. Ele detecta o que já está instalado na sua máquina, ajuda a instalar o que falta, executa cada ferramenta com o provider certo e o diretório de trabalho correto, e acompanha o gasto por provider para você saber exatamente quanto cada sessão custa.

## Instalação

### Baixar o `.msi`

Pegue o instalador mais recente no [último release](https://github.com/HelbertMoura/ai_launcher/releases).

O SmartScreen do Windows pode alertar em builds sem assinatura — use **Mais informações → Executar mesmo assim**.

### Build a partir do código

**Pré-requisitos:** Node 20+, Rust stable, Visual Studio Build Tools com **Desktop development with C++**.

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri build
```

O `.msi` é gerado em `src-tauri/target/release/bundle/msi/`.

## Uso

### Atalhos de teclado

- `Ctrl+K` / `⌘K` — abre a paleta de comandos
- `Ctrl+1`..`Ctrl+4` — salta para as quatro primeiras abas
- `?` — abre a ajuda
- `Esc` — fecha qualquer diálogo aberto

### Sidebar

A barra lateral esquerda expõe sete superfícies: **Launch** (scan e execução de CLIs), **Tools** (gerenciamento de IDEs), **History** (lançamentos passados), **Costs** (gasto por provider), **Admin** (providers, presets, aparência, overrides e IDEs customizadas), **Help** e **Onboarding**.

### Sobre o Admin

O launcher sempre roda com acesso total ao sistema (`--dangerously-skip-permissions` é o padrão). Todas as credenciais, overrides e histórico permanecem locais — nada é transmitido além das chamadas de API que você dispara explicitamente.

## Personalização

- **Tema** — escuro (padrão) ou Hard Light
- **Accent** — 5 cores de LED: vermelho, âmbar, verde, azul, violeta
- **Fonte** — 5 opções monoespaçadas, incluindo JetBrains Mono e fallbacks pareados com Inter
- **Overrides de nome/ícone das CLIs** — renomeie qualquer CLI built-in e suba um ícone customizado
- **IDEs customizadas** — adicione qualquer IDE que não venha por padrão, CRUD completo no Admin
- **Providers** — Anthropic, Z.AI, MiniMax, Moonshot, Qwen, OpenRouter e endpoints customizados
- **Presets** — salve combinações de CLI + provider + diretório + args e dispare com `Ctrl+1..9`

## Novidades da v11

- **Seletor de idioma no TopBar** — alternância instantânea PT/EN sem ir ao Admin
- **Correção do locale pt-BR** — todas as traduções agora resolvem corretamente (fix de configuração do i18next v24)
- **Cache de scan de Tools** — sessionStorage TTL 10 min, sem re-escaneamento a cada troca de aba
- **Terminal animado** na página de Ajuda — demo com efeito de digitação do scan e launch de CLIs
- **Página de Ajuda expandida** — atalhos, FAQ, links do GitHub, branding DevManiac's

### Anterior: v10 — Command Deck

## Contribuindo

Faça fork do repositório, crie uma branch de feature e abra um pull request contra `main`. Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para setup, convenções e checklist de PR.

## Licença

MIT — veja [LICENSE](./LICENSE).

## Créditos

- Autor: **Helbert Moura** — DevManiac's
- **JetBrains Mono** — por JetBrains, licenciada sob SIL OFL 1.1
- **Inter** — por Rasmus Andersson, licenciada sob SIL OFL 1.1
- Os ícones são line-art desenhados manualmente — **não são** logos oficiais de fornecedores. Nomes de marcas e marcas registradas pertencem aos seus respectivos donos.
