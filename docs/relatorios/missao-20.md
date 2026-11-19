# Missão 20 — Correção do status desatualizado no UX-07

## Identificação

- **Estado atual:** PR #21 aberta; CI aprovada no head de código `86deca8`; atualização deste relatório dispara nova verificação para o head documental.
- **Início:** 2026-11-19 09:47:05 -03:00.
- **Conclusão da validação observada:** 2026-11-19 10:06 -03:00.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/missao-20-ux07-stale-status`.
- **Commit inicial:** `775de8b64e6c2c36391362efb7de357179b7ab8d`.
- **Commit(s) corretivo(s):** `e22a6983cefc9a86f7cf66bb49da5c719b6d5c59` (modelo e unitários); `48ffcafaf946102f50c2ea9fabfb74093ecc1a02` (integração UX e E2E); `32f92eb57dde25c74feff313f6b36cf8e84c0a96` e `86deca8daa1a61c91da3c3a92bd0a7f14b3cfac7` (relatório e publicação/PR).
- **Pull Request:** [#21](https://github.com/poyato70/azure-cost-local/pull/21) — aberta.
- **Commit de integração:** Não aplicável nesta missão; merge não autorizado.

## Objetivo e escopo

- **Problema reproduzido:** `GET /api/health` respondendo `ok=false` era apresentado como “Desatualizado · Endpoint respondeu ok=true” após 60 segundos. O status de idade substituía o resultado e a legenda não distinguia evidência positiva antiga de resposta negativa antiga.
- **Resultado esperado:** Resultado da última leitura continua fiel, enquanto sua idade é indicada separadamente. Falhas HTTP nunca são sucesso; dados sem resposta permanecem não verificados ou falha de leitura conforme a existência de tentativa.
- **Restrições:** Sem alterações de API, autenticação, MCP, persistência, execução operacional, tags, releases ou merge.

## Plano e acompanhamento

| Etapa | Estado | Evidência/critério |
|---|---|---|
| 1. Inspeção e contexto | Aprovado | `origin/main` confirmado em `775de8b64e6c2c36391362efb7de357179b7ab8d`; branch e worktree corretas; checkout base com alterações M16 preservado. |
| 2. Implementação e regressões | Aprovado | Helper separa resultado/idade; matriz unitária e E2E permanente reproduzem as transições; leitura permanece GET-only. |
| 3. Validação e revisão | Aprovado localmente | Typecheck, build, 212 unitários, 4 E2E UX, Axe claro/escuro e `git diff --check` aprovados. |
| 4. Publicação/CI | Aprovado para o head `86deca8` | Branch publicada; PR #21 aberta; Linux e Windows passaram. Relatório está sendo atualizado, gerando novo head somente documental e nova execução de CI. |

- **Progresso:** 4/4 etapas (100%; CI aprovada no head de código `86deca8`; nova execução para este registro documental pendente).
- **Tempo decorrido observado:** 18 min 58 s até 10:06 -03:00.
- **Dependências/bloqueios:** Nenhum bloqueio local. A nova execução da CI para o head documental ainda não concluiu.

## Implementação

- `src/web/pages/observabilityStatus.ts`: estado de resultado (`positive`, `negative`, `failed`, `unverified`) e atualidade (`current`, `stale`) independentes; mensagens preservam o resultado da evidência.
- `src/web/pages/GlobalObservability.tsx`: mapa, Inspector, rótulos acessíveis e legenda agora compartilham o mesmo estado derivado. Negativos e falhas permanecem `error`/vermelho quando antigos; evidência positiva antiga fica `stale`. A mensagem geral de erro remete à evidência e horário no Inspector.
- `src/web/styles-neumorphic.css`: estado antigo positivo recebe a cor de aviso tanto no mapa quanto na legenda; cores contrastantes para aviso de falha em tema claro/escuro, conforme achado real de Axe no estado HTTP 503.
- `tests/observability-status.test.ts`: casos `ok=true/false` atuais e antigos, HTTP 503 atual/antigo, sem resposta e limite de 60 segundos.
- `tests/e2e/ux07-status-staleness.spec.ts`: relógio Playwright controlado; erro negativo antigo, refresh manual para positivo, positivo antigo, HTTP 503 atual/antigo, classes do mapa/Inspector, legenda, Axe claro/escuro e assertiva de somente GET. Captura em `test-results/mission-20/negative-stale-1280.png` (evidência local ignorada pelo Git).

## Validação

| Comando/procedimento | Ambiente | Resultado | Evidência e limitações |
|---|---|---|---|
| `npm ci` | Worktree isolada da Missão 20, Node 24.20.0 | Aprovado | 371 pacotes instalados; auditoria da instalação reportou 0 vulnerabilidades. npm emitiu avisos de scripts não autorizados de `esbuild` e `koffi`; build posterior completou sem alteração de política npm. |
| E2E na base antes da correção | Playwright, relógio controlado | Reprovado (regressão demonstrada) | Após 61 s, valor esperado `Desatualizado · Endpoint respondeu ok=false`; valor observado `Desatualizado · Endpoint respondeu ok=true`. Evidência do erro Playwright ficou em diretório temporário do runner. |
| `npm run typecheck` | Worktree isolada | Aprovado | Repetido após a implementação; resultado exit code 0. |
| `npm run build` | Worktree isolada | Aprovado | Repetido sobre a árvore final; Next.js e TypeScript do servidor concluídos, exit code 0. |
| `npx vitest run tests/observability-status.test.ts` | Worktree isolada | Aprovado | 8 testes passaram. |
| `npm test` | Worktree isolada | Aprovado | 69 arquivos, 212 testes passaram. Uma execução concorrente anterior sofreu timeout de 15 s no teste de criação de subprocesso; repetição sem concorrência passou. Nenhum gate foi relaxado. |
| `npm run test:e2e -- tests/e2e/ux06-07.spec.ts tests/e2e/ux07-status-staleness.spec.ts` | Playwright local, fixtures sanitizadas | Aprovado | 4 testes passaram na repetição final: mapa read-only/responsivo/teclado, easter egg, preview isolado e regressões de status. As rotas foram interceptadas; nenhuma operação MCP real executada. |
| Axe em tema claro/escuro | E2E com HTTP 503 sintético | Aprovado após correção de contraste | Axe não reportou violações nos escopos testados. A primeira execução identificou contraste 1,31:1 no aviso do tema escuro; cores por tema corrigidas e o E2E passou. |
| Captura `negative-stale-1280.png` | Playwright, desktop 1280 px, fixture | Aprovado | Renderização do status negativo envelhecido após correção; captura está em `test-results/mission-20/` e não é commitada. |
| `git diff --check` | Worktree isolada | Aprovado | Nenhum whitespace inválido. |
| GitHub Actions Linux | PR #21, SHA `86deca8daa1a61c91da3c3a92bd0a7f14b3cfac7`, run `44529596013` | Aprovado | Typecheck, build, unit/protocol tests e gate de vulnerabilidade aprovados; duração observada 56 s. |
| GitHub Actions Windows | PR #21, SHA `86deca8daa1a61c91da3c3a92bd0a7f14b3cfac7`, run `44529596013` | Aprovado | Build, parsing PowerShell, testes específicos, Chromium e jornadas MCP/acessibilidade aprovados; duração observada 2 min 55 s. |

## Problemas e riscos

- **Problema/causa:** `stale` tinha precedência sobre `error`, e `labelState()` interpretava todo `stale` como resultado positivo. A matriz de status colapsava a dimensão “resultado” com a dimensão “idade”.
- **Correção/verificação:** Derivação única para classe/semântica/label, com idade apenas como prefixo informativo. Negativo e falha HTTP mantêm estado vermelho; legenda deixa clara a semântica; relógio controlado cobre a fronteira de 60 s e refresh manual.
- **Achado adicional:** Axe demonstrou contraste insuficiente no aviso do tema escuro durante falha de leitura. Foram definidos fundo/texto/borda explícitos por tema e Axe passou nos dois temas.
- **Risco residual:** Dados exibidos continuam limitados aos endpoints/escopo local consultados, sem provar saúde integral do serviço. Fixtures e respostas sintéticas são usadas nos E2E, não representam conexões reais.

## Publicação

- **Branch/commit publicado:** `codex/missao-20-ux07-stale-status`; head `86deca8daa1a61c91da3c3a92bd0a7f14b3cfac7` no momento dos checks aprovados. Este commit contém código e o relatório/índice inicial; a atualização final do relatório é somente documental.
- **Pull Request/CI:** [PR #21](https://github.com/poyato70/azure-cost-local/pull/21), aberta contra `main`; checks Linux/Windows aprovados no SHA `86deca8`. Nova execução após a atualização documental pendente.
- **Estado do merge:** Não realizado; não autorizado.
- **Commit final confirmado na `main`:** Não aplicável.

## Pendências e evolução

- Confirmar checks Linux e Windows no head final após esta atualização do relatório. Não fazer merge.
