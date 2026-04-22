# AI Launcher Pro v9.1

```
┌──────────────────────────────────────────────┐
│  ●   AI Launcher Pro                        │
│                                              │
│  $ claude --describe "beautiful code"      │
│  $ codex --help                             │
│                                              │
│  8 CLIs  •  Theme: Soft Workbench 2.0       │
└──────────────────────────────────────────────┘
```

O AI Launcher Pro é um hub desktop local-first para CLIs de coding com IA. A versão 9.1 traz uma reformulação visual completa — **UI minimalista no estilo Figma** com acentos terracotta quentes, modo escuro completo e acesso admin unificado.

**Idioma:** [English](./README.md) · Português  
**Plataformas:** Windows ✅ · macOS 🔜 · Linux 🔜

## O que mudou na v9.1 — Soft Workbench 2.0

- **UI no estilo Figma**: Design minimalista e moderno com acentos terracotta quentes
- **Modo escuro**: Tema escuro completo com hierarquia de superfícies no estilo Figma
- **Admin unificado**: Todos os recursos disponíveis para todos os usuários — sem divisão admin/público
- **Ícones oficiais**: Ícones autênticos das marcas para Claude, VS Code, Cursor, Gemini, Qwen
- **Cores de destaque dinâmicas**: Escolha sua cor de destaque nas configurações do Admin
- **Sem estética terminal**: Interface limpa e moderna sem decorações falsas de terminal

## Recursos

- 8 CLIs de IA embutidas: Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush e Droid
- Perfis Anthropic-compatible com troca de provider, override de modelo e rastreamento de custos
- Histórico de launches, budgets, atalhos e backup/import local de configuração
- CLIs customizadas e IDEs customizadas com imagem opcional para ícone
- Armazenamento local-first e zero telemetria
- Tema: Claro/Escuro com cor de destaque configurável

## Instalação

### Usuário final

Baixe o `.msi` ou `.exe` mais recente na [página de releases do GitHub](https://github.com/HelbertMoura/ai_launcher/releases/latest).

O Windows SmartScreen pode alertar em builds sem assinatura. Se necessário, use **Mais informações → Executar mesmo assim**.

### A partir do código

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev
npm run tauri build
```

Pré-requisitos: Node 18+, Rust stable, Windows 10/11 e Visual Studio Build Tools com **Desktop development with C++**.

## Licença

MIT. Veja [LICENSE](./LICENSE).
