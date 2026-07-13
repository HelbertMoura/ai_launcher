# AI Launcher v21 — Trust & Flow

Status: proposed specification  
Target: Windows desktop, Tauri v2  
Theme: Command Deck

## 1. Product intent

AI Launcher v21 turns the v20 Command OS foundation into a safer and clearer daily workbench. The release combines security hardening, a new visual system and a more actionable Command Center without removing the terminal identity that differentiates the product.

The core promise is:

> Understand the project, preview the action, run it safely and keep a trustworthy record.

## 2. Goals

1. Never persist provider secrets in plaintext or silently downgrade secure storage.
2. Reduce the Tauri IPC and shell attack surface to the minimum required by the product.
3. Make updates and releases atomic, signed and auditable.
4. Replace the dense v20 presentation with a legible, keyboard-first Command Deck.
5. Turn the Command Center into the primary flow for project setup, launch, execution and review.
6. Finish the typed, versioned persistence layer and make migrations recoverable.
7. Expand automated coverage from browser smoke tests to critical product workflows and packaged-app smoke tests.

## 3. Non-goals

- Cross-platform Linux/macOS support in v21.0.
- Cloud accounts, telemetry upload or mandatory online services.
- Embedding a full terminal emulator.
- Replacing Tauri, React or Rust.
- Rewriting every feature simultaneously; pages migrate onto the new visual system incrementally.

## 4. Release pillars

### 4.1 Trust Foundation

#### Secure secrets

- Replace the current PowerShell/base64 fallback store with Windows Credential Manager or native DPAPI.
- Fail closed in the packaged app: a secret is either stored securely or the user receives an actionable error.
- Browser development may keep secrets in memory for the current session only.
- Use a versioned per-entry format and provide an idempotent migration for legacy localStorage and `secrets.json` data.
- Never pass plaintext or reversible plaintext representations through process command-line arguments.
- Redact secrets from logs, backups, previews, errors and progress events.

#### Capability broker

- Remove unused generic shell permissions and the frontend shell plugin.
- Keep privileged operations behind narrow Rust commands with validated inputs.
- Introduce three user-facing execution modes:
  - Safe: previews and approval for all mutations and installs.
  - Standard: remembers approvals for trusted workspace actions.
  - Admin: explicit temporary elevation for advanced maintenance.
- Record an audit event for privileged actions without storing secrets.

#### Trusted self-update

- Resolve release metadata, URL and filename inside the Rust backend.
- Restrict downloads to approved HTTPS hosts and exact release assets.
- Write only into a canonical update directory with safe filenames, size limits and `create_new` semantics.
- Combine download and checksum verification into one backend operation.
- Require signed installers for stable v21 releases.
- Generate checksums, manifest, SBOM and provenance before publishing a draft release.
- Promote a draft to public only after automated audit succeeds.

### 4.2 Command Deck visual system

#### Design principles

- Terminal character, desktop clarity.
- Content first; decoration must not compete with state or actions.
- Red is an intentional signal, not the default color for every surface.
- Every interactive element works with keyboard and has visible focus.
- Normal text meets at least 4.5:1 contrast; large text and component boundaries meet at least 3:1.
- Motion is short and informative and respects `prefers-reduced-motion`.

#### Typography

- Use Segoe UI Variable/system UI for body copy, forms, navigation and long descriptions.
- Use the bundled monospace face only for commands, metrics, code, compact labels and branded headings.
- Define a stable type scale for display, page title, section title, body, caption and code.
- Restore correct accents and natural pt-BR across the entire interface.

#### Surfaces and tokens

- Consolidate colors, spacing, typography, radii, borders, elevation, focus and motion into semantic tokens.
- Keep dark, light and high-contrast themes under the same token contract.
- Use layered surfaces to distinguish navigation, primary work area, cards, popovers and destructive dialogs.
- Provide compact and comfortable density without reducing hit targets below accessible sizes.

#### App Shell 2.0

- Collapsible sidebar with icons, labels and predictable groups.
- Active navigation uses a clear rail/surface instead of several competing red treatments.
- Top bar prioritizes command search, workspace context and notifications.
- Move secondary appearance controls into a single quick-settings popover.
- Simplify the status bar to connection/session/security state and prevent clipping at 1024x700.
- Preserve all keyboard shortcuts and show them contextually.

### 4.3 Command Center 2.0

The Command Center becomes an action-oriented workspace cockpit.

#### Layout

- Primary workspace header with CLI, provider, agent and trust state.
- One dominant next action based on current project state.
- Contextual secondary actions rather than a permanently visible action grid.
- Live execution area for runbooks and sessions.
- Project Intelligence appears as a concise side panel or expandable drawer.
- Empty state guides the user through creating/selecting a workspace without exposing inactive controls.

#### Project onboarding

- Scan the selected project using the existing safe allowlist.
- Present detected stack, proposed CLI, MCPs, provider and runbook as an editable preview.
- Generate or update `.ailauncher.json` only after confirmation.
- Show exactly which files/configurations may be modified.

#### Runbooks 3.0

- Dry-run preview containing command, cwd, conditions and redacted environment.
- Per-step approval when the execution mode requires it.
- Streaming output with search, copy and bounded persistence.
- Stop, retry failed step and resume interrupted run.
- Final execution summary with duration, status and next suggested action.

#### Unified timeline

- Combine launch sessions, runbook executions, MCP checks and important configuration changes.
- Filter by workspace, agent, CLI, status and event type.
- Support replay only through validated shared launch/runbook services.

### 4.4 Architecture and persistence

- Complete migration of direct localStorage call-sites to the typed registry.
- Add schema versions and explicit migrations with pre-migration backup.
- Recover safely from corrupted or partially migrated state.
- Split large page components into controller hooks, pure view-models and focused view components.
- Target page/container modules below roughly 500 lines unless a documented reason exists.
- Split Rust `util.rs`, MCP and config responsibilities into cohesive modules.
- Preserve `launchCliSession` as the single built-in CLI launch path.
- Use structured domain errors across Tauri IPC instead of localized free-form strings.

## 5. Page migration scope

### Required for v21.0

- Onboarding
- App Shell
- Command Center
- Launcher
- Workspaces and Runbooks
- History/Sessions
- MCP
- Updates
- Admin security, providers and backup

### May follow in v21.x

- Full Analytics redesign
- Advanced theme editor
- Custom dashboard layout
- Additional project intelligence detectors

## 6. Quality strategy

### Unit and integration

- Secrets migration, mixed legacy formats and failure paths.
- Update URL/path validation, checksum mismatch and interrupted download.
- Storage migrations and rollback.
- Permission-mode decisions and audit redaction.
- Command Center view-model states.
- Runbook resume/retry state machine.

### End-to-end

- First run and onboarding.
- Workspace create/edit/select/delete.
- Provider creation without exposing the secret.
- Project scan and profile preview/write.
- Runbook dry-run, approval, stop, retry and resume.
- CLI launch, session end, kill and replay.
- MCP add/backup/health/remove.
- Backup preview/import/rollback.
- Update available/download/verification failure.
- Keyboard navigation and accessibility on every primary page.

### Packaged application

- Install/upgrade/uninstall smoke tests for NSIS and MSI.
- WebView2 boot and single-instance behavior.
- Credential storage round trip.
- Signed-binary verification.
- Update from the previous stable version and rollback on failure.

## 7. Release gates

- TypeScript, formatting, tests, build, Rust fmt/clippy/tests and audits pass.
- `npm audit --omit=dev` has zero findings; the full tooling graph has no high or critical findings.
- No plaintext secret remains in known localStorage keys after migration.
- No unused generic shell permission remains in Tauri capabilities.
- Axe reports no serious or critical issue on all required pages and states.
- Primary flows are keyboard operable at 1024x700 and 1280x860.
- Stable installers and update manifests are signed and verified.
- Release artifacts are created and audited before the GitHub release becomes public.

## 8. Success metrics

- Zero silent security downgrade for provider credentials.
- Zero P0/P1 defect open at release candidate.
- At least 15 meaningful E2E scenarios covering critical workflows.
- All required pages migrated to semantic visual tokens.
- No clipped shell/navigation/status content at the supported minimum window size.
- Measured cold-start and interaction baselines captured before optimization, with regressions blocked in CI.
- User can go from an unconfigured project to a safely launched session from the Command Center without visiting more than two pages.

## 9. Migration and compatibility

- Existing workspaces, profiles, runbooks, history, providers and preferences must survive the upgrade.
- Before the first migration, create a local versioned backup excluding plaintext secrets.
- Migrations must be idempotent and record completion only after verification.
- If secure-secret migration fails, keep the original data, do not log it and block deletion until the user resolves the issue.
- Existing `.ailauncher.json` version 1 remains readable; new optional fields must be backward compatible.

## 10. Definition of done

v21.0 is complete when the Trust Foundation, App Shell 2.0, Command Center 2.0, required page migrations, critical E2E suite and trusted release pipeline are implemented, validated on a packaged Windows build and documented for users and contributors.
