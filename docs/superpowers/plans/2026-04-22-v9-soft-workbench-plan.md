# v9.0 "Soft Workbench" Implementation Plan

**Goal:** entregar a v9 como uma reformulação real de UI/UX, aparência e iconografia, com documentação e release coerentes.

**Spec:** `docs/superpowers/specs/2026-04-22-v9-soft-workbench-design.md`

---

## Trilha 1 — Foundations

- [ ] Expandir `AppSettings` para aparência da v9
- [ ] Aplicar `data-theme` + `data-accent` no `documentElement`
- [ ] Reescrever tokens base, dark e light
- [ ] Rebind dos aliases legados para não quebrar superfícies existentes

## Trilha 2 — Shell visual

- [ ] Refazer `HeaderBar`
- [ ] Refazer `StatusBar`
- [ ] Atualizar container global, seções, cards e áreas comuns em `styles.css`
- [ ] Garantir consistência entre tabs principais

## Trilha 3 — Launcher e Admin

- [ ] Refazer `LauncherTab.css`
- [ ] Atualizar visual de tools e listas custom
- [ ] Evoluir `AppearanceSection` com presets de destaque
- [ ] Ajustar `providers.css` para a linguagem v9

## Trilha 4 — Icon system

- [ ] Criar registry central de ícones built-in
- [ ] Migrar `CliIcon` e `ToolIcon` para o registry
- [ ] Expandir overrides para suportar imagem local
- [ ] Adicionar preview + reset em `CliOverrideModal`
- [ ] Documentar troca manual de ícones

## Trilha 5 — Official assets

- [ ] Refazer ícones oficiais de CLIs
- [ ] Refazer ícones oficiais de tools
- [ ] Ajustar ícone principal do app se necessário para o novo look

## Trilha 6 — Public docs and release

- [ ] Atualizar `README.md`
- [ ] Atualizar `README.pt-BR.md`
- [ ] Atualizar `CHANGELOG.md`
- [ ] Remover referências a mockups/prints antigos
- [ ] Validar build
- [ ] Preparar tag/release `v9.0.0`

---

## Guardrails

- Não reverter mudanças do usuário
- Não prometer upload/crop avançado se o fluxo entregue for apenas override local simples
- Não manter screenshots antigas como se fossem da v9
- Não deixar hardcode de caminho de ícone espalhado pelo app
