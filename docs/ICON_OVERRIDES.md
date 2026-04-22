# Troca Manual de Ícones

## Onde ficam os ícones oficiais

- CLIs built-in: `public/icons/cli/`
- Tools built-in: `public/icons/tool/`

O mapeamento oficial usado pela UI está centralizado em:

- `src/lib/iconRegistry.ts`

## Como a UI resolve os ícones

1. Se existir override salvo localmente, ele vence.
2. Se não existir override, a UI usa o asset oficial definido no registry.
3. Se um asset estiver faltando, a UI cai no fallback padrão do mesmo grupo.

## Como trocar manualmente um ícone oficial

### Opção 1: substituir o arquivo mantendo a mesma chave

Exemplo:
- trocar `public/icons/cli/codex.svg`
- trocar `public/icons/tool/vscode.svg`

Essa é a forma mais simples.

### Opção 2: apontar para outro arquivo

Edite `src/lib/iconRegistry.ts` e mude `assetPath` da chave desejada.

Exemplo conceitual:

```ts
{ key: 'codex', kind: 'cli', assetPath: '/icons/cli/codex-v2.svg' }
```

## Override pela interface

O Admin e os modais de override aceitam imagem local para ícones embutidos e itens customizados.

Formatos suportados:
- PNG
- SVG
- JPG
- WEBP

Limite atual:
- até 512 KB por arquivo

## Reset

Ao restaurar o padrão no modal, o override local é removido e a UI volta ao asset oficial do registry.
