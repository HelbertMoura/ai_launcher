# AI Launcher v20 Command OS Guide

Este guia cobre as tres superficies centrais da v20: Command Center, Runbooks 2.0 e MCP por projeto.

## Command Center

O Command Center e a tela inicial da v20. Ele junta o workspace ativo, CLI/provider/agente selecionados, readiness do ambiente, perfil `.ailauncher.json`, MCPs do projeto e sessoes recentes.

Fluxo recomendado:

1. Crie ou selecione um workspace em **Workspaces**.
2. Configure CLI/provider padrao ou ative um **Agent Profile**.
3. Volte para **Command Center**.
4. Use **Launch workspace** para abrir o agente com o contexto do projeto.
5. Use **Run setup** para abrir runbooks sugeridos pela stack detectada.

## Project Intelligence

Quando existe um workspace ativo, o app faz uma varredura segura em arquivos conhecidos como `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `docker-compose.yml` e `.ailauncher.json`.

O scan detecta stacks como Tauri, React/Vite, Node, Rust, Python, Go, Docker e MCP. Ele tambem sugere CLI, runbook e tags para o projeto.

O botao **Update profile** gera um preview de `.ailauncher.json` antes de salvar. O backend escreve somente esse arquivo fixo na raiz validada do projeto.

## Runbooks 2.0

Runbooks sao sequencias de passos para preparar, verificar ou rodar um ambiente.

Novidades da v20:

- presets locais para Node/Vite, Tauri/Rust, Rust, Python, Go, Docker e MCP;
- sugestoes automaticas a partir da stack detectada;
- condicoes por step: `fileExists`, `commandExists`, `envExists` e `previousSucceeded`;
- timeline persistida com status, duracao e output capado por step.

Use runbooks para tarefas repetitivas como `npm install`, `npx tsc --noEmit`, `npm test`, `cargo test` e checks de MCP.

## MCP Por Projeto

O profile `.ailauncher.json` pode declarar MCPs esperados:

```json
{
  "version": 1,
  "cli": "codex",
  "mcp": ["codex:filesystem", "claude:github"],
  "runbook": "v20-release-preflight"
}
```

IDs podem ser simples (`filesystem`) ou qualificados (`codex:filesystem`). O Command Center resolve os servidores instalados, mostra faltantes e resume health.

Na aba **MCP**, presets do catalogo sao validados antes de aplicar e o backend faz backup da configuracao antes de escrever.

## Backup E Update

Antes de mexer em configuracoes, use **Admin > Backup** para exportar um JSON com manifest. Secrets sao redigidos e o import tem preview de chaves conhecidas/desconhecidas antes de restaurar.

Na aba **Updates**, a v20 mostra a cadeia de confianca do auto-update: `latest.json`, checksum SHA-256 e GitHub Release. O script de release tambem valida o conteudo do `latest.json` contra a tag publicada.
