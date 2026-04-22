# AI Launcher Pro v9.0

O AI Launcher Pro é um hub desktop local-first para CLIs de coding com IA. A versão 9 substitui a estética antiga, pesada e terminalizada pela linguagem **Soft Workbench**: interface mais amigável, paleta mais quente, nova família de ícones e uma camada real de aparência com presets de destaque configuráveis no Admin.

**Idioma:** [English](./README.md) · Português  
**Plataformas:** Windows ✅ · macOS 🔜 · Linux 🔜

## O que mudou na v9

- Reformulação completa de UI/UX com nova identidade visual
- Presets de cor de destaque configuráveis no Admin
- Nova família oficial de ícones para CLIs e tools embutidas
- Overrides de ícones built-in agora aceitam imagem local
- Registry central de ícones para facilitar troca manual depois
- Documentação pública limpa, sem prints/mockups antigos

## Destaques

- 8 CLIs de IA embutidas: Claude Code, Codex, Gemini, Qwen, Kilo Code, OpenCode, Crush e Droid
- Perfis Anthropic-compatible com troca de provider, override de modelo e custos
- Histórico de launches, budgets, atalhos e backup/import local de configuração
- CLIs customizadas e IDEs customizadas com imagem opcional para ícone
- Armazenamento local-first e zero telemetria

## Troca manual de ícones

O mapeamento dos ícones built-in agora fica em [src/lib/iconRegistry.ts](/C:/Users/Helbert/Desktop/DevManiacs/ai-launcher-tutra/src/lib/iconRegistry.ts).  
As instruções operacionais estão em [docs/ICON_OVERRIDES.md](/C:/Users/Helbert/Desktop/DevManiacs/ai-launcher-tutra/docs/ICON_OVERRIDES.md).

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
$env:VITE_ADMIN_MODE='1'; npm run tauri build
```

Pré-requisitos: Node 18+, Rust stable, Windows 10/11 e Visual Studio Build Tools com **Desktop development with C++**.

## Licença

MIT. Veja [LICENSE](./LICENSE).
