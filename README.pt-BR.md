<div align="center">
  <img src="./public/images/banner.svg" alt="AI Launcher Pro" width="100%" />

  <br />

  <h1>AI Launcher Pro v8.0</h1>

  <p>
    <strong>O dashboard amigável para todas as suas CLIs de IA.</strong>
  </p>

  <p>
    Oito CLIs built-in. Seis providers Anthropic-compatible. CLIs customizados com suporte a upload de imagens. 100% Bilíngue. Local-first. Zero telemetria.
  </p>

  <p>
    <a href="https://github.com/HelbertMoura/ai_launcher/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/HelbertMoura/ai_launcher?style=flat-square&color=3B82F6&labelColor=0F172A" /></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-8B5CF6?style=flat-square&labelColor=0F172A" /></a>
    <img alt="Tauri" src="https://img.shields.io/badge/tauri-v2-24C8DB?style=flat-square&labelColor=0F172A" />
    <img alt="React" src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&labelColor=0F172A" />
    <img alt="Platform" src="https://img.shields.io/badge/platform-windows-0078d6?style=flat-square&labelColor=0F172A" />
  </p>
</div>

<hr />

**Idioma:** [English](./README.md) · Português

**Plataformas:** Windows ✅ · macOS 🔜 · Linux 🔜

<br />

## Novidades na v8.0 (Friendly Dashboard)

A versão 8.0 abandona o visual restrito do "Terminal Dramático" em favor de um **Data-Dense Dashboard** muito mais limpo, acessível e moderno.

- **Ícones Customizáveis (PNG/JPG):** Chega de ficar restrito a emojis ou SVGs simples! Agora você pode fazer upload, cortar (crop) e redimensionar qualquer imagem para usar como ícone das suas ferramentas customizadas.
- **Design System "Friendly Dashboard":** Uma paleta de cores renovada (tons de slate/blue), contraste acessível (WCAG AA) e um uso inteligente de tipografia com Fira Code (dados) e Fira Sans (interface geral).
- **i18n e Textos Impecáveis:** O sistema agora é 100% livre de strings hardcoded. O layout foi reconstruído com flexbox para se adaptar aos tamanhos de palavras do inglês e português sem quebrar a interface ou sobrepor textos.
- **Novos Ícones Oficiais:** Todos os ícones embutidos (Claude, Gemini, Cursor, etc.) foram redesenhados para serem mais coloridos, intuitivos e modernos.

<br />

## O que é

O AI Launcher Pro é um app desktop keyboard-first que unifica todas as CLIs de coding com IA em uma única janela. Em vez de abrir terminais soltos e gerenciar tokens espalhados em arquivos `.env`, você roda, atualiza e monitora cada ferramenta a partir de um painel consistente — com histórico, custos e perfis de provider lado a lado.

A stack é Tauri v2 + React 19 + Rust. Binário nativo, zero login, zero telemetria e tudo salvo apenas no seu localStorage.

<br />

## Destaques

### Launch & gerenciamento
- 8 CLIs built-in (Claude Code, Codex, Cursor, Gemini, Qwen, iFlow, Copilot CLI, Kilo, Crush, Droid, OpenCode) detectadas ou instaladas pelo app.
- Adicione sua própria CLI com facilidade — agora com upload de ícones em imagem real.
- Histórico detalhado estilo git-log com re-run, cópia de argumentos e registro do provider usado.
- 9 abas keyboard-first (`⌘K` paleta, `⌘⇧1-4` abas primárias, `⌘/` ajuda).

### Multi-provider
- 6 providers Anthropic-compatible já configurados: **Anthropic**, **Z.AI (GLM)**, **MiniMax**, **Moonshot / Kimi**, **Qwen / DashScope**, **OpenRouter**.
- Troca de provider com um clique através do painel Admin.
- Sobrescrita de modelo por perfil + controle de budget diário com alertas.
- Perfis totalmente customizáveis para endpoints privados ou novos.

### UX e Customização
- **Linguagem Visual Moderna:** Tipografia legível, espaços generosos e feedback de interações super responsivo.
- **Interface 100% Bilíngue:** Troca automática do idioma entre EN e pt-BR sem recarregar a tela e sem falhas de interface.
- **Personalização Total:** Edite o nome e adicione ícones visuais avançados até mesmo nas CLIs nativas do sistema.

<br />

## Instalação

### Usuário final

Baixe o instalador (`.msi` ou `.exe`) ou a versão Admin Full Local na [página de releases do GitHub](https://github.com/HelbertMoura/ai_launcher/releases/latest).

O Windows SmartScreen pode alertar sobre a build. Clique em **Mais informações → Executar mesmo assim**.

### A partir do código

```bash
git clone https://github.com/HelbertMoura/ai_launcher.git
cd ai_launcher
npm install
npm run tauri dev             # modo desenvolvimento
npm run tauri build           # instaladores padrão
$env:VITE_ADMIN_MODE='1'; npm run tauri build  # instalador Admin Full Local (sempre ativo)
```

**Pré-requisitos:** Node 18+, Rust stable, Windows 10/11, Visual Studio Build Tools com o workload "Desktop development with C++".

<br />

## Licença

MIT. Veja [LICENSE](./LICENSE). Copyright © 2026 Helbert Moura | DevManiac's.
