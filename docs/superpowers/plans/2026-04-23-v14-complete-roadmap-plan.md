# AI Launcher Pro v14 — Roadmap Completo de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar todos os bugs conhecidos da v13.5, fazer hardening estrutural (tests, error handling, modularização), e entregar 6 features novas pedidas pelo usuário, culminando numa release v14.0.0 estável e auditável.

**Architecture:** O plano é dividido em **5 sprints sequenciais** publicados como versões incrementais (v13.5.1 → v13.6 → v13.7 → v13.8 → v14.0). Cada sprint produz um artefato instalável e testável. Sprints 1-2 são obrigatórios (bugs + hardening); sprints 3-5 entregam features novas. A ordem segue o princípio "estabilizar antes de ampliar".

**Tech Stack:** Tauri 2.0, React 19.2.5, TypeScript 6, Vite 8, Rust (edition 2021), Vitest (novo), Playwright (novo), Zod (novo), `tauri-plugin-single-instance`, `tauri-plugin-autostart`, `tauri-plugin-notification`, `tauri-plugin-updater` (novos).

---

## Sumário dos Sprints

| Sprint | Versão | Tema | Tempo estimado |
|--------|--------|------|----------------|
| 1 | v13.5.1 | Hotfix dos 3 bugs reportados + housekeeping | 2h |
| 2 | v13.6.0 | Hardening: modularizar `main.rs`, error types, Vitest smoke, error boundaries | 6–8h |
| 3 | v13.7.0 | Qualidade de vida: auto-start, global hotkey, favoritos de diretório, session templates | 6h |
| 4 | v13.8.0 | Observabilidade: notificações de fim de sessão, filtros no histórico, export CSV, clipboard → prompt | 5h |
| 5 | v14.0.0 | Release major: self-updater do Launcher, accent color picker livre, CI hardening, docs, testes E2E | 6h |

**Total:** ~25-27 horas de trabalho dividido em ~55 tasks atômicas (2-5 min cada) + testes + commits.

---

## Convenções do plano

- **Diretório base:** `C:\Users\Helbert\Desktop\DevManiacs\ai-launcher-tutra`
- **Testes frontend:** `src/**/*.test.ts(x)` com Vitest (a ser adicionado no Sprint 2)
- **Testes backend:** `src-tauri/src/**/tests.rs` com `#[cfg(test)]` + `cargo test`
- **Commits:** conventional commits — `feat(v13.6): ...`, `fix(v13.5.1): ...`, `refactor(v13.6): ...`, `test(v13.6): ...`
- **Branch:** trabalhar em `main` (projeto solo). Em sprints 2+ criar branch `sprint/<n>-<tema>` e PR para main.
- **Cada sprint termina com:** bump de versão em 3 lugares (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`), entrada no `CHANGELOG.md`, tag `vX.Y.Z`, push `--tags`.

---

# SPRINT 1 — v13.5.1 Hotfix (2h)

Resolve os 3 bugs reportados + limpeza de arquivos órfãos. Sem features novas.

## Task 1.1 — Adicionar plugin `tauri-plugin-single-instance`

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs` (região do `tauri::Builder::default()`, ~linha 3040)

- [ ] **Step 1: Adicionar dependência ao Cargo.toml**

Abrir `src-tauri/Cargo.toml` e adicionar após a linha `tauri-plugin-global-shortcut = "2.0"`:

```toml
tauri-plugin-single-instance = "2.0"
```

- [ ] **Step 2: Registrar o plugin no builder**

Em `src-tauri/src/main.rs`, localizar `tauri::Builder::default()` e adicionar o plugin como PRIMEIRO plugin (antes dos demais), com callback que foca a janela existente:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }))
    .plugin(tauri_plugin_shell::init())
    // ... demais plugins existentes
```

- [ ] **Step 3: Verificar build**

Run: `cd src-tauri && cargo check`
Expected: compilação limpa, sem warnings relacionados ao novo plugin

- [ ] **Step 4: Smoke test manual**

Run: `npm run tauri dev`
Abrir o `.exe` 3 vezes em sequência. Esperado: apenas 1 janela + 1 ícone na bandeja. 2º e 3º launches apenas focam a janela existente.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/main.rs
git commit -m "fix(v13.5.1): single-instance guard prevents duplicate tray icons"
```

## Task 1.2 — Corrigir CSS do dropdown de diretórios recentes

**Files:**
- Modify: `src/features/launcher/LauncherPage.css:113-129`

- [ ] **Step 1: Aumentar z-index e garantir background sólido**

Localizar bloco `.cd-launch-dialog__recent-list` em `src/features/launcher/LauncherPage.css` (linha 114) e substituir por:

```css
.cd-launch-dialog__field:has(.cd-launch-dialog__recent-list) {
  position: relative;
  z-index: 20;
}
.cd-launch-dialog__recent-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  max-height: 220px;
  overflow-y: auto;
  margin-top: 2px;
  padding: 2px 0;
  list-style: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
}
```

- [ ] **Step 2: Smoke test manual**

Run: `npm run tauri dev`
Abrir Launcher → clicar em Launch de um CLI → dar focus no input de diretório. Esperado: dropdown aparece com fundo sólido, sem bleed com os campos args/toggle abaixo.

- [ ] **Step 3: Commit**

```bash
git add src/features/launcher/LauncherPage.css
git commit -m "fix(v13.5.1): recent dirs dropdown z-index + solid background"
```

## Task 1.3 — Corrigir legibilidade do Provider selector no tema dark

**Files:**
- Modify: `src/features/launcher/LauncherPage.css:81-102`

- [ ] **Step 1: Trocar token inválido e adicionar styling para option**

Localizar bloco `.cd-launch-dialog__select` em `src/features/launcher/LauncherPage.css` (linha 81). Trocar `var(--surface)` por `var(--surface-1)` na linha 84, e adicionar regra nova para `<option>` logo após o bloco `:focus`:

```css
.cd-launch-dialog__select {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface-1);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-dim) 50%),
    linear-gradient(135deg, var(--text-dim) 50%, transparent 50%);
  background-position: calc(100% - 16px) 50%, calc(100% - 11px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 28px;
}
.cd-launch-dialog__select:focus {
  outline: none;
  border-color: var(--accent);
}
.cd-launch-dialog__select option {
  background: var(--surface-1);
  color: var(--text);
  padding: 6px 10px;
}
```

- [ ] **Step 2: Smoke test manual dark + light**

Run: `npm run tauri dev`
Abrir Launch Dialog do Claude → conferir selector de provider em ambos os temas. Esperado: texto legível, opções abertas também legíveis.

- [ ] **Step 3: Commit**

```bash
git add src/features/launcher/LauncherPage.css
git commit -m "fix(v13.5.1): provider select readable in dark theme"
```

## Task 1.4 — Housekeeping: untracked files

**Files:**
- Modify: `.gitignore`
- Delete: `icon-chooser.html`, `icon-preview.html`, `AUDITORIA_VPS_200.142.226.15.md`
- Move: `docs/PRD-v12.md` → `docs/archive/PRD-v12.md`

- [ ] **Step 1: Adicionar `.playwright-mcp/` ao .gitignore**

Abrir `.gitignore` e acrescentar no final:

```
# Tooling caches
.playwright-mcp/
```

- [ ] **Step 2: Remover arquivos órfãos**

```bash
rm icon-chooser.html icon-preview.html AUDITORIA_VPS_200.142.226.15.md
mkdir -p docs/archive
mv docs/PRD-v12.md docs/archive/PRD-v12.md
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore docs/archive/ -A
git commit -m "chore(v13.5.1): remove scaffolding files, archive PRD-v12, gitignore .playwright-mcp"
```

## Task 1.5 — Bump de versão e release v13.5.1

**Files:**
- Modify: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `CHANGELOG.md`

- [ ] **Step 1: Atualizar 3 arquivos de versão para 13.5.1**

```bash
# package.json: "version": "13.5.1"
# src-tauri/tauri.conf.json: "version": "13.5.1"
# src-tauri/Cargo.toml: version = "13.5.1"
```

- [ ] **Step 2: Adicionar entrada no CHANGELOG.md**

Abrir `CHANGELOG.md` e inserir entre o cabeçalho e a entrada `[13.5.0]`:

```markdown
## [13.5.1] — 2026-04-23 — Hotfix

### Fixed
- **Multiple tray icons** — Added `tauri-plugin-single-instance` guard. Reopening the app now focuses the existing window instead of spawning a new process with a new tray icon.
- **Recent directories dropdown bleed-through** — Increased z-index to 100, added solid background and backdrop-filter; parent field now establishes stacking context.
- **Provider selector unreadable in dark theme** — Replaced invalid `var(--surface)` token with `var(--surface-1)` and added explicit `option` styling for cross-browser consistency.

### Changed
- Version bumped to 13.5.1 across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- Archived `docs/PRD-v12.md` → `docs/archive/PRD-v12.md`.
- Removed scaffolding files (`icon-chooser.html`, `icon-preview.html`, audit notes).
```

- [ ] **Step 3: Verificar build completo**

Run: `npm run tauri build -- --debug`
Expected: build sucede, `.msi`/`.exe` gerado em `src-tauri/target/debug/bundle/`

- [ ] **Step 4: Commit, tag e push**

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md
git commit -m "chore(v13.5.1): bump version"
git tag v13.5.1
git push origin main --tags
```

- [ ] **Step 5: Criar release no GitHub**

```bash
gh release create v13.5.1 --title "v13.5.1 — Hotfix" --notes-from-tag
```

---

# SPRINT 2 — v13.6.0 Hardening Estrutural (6-8h)

Modulariza `main.rs`, adiciona testes mínimos, error boundaries, Zod validator. Zero features novas.

## Task 2.1 — Estabelecer estrutura modular do backend

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/cli.rs`
- Create: `src-tauri/src/commands/tools.rs`
- Create: `src-tauri/src/commands/updates.rs`
- Create: `src-tauri/src/commands/config.rs`
- Create: `src-tauri/src/commands/system.rs`
- Create: `src-tauri/src/tray.rs`
- Create: `src-tauri/src/errors.rs`
- Create: `src-tauri/src/util.rs`
- Modify: `src-tauri/src/main.rs` (reduz para <200 linhas, vira orquestrador)
- Modify: `src-tauri/Cargo.toml` (adicionar `thiserror`)

- [ ] **Step 1: Adicionar `thiserror` como dependência**

Em `src-tauri/Cargo.toml`, acrescentar na seção `[dependencies]`:

```toml
thiserror = "1.0"
```

- [ ] **Step 2: Criar `src-tauri/src/errors.rs`**

```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("command not found: {0}")]
    CommandNotFound(String),
    #[error("timeout after {0}ms")]
    Timeout(u64),
    #[error("process error: {0}")]
    Process(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("http error: {0}")]
    Http(String),
    #[error("invalid config: {0}")]
    InvalidConfig(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

- [ ] **Step 3: Extrair utils genéricos para `src-tauri/src/util.rs`**

Mover de `main.rs` para `util.rs` as funções: `strip_ansi`, `parse_version`, `resolve_windows_cmd`, `run_with_timeout`. Marcar todas como `pub`. Adicionar bloco `#[cfg(test)] mod tests` no final (tests serão preenchidos na Task 2.2).

- [ ] **Step 4: Extrair comandos de CLI para `src-tauri/src/commands/cli.rs`**

Mover para esse arquivo: `get_all_clis`, `check_clis`, `check_cli_updates`, `update_cli`, `update_all_clis`, `install_cli`, `launch_cli`, `launch_multi_clis`, `launch_custom_cli`. Manter assinaturas exatas dos `#[tauri::command]`. Importar utils de `crate::util::*`.

- [ ] **Step 5: Extrair comandos de Tools para `src-tauri/src/commands/tools.rs`**

Mover: `get_all_tools`, `check_tools`, `install_tool`, `launch_tool`, `launch_custom_ide`.

- [ ] **Step 6: Extrair comandos de Updates para `src-tauri/src/commands/updates.rs`**

Mover: `check_all_updates`, `check_latest_release`, `check_tool_updates`, `check_env_updates`, `install_prerequisite`, `update_prerequisite`, `check_environment`.

- [ ] **Step 7: Extrair comandos de Config para `src-tauri/src/commands/config.rs`**

Mover: `reset_all_config`, `reset_claude_state`, `test_provider_connection`, `read_usage_stats`, `save_crash_log`, `read_crash_log`.

- [ ] **Step 8: Extrair comandos de System para `src-tauri/src/commands/system.rs`**

Mover: `open_external_url`, `open_in_explorer`, `open_crash_dir`, `get_tray_hotkey`, `set_tray_hotkey`, `get_minimize_to_tray`, `set_minimize_to_tray`.

- [ ] **Step 9: Criar `src-tauri/src/commands/mod.rs`**

```rust
pub mod cli;
pub mod config;
pub mod system;
pub mod tools;
pub mod updates;
```

- [ ] **Step 10: Extrair tray para `src-tauri/src/tray.rs`**

Mover toda a lógica de `TrayIconBuilder` + `MenuItem` + handlers de click/menu para esse arquivo. Exportar função `pub fn setup_tray(app: &tauri::App) -> AppResult<()>`.

- [ ] **Step 11: Simplificar `main.rs`**

Reescrever `main.rs` para <200 linhas — apenas `main()` + `tauri::Builder` + lista de `invoke_handler![...]` referenciando `commands::cli::*`, `commands::tools::*`, etc. + chamada a `tray::setup_tray(app)` em `.setup()`.

- [ ] **Step 12: Build e smoke test**

Run: `cd src-tauri && cargo check && cargo clippy -- -D warnings`
Expected: zero erros, zero warnings. Se clippy reclamar, corrigir inline.

Run: `npm run tauri dev`
Expected: todas as features funcionam idênticas à v13.5.1 (regression check manual).

- [ ] **Step 13: Commit (uma mudança grande, commit único)**

```bash
git add src-tauri/
git commit -m "refactor(v13.6): split monolithic main.rs into commands/, tray, errors, util modules"
```

## Task 2.2 — Adicionar testes Rust básicos

**Files:**
- Modify: `src-tauri/src/util.rs` (adicionar bloco `#[cfg(test)]`)

- [ ] **Step 1: Escrever testes para `strip_ansi` e `parse_version`**

No final de `src-tauri/src/util.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_ansi_removes_color_codes() {
        assert_eq!(strip_ansi("\x1b[31mred\x1b[0m"), "red");
        assert_eq!(strip_ansi("\x1b[1;32mbold green\x1b[0m text"), "bold green text");
        assert_eq!(strip_ansi("plain"), "plain");
    }

    #[test]
    fn parse_version_extracts_semver() {
        assert_eq!(parse_version("v1.2.3"), Some("1.2.3".to_string()));
        assert_eq!(parse_version("claude-code 0.4.1"), Some("0.4.1".to_string()));
        assert_eq!(parse_version("no version here"), None);
    }

    #[test]
    fn parse_version_handles_pre_release() {
        assert_eq!(parse_version("2.0.0-beta.1"), Some("2.0.0-beta.1".to_string()));
    }
}
```

- [ ] **Step 2: Rodar testes**

Run: `cd src-tauri && cargo test`
Expected: 3 testes passam.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/util.rs
git commit -m "test(v13.6): add unit tests for strip_ansi and parse_version"
```

## Task 2.3 — Instalar Vitest e escrever smoke tests frontend

**Files:**
- Modify: `package.json` (adicionar Vitest + @testing-library/react)
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/features/launcher/history.test.ts`
- Create: `src/features/launcher/useRecentDirs.test.ts` (se separado; senão inline em history.test.ts)

- [ ] **Step 1: Instalar dependências de teste**

Run:
```bash
npm install --save-dev --legacy-peer-deps vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 3: Criar `src/test/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Stub Tauri invoke globally
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
```

- [ ] **Step 4: Adicionar script ao package.json**

Em `package.json`, na seção `"scripts"`, adicionar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Escrever teste para `history.ts` (recent dirs)**

Criar `src/features/launcher/history.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getRecentDirs, addRecentDir, RECENT_DIRS_KEY } from "./history";

describe("recent dirs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(getRecentDirs("claude")).toEqual([]);
  });

  it("adds and retrieves a directory", () => {
    addRecentDir("claude", "C:\\projects\\foo");
    expect(getRecentDirs("claude")).toEqual(["C:\\projects\\foo"]);
  });

  it("deduplicates the same directory", () => {
    addRecentDir("claude", "C:\\a");
    addRecentDir("claude", "C:\\a");
    expect(getRecentDirs("claude")).toEqual(["C:\\a"]);
  });

  it("keeps most recent at the top (LRU)", () => {
    addRecentDir("claude", "C:\\a");
    addRecentDir("claude", "C:\\b");
    addRecentDir("claude", "C:\\a");
    expect(getRecentDirs("claude")).toEqual(["C:\\a", "C:\\b"]);
  });

  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) addRecentDir("claude", `C:\\dir${i}`);
    expect(getRecentDirs("claude")).toHaveLength(10);
    expect(getRecentDirs("claude")[0]).toBe("C:\\dir14");
  });
});
```

- [ ] **Step 6: Rodar testes**

Run: `npm test`
Expected: 5 testes passam (criar o API de `addRecentDir`/`RECENT_DIRS_KEY` se não existir como export; atualmente está inline em `useHistory.ts` — extrair se necessário).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/ src/features/launcher/history.test.ts
git commit -m "test(v13.6): add Vitest + smoke tests for recent dirs LRU"
```

## Task 2.4 — Adicionar Zod validation em configIO

**Files:**
- Modify: `package.json` (instalar zod)
- Modify: `src/lib/configIO.ts` (adicionar schema + validation)
- Create: `src/lib/configIO.test.ts`

- [ ] **Step 1: Instalar zod**

```bash
npm install --save --legacy-peer-deps zod
```

- [ ] **Step 2: Definir schema em `src/lib/configIO.ts`**

Adicionar no topo do arquivo:

```typescript
import { z } from "zod";

const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

const ConfigExportSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  providers: z.array(ProviderSchema).optional(),
  presets: z.array(z.unknown()).optional(),
  customIdes: z.array(z.unknown()).optional(),
  cliOverrides: z.record(z.unknown()).optional(),
  appearance: z.unknown().optional(),
});

export type ConfigExport = z.infer<typeof ConfigExportSchema>;
```

- [ ] **Step 3: Validar antes de aplicar na função `importConfig`**

Na função existente `importConfig(data: unknown)`, adicionar como primeira linha:

```typescript
const parsed = ConfigExportSchema.safeParse(data);
if (!parsed.success) {
  throw new Error(`Config inválida: ${parsed.error.issues[0].message}`);
}
const config = parsed.data;
// ... resto da função usa `config` em vez de `data`
```

- [ ] **Step 4: Escrever teste `src/lib/configIO.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { importConfig } from "./configIO";

describe("importConfig", () => {
  it("rejects non-object input", () => {
    expect(() => importConfig("not an object" as unknown)).toThrow(/inválida/);
  });

  it("rejects missing version", () => {
    expect(() => importConfig({ providers: [] })).toThrow(/inválida/);
  });

  it("rejects provider with bad url", () => {
    const bad = {
      version: "1",
      exportedAt: "2026-04-23",
      providers: [{ id: "x", name: "x", baseUrl: "not-a-url" }],
    };
    expect(() => importConfig(bad)).toThrow(/inválida/);
  });

  it("accepts minimal valid config", () => {
    const good = { version: "1", exportedAt: "2026-04-23" };
    expect(() => importConfig(good)).not.toThrow();
  });
});
```

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: 4 novos testes passam.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/configIO.ts src/lib/configIO.test.ts
git commit -m "feat(v13.6): zod schema validation for config import"
```

## Task 2.5 — Error Boundary global

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/components/ErrorBoundary.css`
- Modify: `src/App.tsx` (envolver árvore principal)
- Modify: `src/i18n/locales/en.ts` e `pt-BR.ts` (chaves `errorBoundary.*`)

- [ ] **Step 1: Criar componente ErrorBoundary**

`src/components/ErrorBoundary.tsx`:

```tsx
import { Component, ErrorInfo, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (this.state.error) {
      return this.props.fallback ?? <ErrorFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="cd-error-boundary">
      <h2>{t("errorBoundary.title")}</h2>
      <p>{t("errorBoundary.message")}</p>
      <pre className="cd-error-boundary__details">{error.message}</pre>
      <button className="cd-error-boundary__button" onClick={reset}>
        {t("errorBoundary.retry")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/components/ErrorBoundary.css`**

```css
.cd-error-boundary {
  padding: 24px;
  background: var(--surface-1);
  border: 1px solid var(--err);
  border-radius: var(--r-md);
  margin: 16px;
}
.cd-error-boundary h2 { color: var(--err); margin: 0 0 8px; }
.cd-error-boundary__details {
  background: var(--surface-2);
  padding: 12px;
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  overflow-x: auto;
}
.cd-error-boundary__button {
  margin-top: 12px;
  padding: 6px 12px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
}
```

- [ ] **Step 3: Adicionar chaves i18n**

Em `src/i18n/locales/en.ts`, adicionar no objeto raiz:

```typescript
errorBoundary: {
  title: "Something went wrong",
  message: "A UI error was caught. You can retry or restart the app.",
  retry: "Retry",
},
```

Em `src/i18n/locales/pt-BR.ts`:

```typescript
errorBoundary: {
  title: "Algo deu errado",
  message: "Um erro de UI foi capturado. Você pode tentar novamente ou reiniciar o app.",
  retry: "Tentar novamente",
},
```

- [ ] **Step 4: Envolver a árvore no App.tsx**

Em `src/App.tsx`, importar `ErrorBoundary` e envolver o conteúdo do return:

```tsx
import { ErrorBoundary } from "./components/ErrorBoundary";

// ... dentro do return:
return (
  <ErrorBoundary>
    {/* ... restante do JSX existente ... */}
  </ErrorBoundary>
);
```

- [ ] **Step 5: Smoke test manual**

Temporariamente jogar um `throw new Error("boom")` dentro de um componente filho. Rodar `npm run tauri dev`. Esperado: tela de fallback com mensagem, não tela branca. Reverter o throw.

- [ ] **Step 6: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/components/ErrorBoundary.css src/App.tsx src/i18n/locales/
git commit -m "feat(v13.6): global error boundary with i18n fallback"
```

## Task 2.6 — Refactor LaunchDialog para useReducer

**Files:**
- Modify: `src/features/launcher/LaunchDialog.tsx`

- [ ] **Step 1: Definir tipo de state e reducer**

No topo de `LaunchDialog.tsx`, antes do componente:

```typescript
interface LaunchState {
  directory: string;
  args: string;
  noPerms: boolean;
  providerId: string;
  showRecent: boolean;
  launching: boolean;
  error: string | null;
}

type LaunchAction =
  | { type: "setDirectory"; value: string }
  | { type: "setArgs"; value: string }
  | { type: "setNoPerms"; value: boolean }
  | { type: "setProviderId"; value: string }
  | { type: "setShowRecent"; value: boolean }
  | { type: "startLaunch" }
  | { type: "launchFailed"; error: string }
  | { type: "reset"; directory: string; providerId: string };

function launchReducer(s: LaunchState, a: LaunchAction): LaunchState {
  switch (a.type) {
    case "setDirectory": return { ...s, directory: a.value };
    case "setArgs": return { ...s, args: a.value };
    case "setNoPerms": return { ...s, noPerms: a.value };
    case "setProviderId": return { ...s, providerId: a.value };
    case "setShowRecent": return { ...s, showRecent: a.value };
    case "startLaunch": return { ...s, launching: true, error: null };
    case "launchFailed": return { ...s, launching: false, error: a.error };
    case "reset": return { ...s, directory: a.directory, args: "", noPerms: true, providerId: a.providerId, error: null };
  }
}
```

- [ ] **Step 2: Substituir os 11 useState por um único useReducer**

Dentro do componente, remover todos os `useState` de state de formulário e substituir por:

```typescript
const [state, dispatch] = useReducer(launchReducer, {
  directory: initialDir ?? "",
  args: "",
  noPerms: true,
  providerId: initialProviderId ?? "",
  showRecent: false,
  launching: false,
  error: null,
});
```

Atualizar todos os `setDirectory(x)` → `dispatch({ type: "setDirectory", value: x })`, etc.

- [ ] **Step 3: Build + regression manual**

Run: `npm run tauri dev`
Expected: LaunchDialog funciona idêntico (abre/fecha, escolhe dir, muda provider, lança, mostra erro).

- [ ] **Step 4: Commit**

```bash
git add src/features/launcher/LaunchDialog.tsx
git commit -m "refactor(v13.6): LaunchDialog state via useReducer (11 useState -> 1)"
```

## Task 2.7 — Bump, changelog, tag v13.6.0

- [ ] **Step 1: Bump de versões**

Trocar `13.5.1` → `13.6.0` em:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

- [ ] **Step 2: Entrada no CHANGELOG.md**

```markdown
## [13.6.0] — 2026-04-24 — Hardening Release

### Added
- **Error Boundary** global com i18n EN/pt-BR — crashes de UI não derrubam mais o app inteiro.
- **Zod validation** na importação de config — rejeita shapes inválidos com mensagem clara.
- **Vitest + Rust tests** — smoke coverage inicial para `recent-dirs`, `configIO`, `strip_ansi`, `parse_version`.
- **thiserror** no backend — errors tipados em `commands/*.rs` em vez de `String` genéricos.

### Changed
- **Backend modularizado** — `main.rs` reduzido de 3.105 → ~180 linhas. Comandos agora em `commands/{cli,tools,updates,config,system}.rs`, tray em `tray.rs`, utils em `util.rs`, errors em `errors.rs`.
- **LaunchDialog** migrado para `useReducer` (11 `useState` consolidados em 1 state machine).
```

- [ ] **Step 3: Build release + commit + tag**

```bash
npm run tauri build
git add .
git commit -m "chore(v13.6): bump version to 13.6.0"
git tag v13.6.0
git push origin main --tags
gh release create v13.6.0 --title "v13.6.0 — Hardening" --notes-from-tag
```

---

# SPRINT 3 — v13.7.0 Qualidade de Vida (6h)

Features que tornam o app mais confortável: auto-start, hotkey global, favoritos, templates.

## Task 3.1 — Auto-start com Windows (opt-in)

**Files:**
- Modify: `src-tauri/Cargo.toml` (adicionar `tauri-plugin-autostart`)
- Modify: `src-tauri/src/main.rs` (registrar plugin)
- Modify: `src-tauri/tauri.conf.json` (adicionar permissões)
- Create: `src/features/admin/sections/AutoStartToggle.tsx`
- Modify: `src/features/admin/sections/AppearanceSection.tsx` (incluir toggle)
- Modify: `src/i18n/locales/*.ts` (chaves `admin.autostart.*`)

- [ ] **Step 1: Adicionar plugin**

Em `Cargo.toml`:
```toml
tauri-plugin-autostart = "2.0"
```

Em `src-tauri/src/main.rs`:
```rust
.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    Some(vec!["--minimized"]),
))
```

- [ ] **Step 2: Criar componente toggle**

`src/features/admin/sections/AutoStartToggle.tsx`:

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Toggle } from "../../../components/Toggle";

export function AutoStartToggle() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<boolean>("plugin:autostart|is_enabled")
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (v: boolean) => {
    await invoke(v ? "plugin:autostart|enable" : "plugin:autostart|disable");
    setEnabled(v);
  };

  if (loading) return null;
  return (
    <Toggle
      checked={enabled}
      onChange={toggle}
      label={
        <span>
          <span>{t("admin.autostart.label")}</span>
          <span className="cd-muted">{t("admin.autostart.hint")}</span>
        </span>
      }
    />
  );
}
```

- [ ] **Step 3: Integrar no AppearanceSection**

Adicionar `<AutoStartToggle />` dentro da seção, após o language switcher.

- [ ] **Step 4: Adicionar chaves i18n**

en: `admin.autostart.label = "Launch at Windows startup"`, `admin.autostart.hint = "Starts minimized to tray"`
pt-BR: `admin.autostart.label = "Iniciar com o Windows"`, `admin.autostart.hint = "Abre minimizado na bandeja"`

- [ ] **Step 5: Teste manual**

Ligar toggle → reiniciar Windows (ou via `Task Scheduler`) → confirmar que app sobe minimizado. Desligar → reiniciar → confirmar que não sobe.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(v13.7): autostart with Windows toggle in Admin → Appearance"
```

## Task 3.2 — Global hotkey para focar janela

**Files:**
- Modify: `src-tauri/src/main.rs` ou `src-tauri/src/tray.rs` (registrar shortcut)
- Modify: `src-tauri/tauri.conf.json` (permissão)
- Modify: `src/features/admin/sections/AppearanceSection.tsx` (input para editar hotkey)

- [ ] **Step 1: Registrar hotkey default `Ctrl+Alt+L`**

Em `.setup()` do builder Rust:

```rust
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

let alt_l = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyL);
app.handle().plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, shortcut, event| {
            if event.state == ShortcutState::Pressed && shortcut == &alt_l {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .with_shortcut(alt_l)?
        .build(),
)?;
```

- [ ] **Step 2: Expor command `set_hotkey` e `get_hotkey`**

Em `commands/system.rs`, reaproveitar os já existentes `get_tray_hotkey` / `set_tray_hotkey` OU criar `get_open_hotkey` / `set_open_hotkey` para persistir em arquivo de config (ex: `%APPDATA%/ai-launcher/hotkey.txt`).

- [ ] **Step 3: UI para customizar no Admin**

Adicionar em `AppearanceSection.tsx`:

```tsx
<HotkeyInput
  value={hotkey}
  onChange={setHotkey}
  label={t("admin.hotkey.label")}
  hint={t("admin.hotkey.hint")}
/>
```

- [ ] **Step 4: Teste manual**

Minimizar app → pressionar `Ctrl+Alt+L` em qualquer lugar do Windows. Esperado: janela volta ao foco.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(v13.7): global hotkey Ctrl+Alt+L to focus window (customizable)"
```

## Task 3.3 — Favoritos/Pins de diretório

**Files:**
- Create: `src/features/launcher/pinnedDirs.ts`
- Modify: `src/features/launcher/LaunchDialog.tsx` (mostrar pins em seção separada)
- Modify: `src/features/launcher/CliCard.tsx` (mostrar pins nos quick-launch)
- Create: `src/features/launcher/pinnedDirs.test.ts`

- [ ] **Step 1: Criar API de pins**

`src/features/launcher/pinnedDirs.ts`:

```typescript
const KEY = (cli: string) => `ai-launcher:pinned-dirs:${cli}`;
const MAX = 3;

export function getPinnedDirs(cli: string): string[] {
  try {
    const raw = localStorage.getItem(KEY(cli));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pinDir(cli: string, dir: string): void {
  const current = getPinnedDirs(cli);
  if (current.includes(dir)) return;
  if (current.length >= MAX) return;
  localStorage.setItem(KEY(cli), JSON.stringify([...current, dir]));
}

export function unpinDir(cli: string, dir: string): void {
  const current = getPinnedDirs(cli).filter((d) => d !== dir);
  localStorage.setItem(KEY(cli), JSON.stringify(current));
}

export function isPinned(cli: string, dir: string): boolean {
  return getPinnedDirs(cli).includes(dir);
}
```

- [ ] **Step 2: Escrever teste** (RED)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getPinnedDirs, pinDir, unpinDir, isPinned } from "./pinnedDirs";

describe("pinned dirs", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => expect(getPinnedDirs("claude")).toEqual([]));
  it("pins and reads back", () => {
    pinDir("claude", "C:\\a");
    expect(getPinnedDirs("claude")).toEqual(["C:\\a"]);
  });
  it("prevents duplicates", () => {
    pinDir("claude", "C:\\a");
    pinDir("claude", "C:\\a");
    expect(getPinnedDirs("claude")).toHaveLength(1);
  });
  it("caps at 3", () => {
    pinDir("claude", "C:\\a"); pinDir("claude", "C:\\b");
    pinDir("claude", "C:\\c"); pinDir("claude", "C:\\d");
    expect(getPinnedDirs("claude")).toHaveLength(3);
  });
  it("unpins", () => {
    pinDir("claude", "C:\\a");
    unpinDir("claude", "C:\\a");
    expect(isPinned("claude", "C:\\a")).toBe(false);
  });
});
```

Run: `npm test` → 5 passam.

- [ ] **Step 3: UI — Botão pin no dropdown de recentes**

Em `LaunchDialog.tsx`, cada item do dropdown ganha um botão `📌`:

```tsx
<li className="cd-launch-dialog__recent-item">
  <span>📁</span>
  <span>{d}</span>
  <button
    className="cd-launch-dialog__pin-btn"
    onClick={(e) => {
      e.stopPropagation();
      isPinned(cli.key, d) ? unpinDir(cli.key, d) : pinDir(cli.key, d);
    }}
  >
    {isPinned(cli.key, d) ? "📌" : "📍"}
  </button>
</li>
```

- [ ] **Step 4: Mostrar pins em `CliCard.tsx` acima dos recents**

```tsx
{pinned.length > 0 && (
  <div className="cd-cli-card__pinned">
    {pinned.map((d) => <QuickLaunchChip key={d} dir={d} pinned />)}
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(v13.7): pin up to 3 favorite directories per CLI"
```

## Task 3.4 — Session templates

**Files:**
- Create: `src/features/launcher/sessionTemplates.ts`
- Create: `src/features/launcher/SessionTemplatesPanel.tsx`
- Modify: `src/features/launcher/LaunchDialog.tsx` (botão "Salvar como template")
- Modify: `src/features/launcher/LauncherPage.tsx` (exibir painel de templates)
- Create: `src/features/launcher/sessionTemplates.test.ts`

- [ ] **Step 1: Definir tipo e API**

`src/features/launcher/sessionTemplates.ts`:

```typescript
export interface SessionTemplate {
  id: string;
  name: string;
  cli: string;
  directory: string;
  args: string;
  noPerms: boolean;
  providerId: string | null;
  createdAt: string;
}

const KEY = "ai-launcher:session-templates";

export function getTemplates(): SessionTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionTemplate[]) : [];
  } catch { return []; }
}

export function saveTemplate(t: Omit<SessionTemplate, "id" | "createdAt">): SessionTemplate {
  const full: SessionTemplate = {
    ...t,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([full, ...getTemplates()]));
  return full;
}

export function deleteTemplate(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getTemplates().filter((x) => x.id !== id)));
}
```

- [ ] **Step 2: Testes** (skip body aqui — mesmo padrão dos testes de pins, cobrindo getTemplates/saveTemplate/deleteTemplate)

- [ ] **Step 3: Painel no LauncherPage**

Criar `SessionTemplatesPanel.tsx` que lista templates, cada um com botão "Launch" e "Remove". Integrar acima dos CliCards ou em tab separada.

- [ ] **Step 4: Botão "Save as template" no LaunchDialog**

Adicionar botão de ícone disquete no footer do Dialog que chama `saveTemplate` com state atual.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(v13.7): session templates — save launch config as reusable preset"
```

## Task 3.5 — Bump, changelog, tag v13.7.0

Mesmo padrão da Task 1.5 / 2.7.

Entrada do CHANGELOG:

```markdown
## [13.7.0] — 2026-04-24 — Quality-of-Life Release

### Added
- **Autostart with Windows** (opt-in) — Admin → Appearance toggle. App starts minimized to tray.
- **Global hotkey** — Default `Ctrl+Alt+L` focuses the window from anywhere. Customizable in Admin.
- **Pinned directories** — Pin up to 3 favorite dirs per CLI, shown above recent dirs on every CliCard.
- **Session templates** — Save a full launch config (CLI + dir + args + provider + flags) as a reusable template.
```

---

# SPRINT 4 — v13.8.0 Observabilidade (5h)

Notificações, filtros de histórico, export e clipboard integration.

## Task 4.1 — Notificações nativas de fim de sessão

**Files:**
- Modify: `src-tauri/Cargo.toml` (adicionar `tauri-plugin-notification`)
- Modify: `src-tauri/src/main.rs` (registrar plugin)
- Modify: `src-tauri/src/commands/cli.rs` (emitir notification após `launch_cli` terminar, se configurado)
- Modify: `src/features/admin/sections/AppearanceSection.tsx` (toggle ligar/desligar)

- [ ] **Step 1: Adicionar plugin**

`tauri-plugin-notification = "2.0"` no Cargo.toml, `.plugin(tauri_plugin_notification::init())` no builder.

- [ ] **Step 2: Emitir notification quando processo termina**

Em `commands/cli.rs`, nos launchers que usam `tokio::process::Command`, após `.wait().await`:

```rust
use tauri_plugin_notification::NotificationExt;
if should_notify(&app) {
    app.notification()
        .builder()
        .title(format!("{} sessão encerrada", cli_name))
        .body(format!("Duração: {}", duration))
        .show()?;
}
```

- [ ] **Step 3: Toggle de configuração**

Adicionar em `AppearanceSection.tsx` toggle `notifications.onSessionEnd` persistido em localStorage; passar estado para Rust via novo comando ou ler de localStorage direto no front e emitir notification do lado JS via `tauri-apps/plugin-notification`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(v13.8): native notifications when CLI session ends (opt-in)"
```

## Task 4.2 — Filtros no histórico

**Files:**
- Modify: `src/features/history/HistoryPage.tsx`
- Modify: `src/features/history/HistoryPage.css`
- Modify: `src/i18n/locales/*.ts`

- [ ] **Step 1: Adicionar estado de filtros no HistoryPage**

```typescript
const [filterCli, setFilterCli] = useState<string>("all");
const [filterProvider, setFilterProvider] = useState<string>("all");
const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");

const filtered = useMemo(() =>
  history.filter((h) => {
    if (filterCli !== "all" && h.cli !== filterCli) return false;
    if (filterProvider !== "all" && h.providerId !== filterProvider) return false;
    if (dateRange !== "all" && !inRange(h.timestamp, dateRange)) return false;
    return true;
  }), [history, filterCli, filterProvider, dateRange]);
```

- [ ] **Step 2: UI de filtros**

Barra acima da lista com 3 `<select>` + botão "Clear filters".

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(v13.8): history filters by CLI / provider / date range"
```

## Task 4.3 — Export CSV/JSON de usage stats

**Files:**
- Modify: `src/features/costs/CostsPage.tsx`
- Create: `src/lib/exportCsv.ts`

- [ ] **Step 1: Utilitário de CSV**

`src/lib/exportCsv.ts`:

```typescript
export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Botões no CostsPage**

Dois botões: "Export CSV" e "Export JSON". Chamam `downloadBlob(toCsv(stats), "usage.csv", "text/csv")` ou JSON equivalente.

- [ ] **Step 3: Teste unitário do toCsv**

`src/lib/exportCsv.test.ts` com 3 casos: empty, single row, escape de aspas.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(v13.8): export usage stats as CSV or JSON"
```

## Task 4.4 — Clipboard → initial prompt

**Files:**
- Modify: `src/features/launcher/LaunchDialog.tsx`
- Modify: `src/i18n/locales/*.ts`

- [ ] **Step 1: Adicionar toggle "Pass clipboard as initial prompt"**

Aparece só para CLIs que aceitam `-p` ou arg inicial (Claude, Codex, Gemini). Quando ligado, antes de launch chama:

```typescript
const clip = await navigator.clipboard.readText();
if (clip.trim()) finalArgs += ` -p ${JSON.stringify(clip)}`;
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(v13.8): optional clipboard-to-prompt at launch time"
```

## Task 4.5 — Bump, changelog, tag v13.8.0

Padrão sprints anteriores.

---

# SPRINT 5 — v14.0.0 Release Major (6h)

Self-updater, color picker livre, CI hardening, E2E tests, docs.

## Task 5.1 — Self-updater via tauri-plugin-updater

**Files:**
- Modify: `src-tauri/Cargo.toml` (`tauri-plugin-updater = "2.0"`)
- Modify: `src-tauri/tauri.conf.json` (bloco `plugins.updater` com endpoints e pubkey)
- Modify: `src-tauri/src/main.rs` (registrar)
- Modify: `.github/workflows/release.yml` (assinar + publicar `latest.json`)
- Modify: `src/features/updates/UpdatesPage.tsx` (botão "Update app" real)

- [ ] **Step 1: Gerar keypair de assinatura**

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/ai-launcher.key
# Anotar public key — vai no tauri.conf.json
```

- [ ] **Step 2: Configurar endpoint em tauri.conf.json**

```json
"plugins": {
  "updater": {
    "active": true,
    "endpoints": ["https://github.com/HelbertMoura/ai_launcher/releases/latest/download/latest.json"],
    "dialog": true,
    "pubkey": "<cole a pubkey aqui>"
  }
}
```

- [ ] **Step 3: Atualizar release.yml para gerar `latest.json`**

Adicionar step após build do MSI que gera `latest.json` com shape:
```json
{"version": "14.0.0", "notes": "...", "pub_date": "...", "platforms": {"windows-x86_64": {"signature": "...", "url": "..."}}}
```

Upload como asset do release via `gh release upload`.

- [ ] **Step 4: UI no UpdatesPage**

Chamar `check()` do plugin no mount; se available, mostrar botão "Download and install". Após click, `update.downloadAndInstall()` → app reinicia.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(v14): self-updater via tauri-plugin-updater with signed releases"
```

## Task 5.2 — Accent color picker livre

**Files:**
- Modify: `src/features/admin/sections/AppearanceSection.tsx`
- Modify: `src/lib/appearance.ts` (validação de hex)

- [ ] **Step 1: Adicionar `<input type="color">` + text input hex**

Acima dos 5 swatches fixos, adicionar "Custom accent". Salvar em `ai-launcher:custom-accent`. Quando setado, swatches ficam desmarcados.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(v14): free-form accent color picker alongside preset swatches"
```

## Task 5.3 — CI hardening

**Files:**
- Modify: `.github/workflows/build.yml`
- Create: `.github/workflows/quality.yml`

- [ ] **Step 1: Criar workflow `quality.yml` com 4 jobs**

```yaml
name: Quality Gates
on: [pull_request, push]
jobs:
  ts-check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci --legacy-peer-deps
      - run: npx tsc --noEmit
  vitest:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci --legacy-peer-deps
      - run: npm test
  cargo-check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd src-tauri && cargo clippy -- -D warnings
      - run: cd src-tauri && cargo test
  cargo-audit:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo install cargo-audit
      - run: cd src-tauri && cargo audit
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "ci(v14): quality gates (tsc, vitest, clippy, cargo audit)"
```

## Task 5.4 — E2E tests com Playwright + Tauri WebDriver

**Files:**
- Modify: `package.json` (adicionar `@playwright/test`)
- Create: `playwright.config.ts`
- Create: `e2e/launcher.spec.ts`

- [ ] **Step 1: Instalar Playwright**

```bash
npm install --save-dev --legacy-peer-deps @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Playwright config apontando para dev server**

- [ ] **Step 3: 1 E2E que cobre fluxo crítico**

```typescript
import { test, expect } from "@playwright/test";

test("launcher shows CLI cards and opens launch dialog", async ({ page }) => {
  await page.goto("http://localhost:1420");
  await expect(page.getByRole("heading", { name: /launch/i })).toBeVisible();
  await page.getByRole("button", { name: /launch claude/i }).first().click();
  await expect(page.getByText(/directory/i)).toBeVisible();
});
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(v14): Playwright E2E smoke for launcher flow"
```

## Task 5.5 — Docs finais

**Files:**
- Modify: `README.md` / `README.pt-BR.md` (seção v14, screenshots novas)
- Create: `docs/ARCHITECTURE.md` (documentando estrutura modular pós-Sprint 2)
- Modify: `CLAUDE.md` do repo (se existir) ou criar

- [ ] **Step 1: Atualizar READMEs com seção v14**

Listar novidades v13.6 → v14 com bullets.

- [ ] **Step 2: Criar `docs/ARCHITECTURE.md`**

Explicar estrutura `src-tauri/src/commands/*`, stores frontend, fluxo i18n, padrão de invoke, onde adicionar novo comando.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(v14): architecture doc + README refresh"
```

## Task 5.6 — Release v14.0.0

- [ ] **Step 1: Bump para 14.0.0 em 3 arquivos**

- [ ] **Step 2: Entrada CHANGELOG.md**

```markdown
## [14.0.0] — 2026-04-25 — Major Release

### Added
- **Self-updater** — Update the Launcher itself from inside the app via signed releases.
- **Free-form accent color picker** — Any hex, not just 5 swatches.
- **CI quality gates** — `tsc --noEmit`, Vitest, `cargo clippy -D warnings`, `cargo audit`.
- **Playwright E2E smoke test** for launcher flow.
- **docs/ARCHITECTURE.md** — developer guide to the modular codebase.
```

- [ ] **Step 3: Build final + tag + release**

```bash
npm run tauri build
git add -A
git commit -m "chore(v14): bump to 14.0.0"
git tag v14.0.0
git push origin main --tags
gh release create v14.0.0 --title "v14.0.0 — Major Release" --notes-file CHANGELOG.md --latest
```

---

# Auto-review do plano

- **Cobertura dos 3 bugs:** Tasks 1.1, 1.2, 1.3 ✅
- **Cobertura dos problemas P1–P10:** P1 (2.1), P2 (2.2 + 2.3 + 5.4), P3 (2.5), P4 (2.6), P5 (similar refactor pode rodar em 2.6 extended — **adicionar follow-up** se OnboardingPage continuar crítico), P6 (2.1 com thiserror), P7 (fica pra futuro, Vite 8/TS 6 mantidos porque funcionam), P8 (5.3 com cargo audit), P9 (2.4), P10 (5.5 com ARCHITECTURE.md).
- **Features 9–18 da auditoria:** 9 (3.1), 10 (3.2), 11 (3.3), 12 (3.4), 13 (4.1), 14 (5.1), 15 (4.2), 16 (4.4), 17 (4.3), 18 (5.2). ✅
- **Placeholders:** cheguei perto em Task 4.2 (lib `inRange` não definido) e 3.2 (componente `HotkeyInput` não criado). **Ajustar no momento da execução** ou adicionar mini-tasks se necessário.
- **Consistência de tipos:** `SessionTemplate` / `PinnedDirs` / `ConfigExport` bem definidos.
- **Gap identificado:** não há task para OnboardingPage refactor — deixado intencionalmente porque não tem bug ativo; considerar em v14.1 se surgirem reports.

---

# Handoff de execução

**Plano salvo em:** `docs/superpowers/plans/2026-04-23-v14-complete-roadmap-plan.md`

**Duas opções de execução:**

**1. Subagent-Driven (recomendado)** — dispatch um subagent fresh por task, review entre tasks, iteração rápida. Ideal para sprints 2+ que têm refactors grandes.

**2. Inline Execution** — executa tasks nesta sessão usando executing-plans, com checkpoints para review. Ideal para Sprint 1 (hotfix rápido de 2h).

**Recomendação pragmática:** começar por **Sprint 1 inline hoje** (resolve os 3 bugs reportados + limpeza, deliverável imediato v13.5.1), depois decidir para Sprints 2–5 se prefere subagent-driven ou sessões dedicadas.
