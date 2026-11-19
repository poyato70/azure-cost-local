# Missão 21 — UX: navegação móvel MCP e backlog de conclusão

## Identificação
- Data: 2026-11-19.
- Repositório: `poyato70/azure-cost-local`.
- Branch: `codex/missao-21-ux-navigation`.
- Base: `main`.
- Estado: correção pontual publicada em branch para revisão; validação de CI e aceite humano ainda não confirmados.
- Escopo: somente navegação do frontend, sem mudança em API, autenticação, persistência, operações MCP ou dados financeiros.

## Problema e correção
Na navegação móvel, selecionar a entrada pai **MCPs** chamava `onSelect("mcps")` mas não fechava o menu, ao contrário dos demais destinos e dos filhos Integração/Análise/Descoberta. A entrada pai também não expunha `aria-current` quando a página Integração estava ativa.

Arquivo alterado: `src/web/components/Navigation.tsx`. Agora a entrada pai fecha o menu móvel após seleção e declara `aria-current="page"` apenas quando `tab === "mcps"`. O comportamento de seleção das páginas filhas permanece preservado.

## Evidência e limites
- Inspeção estática do componente e alteração versionada em commit `d2954939ed682c166ef542afa60983b3a52ee4cf`.
- Não foram executados nesta sessão build, typecheck, Vitest, Playwright, Axe, capturas nem testes manuais. Não declarar esta correção aprovada antes de observar a CI e um teste em navegador.
- Nenhuma consulta real Azure/MCP foi executada.

## Backlog UX para concluir
1. **P0: regressão de navegação móvel.** Verificar em 390 px: abrir menu, clicar MCPs pai e filhos, conferir fechamento, destino, `aria-current`, foco e ausência de sobreposição. Adicionar Playwright permanente.
2. **P1: auditoria transversal.** Testar shell e jornadas Custos, Budgets, Tags, MCP e Observabilidade em 390/768/1280 px, tema claro/escuro, teclado, zoom 200%, reduced motion, Axe e ausência de overflow. Registrar evidências sanitizadas.
3. **P1: semântica de evidência.** Preservar distinção entre falha, não verificado, resposta negativa, evidência antiga e resultados sintéticos; não apresentar testes com fixtures como consultas reais.
4. **P1: acabamento visual.** Revisar consistência das superfícies côncavas/convexas, hierarquia de tarefas, legibilidade de microtexto e comportamento de menu/Inspector.
5. **P2: aceite humano.** Confrontar o checklist `docs/checklist-v0.4.0.md` com a UX 2.1 atual, separando itens históricos de pendências realmente reproduzidas; registrar aprovação por cenário, sem marcar todos como concluídos antecipadamente.

## Critérios de conclusão
- CI Linux e Windows verdes no head final.
- E2E de navegação móvel aprovado; sem regressão nos fluxos existentes.
- Revisão visual e acessibilidade com evidências reais e escopo declarado.
- PR revisada e merge apenas após autorização humana.

## Referências
- [PR #19 — fundação UX-01 a UX-04](https://github.com/poyato70/azure-cost-local/pull/19).
- [PR #21 — correção UX-07](https://github.com/poyato70/azure-cost-local/pull/21).
- [Auditoria UX](https://github.com/poyato70/azure-cost-local/blob/main/docs/relatorios/missao-16-ux-auditoria.md).
