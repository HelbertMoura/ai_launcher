# v9.0 "Soft Workbench" — Design Spec

**Data:** 2026-04-22  
**Autor:** Helbert Moura + Codex  
**Target release:** v9.0.0  
**Predecessora:** v8.0.0  
**Tipo:** MAJOR

---

## 1. Visão

A v9 substitui completamente a linguagem herdada do "Terminal Dramático" e qualquer leitura futurista/terminal. O AI Launcher passa a operar com uma identidade mais calorosa, clara e madura: uma bancada de trabalho desktop para CLIs de IA, não um simulador de terminal.

### Princípios
- **Friendly, not toy-like**: acolhedor sem parecer infantil.
- **Workbench, not terminal**: blocos, superfícies e fluxos claros.
- **Warm contrast**: cinza escuro quente, off-white, vermelho quente e pasteis.
- **Light-first identity**: o tema claro define a linguagem; o dark é premium, não agressivo.
- **Customização real**: cor de destaque e ícones devem ser configuráveis sem hacks.

### Anti-goals
- Sem glow neon, grid cyber, prompt shells e bordas "hacker".
- Sem monocromia terminal como identidade principal.
- Sem prometer features visuais que o código ainda não sustenta.

---

## 2. Tom visual

### Light
- base clara porcelana
- painéis branco morno
- texto carvão suave
- acento padrão em vermelho queimado

### Dark
- base chumbo quente
- superfícies grafite aveludado
- texto marfim frio
- mesmo acento da família, sem neon

### Sensação desejada
- ferramenta premium
- desktop app confiável
- mais "studio/workbench" do que "control room"

---

## 3. Tokens

### Paleta estrutural
- `--color-bg-app`
- `--color-bg-shell`
- `--color-surface`
- `--color-surface-soft`
- `--color-surface-muted`
- `--color-border`
- `--color-border-strong`
- `--color-text`
- `--color-text-soft`
- `--color-text-muted`

### Acento
O acento deve ser controlado por `data-accent` no `documentElement`.

Presets oficiais:
- `ember` (default)
- `coral`
- `rose`
- `sage`
- `mist`

Tokens derivados:
- `--color-accent`
- `--color-accent-soft`
- `--color-accent-strong`
- `--color-accent-ink`
- `--color-accent-surface`

### Forma
- radii mais generosos
- sombras suaves e curtas
- bordas discretas
- menos outlines duros

---

## 4. Tipografia

### Interface
- `Fira Sans` como base de UI
- `JetBrains Mono` e `Fira Code` continuam opcionais para preview técnico

### Diretriz
- títulos e labels principais deixam de ser mono-first
- mono fica reservado para metadados, comandos, paths e previews

---

## 5. Shell da aplicação

### Header
- marca mais editorial
- tabs em pills/cartões
- ações de utilidade agrupadas em cluster suave

### Main
- fundo com gradiente leve
- painéis com respiro maior
- grids menos rígidos e menos densos

### Footer / status
- status discreto e legível
- update banner sem parecer log line de terminal

---

## 6. Launcher

### CLI cards
- deixam de parecer terminal panes
- usam cards com avatar visual, meta, status e CTA claros
- estado selecionado com superfície/acento, não com prompt glyph

### Coluna lateral
- seções mais suaves
- títulos claros
- campos de diretório/args com aparência consistente com o resto da app

---

## 7. Admin

### Papel
O Admin vira o centro de identidade visual e personalização.

### Controles obrigatórios
- fonte de exibição
- preset de destaque
- preview da aparência
- base para overrides de ícones

### Aparência
- cards administrativos mais claros e organizados
- listas custom e backup integradas à mesma linguagem visual

---

## 8. Ícones

### Família visual
- rounded square / badge base
- pequena profundidade
- contraste alto em tamanhos pequenos
- sem mistura de estilos aleatórios

### Arquitetura
- registry central por chave estável
- asset oficial separado de override local
- renderização unificada para built-ins

### Overrides
- aceitar SVG/PNG local para built-ins
- preview e reset
- fallback para asset oficial

---

## 9. Documentação pública

### Regras da v9
- remover banner/prints/mockups antigos dos READMEs
- não usar screenshots antigas em release notes
- descrever a v9 em PT-BR com foco em UI nova, personalização e consistência

---

## 10. Definition of Done visual

- header, footer, launcher, tools e admin já comunicam `Soft Workbench`
- nenhum ícone oficial legado permanece
- acento troca ao vivo pelo admin
- ícones built-in aceitam override e reset
- README/changelog/release deixam de referenciar material visual antigo
