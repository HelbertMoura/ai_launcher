# Product Requirements Document (PRD) - AI Launcher v9.0

## 1. Visão Geral
**Produto:** AI Launcher (tutra)  
**Versão:** 9.0  
**Codinome:** Soft Workbench  
**Status:** Em definição, aguardando aprovação para execução

### Resumo executivo
A versão 9.0 abandona por completo a linguagem visual herdada do "Terminal Dramático" e qualquer resquício de interface futurista/terminalizada. O produto passa a ser uma bancada desktop mais acolhedora, clara e madura, com foco em legibilidade, confiança visual, hierarquia limpa e personalização real.

O objetivo não é "polir a v8". O objetivo é **substituir a identidade visual da aplicação inteira**, reconstruir o sistema de ícones, formalizar uma lógica limpa de override manual de assets e preparar um novo ciclo de release em GitHub com documentação e changelog em PT-BR, sem reaproveitar screenshots/mockups antigos.

---

## 2. Contexto e Problema

### 2.1. Contexto atual
A base atual está na `v8.0.0`, mas o repositório ainda carrega inconsistências entre:
- PRD da v8 e implementação real
- documentação e funcionalidades efetivamente entregues
- tokens modernos de dashboard e componentes ainda fortemente marcados pela estética terminal
- promessas de personalização de ícones e upload visual que hoje não estão concluídas de forma robusta

### 2.2. Problemas identificados
1. **Direção visual errada para o produto**
   A interface ainda transmite um visual técnico, escuro, terminalizado e com "peso dramático" demais para o objetivo de uso diário.

2. **Experiência pouco amigável**
   O app precisa parecer mais humano, mais claro e mais agradável para navegação frequente, sem depender de estética cyber/futurista para parecer "avançado".

3. **Sistema de ícones fraco e inconsistente**
   Os ícones atuais de CLIs e ferramentas são visualmente fracos, pouco memoráveis e não formam uma família coesa.

4. **Customização superficial**
   Hoje o sistema trabalha majoritariamente com emoji/texto curto para override. Isso não atende à necessidade de trocar ícones nativos, nem de manter um fluxo manual e previsível para futuras substituições.

5. **Admin sem controle real de identidade**
   O painel admin ainda não controla cor de destaque, presets de acento, nem branding visual da aplicação.

6. **Fluxo de release instável**
   Como houve problemas de release na linha da v8, a v9 precisa nascer com um fluxo de entrega mais determinístico, com checklist, changelog e publicação limpos.

7. **Materiais públicos desatualizados**
   README, release notes e descrição pública precisam ser reescritos em PT-BR e, por solicitação atual, **sem prints/mockups antigos** até que novas capturas sejam adicionadas depois.

---

## 3. Objetivo do Produto

Reposicionar o AI Launcher como uma aplicação desktop premium e amigável para operar CLIs de IA, com:
- visual completo novo
- UX mais clara e confortável
- paleta baseada em tons pasteis, cinza escuro, branco e vermelho quente
- sistema de destaque configurável no admin
- ícones oficiais totalmente refeitos
- infraestrutura para troca manual futura de ícones sem mexer em múltiplos pontos do código
- documentação e release da v9 prontos para publicação limpa

---

## 4. Princípios da v9

### 4.1. Princípios de design
- **Sem estética terminal**: o produto não deve mais parecer um multiplexador de terminal.
- **Amigável sem infantilizar**: visual suave, limpo e bonito, com confiança de ferramenta séria.
- **Light-first com dark premium opcional**: a identidade principal deixa de ser dark-first terminal; o dark continua existindo, mas com outra linguagem.
- **Tons quentes e pasteis**: reduzir contraste agressivo e eliminar cara neon/cyber.
- **Hierarquia evidente**: menos ruído, menos linhas, menos bordas gritantes, mais blocos claros.
- **Customização controlada**: permitir personalização sem degradar consistência visual.

### 4.2. Princípios de UX
- Priorizar leitura, escaneabilidade e previsibilidade.
- Reduzir sensação de painel denso e técnico demais.
- Melhorar vazios, respiros, agrupamentos e títulos.
- Tornar ações principais óbvias na primeira leitura.
- Garantir que Admin e Launcher pareçam parte do mesmo produto.

---

## 5. Direção Visual Proposta

### 5.1. Nova linguagem
**Soft Workbench** será a nova linguagem visual da v9.

Características:
- superfícies mais suaves
- cards com volume sutil
- contraste alto o bastante para acessibilidade, mas sem agressividade
- tipografia de interface mais calorosa e menos "mono-first"
- elementos de ação com presença clara, sem parecer dashboard corporativo genérico

### 5.2. Paleta-base
Paleta base desejada:
- **Cinza escuro quente** para base estrutural
- **Branco/off-white** para superfícies principais
- **Vermelho quente** como acento padrão
- **Pasteis de apoio** para estados e fundos secundários

Referência de clima, não de valores finais:
- carvão suave
- branco porcelana
- vermelho queimado / coral profundo
- rosa antigo claro
- areia rosada
- névoa cinza

### 5.3. Cor de destaque configurável no Admin
O Admin deve permitir trocar a cor de destaque da UI sem mexer no código.

Escopo mínimo:
- preset padrão vermelho quente
- pelo menos 4 presets oficiais de destaque
- persistência local
- aplicação global via CSS variables/tokens

Exemplos de presets:
- `vermelho quente` (default)
- `coral`
- `rosa antigo`
- `sálvia`
- `azul acinzentado`

---

## 6. Escopo Funcional

### 6.1. Reformulação total de UI/UX
Refazer integralmente:
- shell principal da aplicação
- header
- navegação por abas
- launcher
- history
- costs
- help
- onboarding
- admin
- modais
- empty states
- skeletons
- cards, listas, formulários, botões e badges

Resultado esperado:
- nenhum componente principal deve manter a assinatura visual terminal/futurista atual

### 6.2. Novo sistema de design
Criar ou substituir:
- tokens de cor
- tokens de tipografia
- tokens de radius
- tokens de sombra
- tokens de motion
- tokens de espaçamento

Também deve existir documentação visual atualizada para a v9.

### 6.3. Redesign completo dos ícones
Todos os ícones atuais de:
- CLIs embutidas
- ferramentas embutidas
- app/icon principal

devem ser refeitos como uma família consistente.

Direção sugerida:
- simples
- memorável
- com massa visual equilibrada
- legível em tamanhos pequenos
- coerente com a nova paleta

### 6.4. Lógica de troca manual de ícones
A v9 deve introduzir uma forma clara de o usuário/desenvolvedor trocar ícones manualmente depois.

Isso exige:
- um registro central de ícones por chave estável
- separação entre asset oficial e override local
- caminho previsível para troca manual
- documentação curta explicando onde substituir e como a UI resolve os assets

### 6.5. Override visual no Admin
O Admin deve evoluir para permitir:
- troca do acento visual da aplicação
- override de ícone para itens embutidos
- preview antes de salvar
- reset para asset oficial

Escopo recomendável:
- suportar SVG/PNG para override local
- persistir referência/local copy de modo seguro

### 6.6. README, changelog e release em PT-BR
Atualizar:
- `README.pt-BR.md`
- `README.md`
- `CHANGELOG.md`
- descrição pública do projeto/release em PT-BR

Observação mandatória desta fase:
- **remover prints/mockups antigos** dos READMEs e da release description
- não usar imagens antigas como material oficial da v9
- novos prints entram depois, em ciclo separado

---

## 7. Escopo Técnico

### 7.1. Frontend
Base atual:
- React 19
- Vite 8
- Tauri 2
- CSS modular + arquivos globais

Mudanças esperadas:
- reorganizar tokens para refletir a v9
- reduzir dependência de estilos herdados em `styles.css`
- centralizar tema/acento/aparência em estado e persistência consistentes
- revisar responsividade desktop-first com comportamento aceitável em janelas menores

### 7.2. Sistema de aparência
O estado visual deve contemplar:
- tema principal
- preset de acento
- futura extensibilidade para outros ajustes visuais

Sugestão técnica:
- expandir `AppSettings` para carregar tokens de aparência
- aplicar preset por `data-*` attributes no `documentElement`
- deixar o Admin como origem de configuração

### 7.3. Sistema de ícones
Proposta técnica:
- criar um `icon registry` central para CLIs e tools
- associar cada chave a:
  - nome
  - tipo (`cli` ou `tool`)
  - asset oficial
  - override opcional

Resultado:
- a renderização deixa de depender de caminhos hardcoded espalhados
- a troca manual futura fica simples
- o fallback visual fica previsível

### 7.4. Persistência de overrides
Hoje:
- built-ins usam override por emoji
- custom items usam majoritariamente texto/emoji

Na v9:
- built-ins e custom items devem convergir para a mesma lógica de asset visual
- overrides devem aceitar imagem real
- reset deve restaurar o asset oficial sem apagar o item

### 7.5. Documentação operacional para troca manual
Deve existir um doc objetivo explicando:
- onde ficam os assets oficiais
- como o registro mapeia chaves para arquivos
- como substituir um ícone manualmente
- como resetar para o padrão

---

## 8. APIs, Ferramentas e Superpowers a Usar

Esta v9 deve ser conduzida com apoio de "superpowers" do próprio repositório e fluxo guiado por documentação interna, sem depender de improviso visual.

### 8.1. Superpowers internos
Usar a pasta `docs/superpowers/` como base para:
- registrar especificação visual nova
- registrar plano de execução por fases
- manter rastreabilidade da reformulação

### 8.2. APIs / integrações previstas
- `localStorage` e estrutura de settings já existente para persistência visual
- Tauri APIs já presentes para integração desktop
- GitHub via `gh` CLI para tag/release quando a implementação for aprovada e concluída

### 8.3. Entregáveis derivados
Após aprovação deste PRD, devem ser gerados:
1. spec visual detalhada da v9
2. plano de execução por sprints
3. implementação
4. validação local
5. changelog final
6. release/tag no GitHub

---

## 9. Fora de Escopo Nesta Etapa

Não faz parte desta etapa de PRD:
- publicar a release imediatamente sem aprovação
- manter screenshots antigos por conveniência
- preservar a identidade terminal como "variante"
- fazer apenas ajustes cosméticos superficiais

Também não será objetivo:
- redesenhar arquitetura Rust/Tauri sem necessidade funcional
- ampliar escopo para mobile ou web pública

---

## 10. Critérios de Aceitação

### 10.1. Visual
- 100% das superfícies principais seguem a linguagem `Soft Workbench`
- nenhum componente crítico mantém assinatura visual terminal/futurista anterior
- a aplicação apresenta coerência visual entre launcher, admin e modais

### 10.2. Aparência configurável
- o Admin permite trocar a cor de destaque
- a troca persiste localmente
- a alteração afeta a interface inteira sem inconsistências visíveis

### 10.3. Ícones
- todos os ícones oficiais de CLIs e tools foram refeitos
- existe um registro central de assets
- existe fluxo de override/reset para ícones embutidos
- existe caminho documentado para troca manual futura

### 10.4. Documentação e release
- `CHANGELOG.md` inclui a v9 em PT-BR
- README e release notes deixam de usar prints antigos
- a descrição pública do projeto/release é atualizada em PT-BR
- a release final é publicada só após validação local

---

## 11. Plano de Execução

### Fase 1. Diagnóstico e Direção
- congelar a v8 como referência de legado
- aprovar a linguagem `Soft Workbench`
- aprovar paleta base e presets de acento
- aprovar estratégia dos novos ícones

### Fase 2. Design System v9
- substituir tokens antigos
- redefinir tipografia, grids, superfícies e motion
- atualizar documentação visual

### Fase 3. Reformulação da aplicação
- reescrever layout principal
- reformular tabs e modais
- alinhar launcher, history, costs e admin

### Fase 4. Sistema de ícones e overrides
- criar registry central
- migrar renderização para o novo registry
- implementar override local de ícones
- documentar troca manual

### Fase 5. Conteúdo público e release
- atualizar `README.md`
- atualizar `README.pt-BR.md`
- atualizar `CHANGELOG.md`
- preparar release notes em PT-BR
- remover prints/mockups antigos dos materiais públicos

### Fase 6. Build e publicação
- validar build local
- validar instaladores
- gerar tag `v9.0.0`
- publicar release no GitHub

---

## 12. Estratégia de Release para Evitar Problemas da v8

Como houve problemas de release anteriores, a v9 deve seguir um fluxo mais rígido:

1. consolidar versão e changelog antes de taguear
2. validar build desktop local antes de release
3. publicar release apenas com assets corretos
4. usar release notes em PT-BR alinhadas ao changelog
5. não incluir screenshots antigas
6. só atualizar descrição pública quando README/release estiverem coerentes

---

## 13. Riscos

1. **Escopo amplo demais**
   Como a intenção é refazer a identidade inteira, existe risco de cair em retrabalho se a direção visual não for aprovada logo no início.

2. **Legado visual espalhado**
   Parte do projeto ainda mistura tokens de várias fases; a migração exigirá limpeza e não apenas substituição de cores.

3. **Ícones embutidos hoje estão hardcoded por caminho**
   Sem um registry central, a manutenção futura continuará ruim.

4. **Documentação pública promete mais do que o código entrega**
   A v9 precisa corrigir isso junto com a implementação.

---

## 14. Decisões já propostas para aprovação

### Decisão A
Adotar `Soft Workbench` como identidade oficial da v9.

### Decisão B
Abandonar por completo a linguagem terminal/futurista anterior.

### Decisão C
Usar vermelho quente como destaque padrão, com presets alternáveis no Admin.

### Decisão D
Refazer todos os ícones oficiais de CLIs e tools.

### Decisão E
Criar um registro central para permitir troca manual posterior de ícones.

### Decisão F
Atualizar README, changelog e release em PT-BR, removendo prints/mockups antigos até que novos sejam produzidos.

---

## 15. Próximo Passo Após Aprovação

Depois da sua aprovação deste PRD, a execução deve seguir nesta ordem:

1. criar a spec visual detalhada da v9 em `docs/superpowers/specs/`
2. criar o plano de implementação em `docs/superpowers/plans/`
3. implementar a reformulação completa
4. validar localmente
5. atualizar changelog/README/descrição pública
6. gerar release/tag no GitHub

---

**Status atual:** aguardando sua aprovação para iniciar a implementação da v9.
