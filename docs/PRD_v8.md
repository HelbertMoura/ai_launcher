# Product Requirements Document (PRD) - AI Launcher v8.0

## 1. Visão Geral e Objetivos
**Produto:** AI Launcher (tutra)
**Versão:** 8.0 ("Friendly Dashboard")
**Status:** Para Revisão e Aprovação

**Objetivo Principal:**
Transformar a experiência do usuário (UI/UX) do AI Launcher, evoluindo do atual "Terminal Dramático" (que se provou confuso) para uma interface mais amigável, moderna e intuitiva. Resolver problemas crônicos de internacionalização (i18n), melhorar significativamente a personalização de ferramentas (ícones), e preparar o terreno para um lançamento polido com documentação impecável e release no GitHub.

---

## 2. Declaração do Problema (Pain Points)
Com base no feedback da versão 7.1, identificamos as seguintes dores críticas:
1. **UI/UX Confuso e Rígido:** O visual atual é considerado muito denso e confuso. A estética "Terminal Dramático" limitou a usabilidade para novos usuários. É mandatório que o visual seja refeito em *todo o sistema*.
2. **Falhas Críticas de i18n e Qualidade de Texto:** Textos em inglês e português estão se misturando ou quebrando o layout. Além disso, é necessário garantir que a qualidade de todos os textos (em inglês e português) esteja impecável e perfeitamente traduzida e revisada em todo o sistema.
3. **Ícones Insatisfatórios:** Os ícones dos CLIs e ferramentas (feitos na v7.1) foram avaliados como "terríveis". Falta apelo visual e clareza.
4. **Gestão de Custom CLIs Limitada:** A funcionalidade de adicionar/editar CLIs restringe os usuários, que querem usar ícones próprios em formato PNG, com opções de edição de tamanho.
5. **Comunicação Desatualizada:** Com uma mudança tão grande para a v8, a documentação, os READMEs e os changelogs atuais não refletem mais o produto.

---

## 3. Escopo das Soluções e Funcionalidades (Features)

### 3.1. Reformulação Completa de UI/UX (O "Friendly Dashboard")
Refazer o visual de **todo o sistema** com o padrão **Data-Dense Dashboard**.
*   **Tipografia e Cores:** Adotar uma paleta mais limpa, acessível (contraste 4.5:1) e fontes legíveis.
*   **Espaçamento e Layout:** Interface mais arejada, botões centrais claros, uso inteligente de css grids, hover states suaves e interações de fácil clique.
*   **Consistência Universal:** Esta mudança deve atingir *cada componente e cada página* da aplicação, extinguindo de vez os resquícios do visual v5.5.

### 3.2. Qualidade de Textos e i18n
*   **Varredura Ortográfica e Semântica:** O sistema de i18n será revisado. Todos os textos em Inglês e Português (`en.json`, `pt-BR.json`, além de textos nativos na interface) passarão por uma rigorosa revisão ortográfica, semântica e de tom de voz.
*   **Layout Flexível para i18n:** Adaptação da interface para acomodar diferentes tamanhos de strings entre idiomas sem "clipar" ou quebrar layouts.

### 3.3. Redesign Universal de Ícones
*   **Novos Ícones Nativos:** Todos os ícones atuais de CLIs e de ferramentas serão refeitos para adotarem um estilo mais polido, colorido e reconhecível, que combine com a nova estética "Friendly".
*   Ícones devem ser consistentes em tamanho e peso visual por toda a aplicação.

### 3.4. Gestão Avançada de Custom CLIs e Editor de Ícones
*   **Upload de Imagens:** Suporte para adicionar novos CLIs/ferramentas permitindo upload de ícones em formatos PNG/JPG.
*   **Ferramenta de Edição:** Controles internos na UI para redimensionar (resize), dar zoom e cortar o ícone da ferramenta, ajustando-o para a interface antes de salvar (persistindo via Data URI/Base64/Tauri backend).

### 3.5. Lançamento, Documentação e Comunicação
*   **READMEs Atualizados:** Os arquivos `README.md` (Inglês) e `README.pt-BR.md` (Português) serão totalmente reescritos para refletir a proposta de valor, funcionalidades e o novo visual da versão 8.0.
*   **Changelog Novo e Detalhado:** Criação de um `CHANGELOG.md` exato com todas as mudanças feitas nesta versão.
*   **GitHub Release:** Planejamento e execução de um processo formal de Release no GitHub, incluindo a geração de binários/instaladores e disponibilização pública com notas de lançamento atraentes.

---

## 4. Requisitos Técnicos

*   **Frontend:** `react-easy-crop` (ou equivalente via Canvas API) para o redimensionamento de PNGs. Zod para validação rigorosa dos formulários de novas ferramentas.
*   **Backend (Tauri):** API para persistência robusta dos ícones de usuários sem comprometer a performance do local storage.
*   **Revisão (CI/CD):** Script do i18n atualizado para evitar a subida de hardcoded strings e garantir pareamento 100% entre as chaves dos idiomas `en` e `pt-BR`.
*   **Git / Ops:** Automatizar e executar o workflow de lançamento usando comandos do GitHub (`gh release create`).

---

## 5. Plano de Execução (Fases)

1.  **Fase 1: Design e Auditoria de Texto**
    *   Aprovar novo visual (paletas e espaçamentos).
    *   Varredura e revisão ortográfica/semântica em todos os textos do app (EN e PT-BR).
    *   Refazer todos os ícones nativos.
2.  **Fase 2: Implementação Global do Visual e i18n**
    *   Substituir tokens CSS, limpar código legado de interface.
    *   Garantir a elasticidade dos botões/cards para i18n.
3.  **Fase 3: Engine de Upload de Custom CLIs**
    *   Criar o uploader, cropper e resize para PNGs, com salvamento seguro.
4.  **Fase 4: Documentação (README e Changelog)**
    *   Atualizar descrição, screenshots e instruções nos `README`s e `CHANGELOG`.
5.  **Fase 5: Build, QA e GitHub Release**
    *   Geração dos instaladores Tauri, **incluindo o build do "Admin Full Local"**.
    *   Publicação oficial na aba de Releases do GitHub.

---

## 6. Critérios de Sucesso (Métricas)
*   **Visual Uniforme:** 100% dos componentes utilizam a nova paleta e tokens do "Friendly Dashboard".
*   **Textos Livres de Erros:** Zero erros ortográficos encontrados na interface e zero strings hardcoded identificadas pelo linter.
*   **Novos Ícones Funcionais:** Testes de usabilidade confirmam o fácil upload e edição de PNGs para custom CLIs, além do redesign agradável dos ícones padrão.
*   **Lançamento Público Pronto:** Release criado no GitHub com instaladores funcionais (incluindo Admin Full) e documentação clara que explica os diferenciais da v8.

---

**Aguardando sua revisão e aprovação para iniciarmos a Fase 1 (Mockups, revisão de texto e novos ícones).**