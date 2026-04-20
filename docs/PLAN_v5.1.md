# Plano v5.1 — "Terminal Refinado"

> Consolidação: correções de bugs pendentes da v5.0.1 + reformulação visual completa.
> Escopo fechado; sem breaking changes; minor bump 5.0.1 → 5.1.0.

---

## Contexto (estado na data do plano)

- Repo: `HelbertMoura/ai_launcher` — branch `main` em `ebf02d8` + rebase dos Dependabot CI.
- Release atual: [v5.0.1](https://github.com/HelbertMoura/ai_launcher/releases/tag/v5.0.1) publicado (hotfix MiniMax URL + model). 4 binários (public + admin, exe + msi).
- PRs Dependabot abertos (deixar como está): #9 Vite 5→8 / TS 5→6 / plugin-react 4→6 · #10 React 18→19 · #11 react-dom 18→19. Todos majors com breaking changes — adiar pra v5.2+.
- Bug confirmado na v5.0.1: `src-tauri/src/main.rs:1682-1687` injeta `$env:ANTHROPIC_AUTH_TOKEN` sem remover `ANTHROPIC_API_KEY` herdado → `Auth conflict` no Claude Code CLI.
- Estado residual no Claude Code CLI: `~/.claude.json` tem `customApiKeyResponses.approved` + `oauthAccount` + custom model `glm-5.1 ✔` salvo via `/model`.
- Stack: Tauri v2 + React 18 + Rust + Vite 5 + TypeScript 5. CSS vanilla (9 arquivos, sem design tokens formal).
- Admin build = mesmo código com `.env.local` contendo `VITE_ADMIN_MODE=1`.

---

## Trilha 1 — Fixes de Env Conflict

**1.1 — `src-tauri/src/main.rs:1680` (função `launch_cli`)**

Adicionar `Remove-Item` pras envs Anthropic antes do loop de `env_vars`, mas só quando há envs custom a injetar:

```rust
let mut ps_script =
    String::from("$env:Path = \"$env:APPDATA\\npm;$env:LOCALAPPDATA\\npm;\" + $env:Path\n");

// Limpar envs Anthropic herdadas antes de injetar as do provider ativo.
// Evita conflito AUTH_TOKEN + API_KEY quando usuário tem OAuth salvo.
if env_vars.as_ref().map_or(false, |m| !m.is_empty()) {
    ps_script.push_str(
        "Remove-Item Env:ANTHROPIC_API_KEY      -ErrorAction SilentlyContinue\n\
         Remove-Item Env:ANTHROPIC_AUTH_TOKEN   -ErrorAction SilentlyContinue\n\
         Remove-Item Env:ANTHROPIC_BASE_URL     -ErrorAction SilentlyContinue\n\
         Remove-Item Env:ANTHROPIC_MODEL        -ErrorAction SilentlyContinue\n\
         Remove-Item Env:ANTHROPIC_SMALL_FAST_MODEL      -ErrorAction SilentlyContinue\n\
         Remove-Item Env:ANTHROPIC_DEFAULT_SONNET_MODEL  -ErrorAction SilentlyContinue\n\
         Remove-Item Env:ANTHROPIC_DEFAULT_OPUS_MODEL    -ErrorAction SilentlyContinue\n\
         Remove-Item Env:ANTHROPIC_DEFAULT_HAIKU_MODEL   -ErrorAction SilentlyContinue\n",
    );
}

if let Some(ref vars) = env_vars {
    for (k, v) in vars { /* unchanged */ }
}
```

**1.2 — `src/providers/testConnection.ts`**

O teste de conexão no frontend usa `fetch()` direto do webview — `ANTHROPIC_API_KEY` de sistema não afeta ele, mas o header `Authorization` precisa ser explícito:

- Usar `headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }` pra Anthropic-like
- Pra MiniMax/Z.AI (Anthropic-compatible endpoints), confirmar qual header eles aceitam (`x-api-key` vs `Authorization: Bearer`)
- Mensagem de erro amigável quando `Failed to fetch` (firewall, CORS, URL errada)

**1.3 — Novo botão "Reset Claude Code state" no AdminPanel**

`src/providers/AdminPanel.tsx` — seção "Diagnóstico":

- Botão executa comando Tauri que:
  - Roda `claude /logout` (ou equivalente — verificar CLI)
  - Remove chaves `customApiKeyResponses`, `oauthAccount`, `model` do `~/.claude.json` (preservando resto)
  - Mostra toast "Claude Code state resetado. Teste agora."
- Chamada Tauri: novo `#[tauri::command] fn reset_claude_state() -> Result<(), String>` em `main.rs`

**1.4 — Detecção proativa de conflito**

No ProviderSelector ou ProviderBadge: quando provider terceiro selecionado + `~/.claude.json` tem `oauthAccount`, mostrar aviso inline:

> ⚠️ Você tem OAuth Anthropic ativo. Clique em "Reset state" no Admin se der `Auth conflict` ao lançar.

---

## Trilha 2 — Reformulação Visual ("Terminal Refinado")

### Direção visual

- **Vibe**: terminal de alta-fidelidade. Dark premium. Sem gradientes decorativos, sem glass falso, sem emoji spam.
- **Fonte**: manter system UI sans, mas adicionar **JetBrains Mono Variable** (ou Fira Code) pra números/métricas/keyboard hints.
- **Motion**: compositor-only (transform + opacity), 150-300ms, ease-out expo. Respeitar `prefers-reduced-motion`.

### Tokens base (CSS custom properties)

Criar `src/styles/tokens.css`:

```css
:root {
  /* --- Superfícies (oklch p/ temperatura azul sutil) --- */
  --bg:        oklch(14% 0.015 240);
  --surface:  oklch(18% 0.015 240);
  --surface-2: oklch(22% 0.015 240);
  --surface-3: oklch(26% 0.015 240);
  --border:   oklch(30% 0.01 240);
  --border-strong: oklch(40% 0.01 240);

  /* --- Texto --- */
  --text:       oklch(95% 0.02 240);
  --text-muted: oklch(70% 0.02 240);
  --text-dim:   oklch(55% 0.02 240);

  /* --- Acento primário (esmeralda) --- */
  --accent:        oklch(68% 0.18 155);
  --accent-hover:  oklch(72% 0.18 155);
  --accent-dim:    oklch(30% 0.08 155);

  /* --- Semânticos --- */
  --success: oklch(70% 0.16 150);
  --warning: oklch(80% 0.15 85);
  --danger:  oklch(65% 0.22 25);
  --info:    oklch(70% 0.12 240);

  /* --- Escala espaçamento --- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;

  /* --- Tipografia (responsiva via clamp) --- */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-hero: clamp(24px, 1.2rem + 1vw, 32px);

  /* --- Radius --- */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-pill: 999px;

  /* --- Motion --- */
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-enter: 300ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  /* --- Shadows --- */
  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.3);
  --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.4);
  --shadow-lg: 0 12px 32px oklch(0% 0 0 / 0.5);
}
```

### Top 10 melhorias (tabela executiva)

| # | Item | Arquivos principais | Impacto | Esforço | Categoria |
|---|---|---|:-:|:-:|---|
| 1 | Tokenizar cores hardcoded de `providers.css` → usar vars do `tokens.css` | `src/providers/providers.css`, `src/styles.css` | 5 | 2 | Cor |
| 2 | `font-size` base 12→13px; abolir 8/9px; mínimo 10px pra metadata | `src/styles.css`, `src/providers/providers.css` | 5 | 2 | Tipografia |
| 3 | Redesign estado selecionado dos CLI cards (borda 2px + bg 20% + check) | `src/App.tsx`, `src/styles.css` | 5 | 2 | Component |
| 4 | Hierarquia `.section-title` (11px + letter-spacing 0.08em + separador) | `src/styles.css` | 4 | 1 | Tipografia |
| 5 | `PresetsBar` emojis → SVG monogramas com cor tokenizada | `src/presets/PresetsBar.tsx`, novo `icons/` | 4 | 3 | Component |
| 6 | `@media (max-width: 1100px)` → 1 coluna; grids 4→3 cols | `src/styles.css` | 4 | 2 | Layout |
| 7 | Tokenizar `border-radius` em 3 valores | todos CSS | 3 | 1 | Component |
| 8 | Harmonizar `CommandPalette` (input 18→15px, paddings) | `src/CommandPalette.css` | 3 | 1 | Component |
| 9 | `aria-label` em todos os botões icon-only | `src/App.tsx`, `AdminPanel.tsx`, `PresetsBar.tsx` | 3 | 2 | A11y |
| 10 | Tokens de motion em `providers.css` (remover magic numbers) | `src/providers/providers.css` | 2 | 1 | Motion |

---

## Sprint de execução (2 semanas, ordem determinística)

### Semana 1 — Fundação

- **Dia 1 (Trilha 1)** — Fix env conflict no `main.rs` + teste local (instala ADMIN build, tenta MiniMax, confirma que não dá `Auth conflict`)
- **Dia 1-2 (Trilha 2)** — Criar `src/styles/tokens.css`, importar no `main.tsx`. Começar migração das cores hardcoded (item #1). Zero regressão visual — só troca `#8B1E2A` por `var(--accent-dim)` etc.
- **Dia 2-3** — Item #2 (font-size base 13px). Testar cada tab (Lançar, Histórico, Custos, Admin) em 1280x860. Qualquer card que transbordar, ajustar padding.
- **Dia 3** — Trocar `--bg` e `--surface` pra versões oklch do tokens.css. Diff visual é sutil.
- **Dia 4** — Item #3 (selected state CLI cards). **E** Trilha 1.3: botão "Reset Claude Code state" no AdminPanel + comando Tauri `reset_claude_state`.
- **Dia 5** — Item #7 (tokenizar radius, unificar em 3 valores). Smoke test completo do release-candidate.

### Semana 2 — Acabamento

- **Dia 1** — Item #4 (section-title) + Item #8 (CommandPalette harmonizado). Teste Ctrl+P.
- **Dia 2** — Item #9 (aria-label em botões icon-only). Usar axe DevTools ou screen reader básico pra validar.
- **Dia 3** — Item #6 (media query responsiva). Testar 320/768/1024/1280/1440.
- **Dia 4** — Item #5 (`PresetsBar` monogramas SVG). Se apertar, MVP com letras monograma (sem SVG custom).
- **Dia 5** — Item #10 (tokens motion). QA visual full em dark + light. Release v5.1.0.

### Trilha 1 (fixes env) termina no Dia 1-4 da Semana 1 — bem antes da reformulação visual. Se der tempo, ship v5.0.2 intermediário com só esse fix; senão, vai tudo junto em 5.1.0.

---

## Guardrails

### Qualidade de código
- Rust: `cargo fmt && cargo clippy -- -D warnings` antes de cada commit
- TS: rodar `tsc --noEmit` após cada dia
- CSS: manter "no deep nesting >3 levels", usar BEM ou classes utilitárias com prefixo semântico
- Arquivos <800 linhas (monitorar `App.tsx` — já nas 1744, **NÃO crescer**, idealmente reduzir se extrair um componente for natural)

### Não quebrar
- Testar ambos os builds (public + admin) antes de taggar
- Verificar que `.env.local` não vai pro git
- Regenerar Cargo.lock localmente mas commitá-lo
- Smoke test: instalar .msi localmente e abrir, NÃO só rodar dev mode

### Performance
- Bundle JS gzipped < 300kb (app page budget) — medir com `npm run build` e comparar antes/depois
- Evitar animar `width`/`height`/`top`/`left` — só `transform`/`opacity`
- Adicionar `prefers-reduced-motion: reduce` override pra animações chamativas

### Security
- Zero secret no diff — scan com grep antes de cada commit (`sk-`, `glm_`, `MINIMAX_`, `Bearer`, `eyJ`)
- `.env.local` sempre removido antes de push
- Security-reviewer agent no diff do `main.rs` (env handling é sensível)

### Segurança semântica
- Versão 5.1.0 minor bump em: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- CHANGELOG.md: seção [5.1.0] com 3 subsections (Fixed / Changed / Added)
- Nenhuma mudança de schema, API, ou localStorage keys — perfis da v5.0.1 continuam lendo igual

---

## Validação antes do release v5.1.0

1. Instalar **AI-Launcher_5.1.0_ADMIN_x64-setup.exe** em máquina limpa
2. Cadastrar perfil MiniMax com API key real → clicar em Lançar Claude Code → **NÃO pode aparecer `Auth conflict`**
3. Cadastrar perfil Z.AI com API key real → clicar em Lançar Claude Code → **NÃO pode aparecer `Auth conflict`**
4. Selecionar perfil Anthropic oficial → Lançar → usa OAuth normalmente
5. Testar "Reset Claude Code state" → `/model` no Claude Code volta pra Default (Sonnet 4.6)
6. Abrir Admin Panel → CRUD de perfil custom → não quebrou
7. Ctrl+P (CommandPalette) → visual consistente com resto
8. Redimensionar janela pra 1100px → layout não quebra
9. Screen reader básico nos botões icon-only
10. `npm run build` → bundle size dentro do budget

---

## Releases planejados

- **v5.1.0** (minor) — reformulação visual + fix env conflict + reset state
- **v5.1.1** (patch) — qualquer hotfix pós-release
- **v5.2.0** (minor, futuro) — split do `App.tsx`, dark/light toggle, React 19 / Vite 8 / TS 6 (PRs #9-11)

---

## Fora do escopo da v5.1 (documentar mas não implementar)

- Refactor do `App.tsx` (1744 linhas)
- Dark/light mode toggle real
- Merge dos PRs Dependabot majors (#9, #10, #11)
- Landing page do projeto
- Code signing cert (Windows SmartScreen)
- Integração com mais providers (OpenRouter, Together, etc)
- i18n além de pt-BR

---

## Artefatos esperados ao final

- Commit(s) na branch `main` com `fix(v5.1.0): ...` e `feat(v5.1.0): ...`
- Tag `v5.1.0`
- Release GitHub com 4 binários (public + admin, exe + msi)
- CHANGELOG.md atualizado
- README (PT + EN) atualizado se algum fluxo visual mudou muito
- Este `docs/PLAN_v5.1.md` preservado no repo como documentação viva
