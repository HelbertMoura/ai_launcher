# v20.0.0 Release Checklist

## Preflight

- Confirmar que a branch de release contem somente mudancas esperadas da v20.
- Rodar `npx tsc --noEmit`.
- Rodar `npm test`.
- Rodar `npm run build`.
- Rodar `cargo fmt --check` em `src-tauri`.
- Rodar `cargo clippy --no-deps -- -D warnings` em `src-tauri`.
- Rodar `cargo test` em `src-tauri`.
- Rodar `npm run e2e`.

## Versao e notas

- Atualizar `package.json` para `20.0.0`.
- Atualizar `src-tauri/Cargo.toml` para `20.0.0`.
- Atualizar `src-tauri/tauri.conf.json` para `20.0.0`.
- Criar `docs/releases/v20.0.0.md` com highlights reais, correcoes e validacao local.
- Conferir README/README.pt-BR e docs publicas.

## Build local

- Rodar `npm run tauri build`.
- Confirmar que MSI/NSIS foram gerados com `20.0.0` no nome.
- Confirmar checksums SHA-256 dos instaladores.

## GitHub Release

- Criar tag `v20.0.0`.
- Aguardar workflow de release concluir.
- Conferir assets do GitHub Release:
  - instalador NSIS;
  - MSI;
  - arquivos `.sha256`;
  - `latest.json`;
  - source archives.
- Rodar `bash scripts/audit-release.sh v20.0.0`.

## Manifesto latest.json

- `version` deve ser `20.0.0`.
- URLs Windows devem apontar para `/download/v20.0.0/`.
- `releaseNotesUrl` deve apontar para a release correta.
- Checksums devem bater com os assets publicados.

## Smoke final

- Instalar a build em uma maquina limpa ou perfil limpo.
- Abrir Command Center como tela inicial.
- Rodar launch de CLI com workspace ativo.
- Rodar um preset de runbook.
- Conferir backup/export/import com preview.
- Conferir updater apontando para a release v20.
