# Missão 14 — Correlação FinOps entre servidores MCP com proveniência verificável

## Identificação

- **Estado atual:** Concluída — implementação integrada à `main` via PR #12 após aprovação da CI Linux/Windows.
- **Início medido:** 2026-11-16 13:48:19 -03:00.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch de trabalho:** `codex/missao-14-finops-correlation`.
- **Worktree:** `D:\DEV\FinOps\Tesseract-missao-14`.
- **Commit inicial:** `87851310b08a8ef76c5d506da059b8c9ae6e8878` (`origin/main` na criação da worktree).
- **Pull Request/merge:** [PR #12](https://github.com/poyato70/azure-cost-local/pull/12), integrada em 2026-11-16; SHA de merge `d3935cc1bceecc447b6157a79e395939c3356888`.

## Objetivo e escopo

Executar análise reproduzível usando custos e inventário sintéticos de dois servidores MCP independentes, correlacionando somente identidade explícita e única. Custos não associados, ambiguidades, custos não alocáveis, moeda/período, valores e proveniência precisam permanecer visíveis. O fluxo usa as conexões, autenticação, autorização, chamadas e persistência já existentes; não acessa tenant, credenciais corporativas, dados operacionais nem o backup perdido da M13.

## Inspeção e decisão de arquitetura

- A checkout legada `D:\DEV\FinOps\Tesseract` está em `main` local `db9eed3274337f8e17b03d467ca2644ed852e513`, 29 commits atrás de `origin/main`, com mudanças staged e unstaged em `docs/demo/README.md`, `src/web/App.tsx`, `src/web/components/Navigation.tsx`, `src/web/pages/DemoWorkspace.tsx`, `src/web/styles.css` e `tests/e2e/demo-workspace.spec.ts`. Preservada e não usada para M14.
- A worktree M13 permanece limpa em `codex/missao-13-persistencia`, HEAD `1db27cec0088ae4b6a92a9d15529c84706def1a4`; stash `codex-preserve-before-mission-13` permanece presente. Não foram acessados o backup perdido nem o armazenamento operacional.
- Nova worktree M14 limpa, criada em `origin/main` `87851310b08a8ef76c5d506da059b8c9ae6e8878`.
- Evidência arquitetural: `McpOrchestration.start()` transfere somente `amount`, `currency` e `period` de A para B. Isso não transporta linhas de custos/inventário. `McpRegistry.call()` atualiza a conexão, revisa schema, aprovação, política e contexto antes de cada tools/call. `OrchestrationStore` persiste execuções, idempotência e estados de recuperação em `orchestrations.json`; os estados `approval_required` e `indeterminate` não são retomados automaticamente.
- **Decisão proposta para validação na implementação:** estender o orquestrador existente com um caminho FinOps tipado e limitado, mantendo intacto o fluxo M12 genérico. A usa `McpRegistry.call()` para retornar linhas de custo; B recebe somente escopo/período e retorna inventário; o Tesseract correlaciona localmente. O mesmo `OrchestrationStore` persiste execução, proprietário, idempotência e estados. Não criar DSL/workflow genérico nem persistência paralela.
- Valores monetários serão agregados com `decimal.js`, já presente no `package.json` e lockfile. A identidade demonstrativa será exata e composta por provedor, escopo e ID do recurso; sem normalização presumida por similaridade/case. Outras normalizações exigirão regra documentada por namespace.

## Plano e acompanhamento

| Etapa | Estado | Evidência/critério |
|---|---|---|
| 1. Inspeção e contexto | Concluída | Estado Git, worktrees, `AGENTS.md`, relatórios M10–M13, código M12/M13, Registry, persistência, UI, fixtures e CI inspecionados. Checkout com mudanças locais preservada. |
| 2. Contratos e correlação TDD | Concluída | `tests/finops/correlation.test.ts`: RED para módulo ausente, índice de linha errado e período inválido enviado antes de validação; suíte focada após correções aprovada. |
| 3. Integração MCP e interface | Concluída localmente | Duas fixtures reais Streamable HTTP, Registry e confirmação B independente, armazenamento M13, endpoint dedicado e painel na navegação existente. |
| 4. Regressões, segurança e UX | Concluída localmente | 178 testes unitários e M10/M12/M14 E2E aprovados; M14 cobre escopo, canonização, projeção e reinícios. |
| 5. Documentação e validação final | Concluída localmente | Build, audit, suíte, E2E, typecheck, relatório, índice e revisão final do diff aprovados. O histórico MCP M12 exclui execuções M14 e foi verificado no E2E. |
| 6. PR, CI e integração | Concluída | PR #12 integrada à `main`; Quality / Linux e PowerShell / Windows aprovados na execução CI #20 (run `43920106330`). |

- **Progresso:** 6/6 etapas completas (100%).
- **Tempo decorrido observado:** 52 min 30 s até 14:40:49 -03:00; sem estimativa de prazo.
- **Bloqueios:** nenhum bloqueio de implementação ou publicação identificado. `npm ci --ignore-scripts --prefer-offline` concluiu sem alterar manifests ou lockfile: 371 pacotes adicionados, 378 auditados, 0 vulnerabilidades; aviso de depreciação para `node-domexception@1.0.0`.

## Implementação

`src/server/finops/correlation.ts`: schemas Zod estritos, limite de 250 linhas por fonte, soma com `decimal.js`, identidade exata provider/scope/resource, classificação de custos compartilhados e sem ID, linhas sem associação, ambiguidades, conflitos de duplicata, totais separados por moeda/período e proveniência. Alias canônico só participa quando explicitamente fornecido pela fonte, mantendo o ID original. Índices de divergência preservam a posição original das linhas; créditos explícitos reduzem os totais.

`McpOrchestration.startFinOpsCorrelation` limita A→B ao contrato `{scope, from, toExclusive}` e usa o Registry existente em ambas as chamadas. Confirmação por chamada B é separada. A resposta A necessária para confirmação tem limite 16 KiB; correlação persistida tem limite 128 KiB. Retenção, idempotência, proprietário e recuperação reutilizam o store M13; nenhuma chamada indeterminada é repetida. A autorização de A/B continua dependente das ferramentas previamente aprovadas no Registry.

### Contratos sintéticos e regras de agregação

- **A / custos:** tool somente leitura recebe `scope`, `from` e `toExclusive`; retorna `{rows:[...]}` com `lineId`, `provider`, `scope`, `resourceId` opcional/nulo, período, `currency`, valor decimal textual, classificação (`usage`, `credit`, `shared`) e `evidenceRef`.
- **B / inventário:** tool independente recebe o mesmo escopo/período; retorna `{rows:[...]}` com `inventoryId`, provedor/escopo, ID original, ID canônico opcional declarado pela fonte, tipo/nome, região/grupo/metadados permitidos e evidência.
- As fixtures usam período fixo 2026-10-01 a 2026-11-01 exclusivo, scope `sub-01`, USD: custos `10.10` e `0.20` para `vm-01`, compartilhado `2.00` sem resource ID, não associado `3.00` para `vm-missing`. Inventário tem `vm-01` em `sub-01` e um ID igual em `sub-02`.
- Reconciliação esperada: total USD `15.30` (Decimal); `vm-01` associado soma `10.30`; `2.00` permanece não alocável e `3.00` não associado; recurso de outro escopo não é agregado e aparece como registro inválido. Não há conversão de moeda.
- Chave de associação é exata `(provider, scope, resourceId)`. Diferença de caixa/caracteres não é normalizada. Só usa ID canônico explícito quando fornecido e preserva os dois valores e a regra específica na proveniência. Duplicatas exatas de linha são contadas uma vez; conflito de ID de linha é excluído com posição original. Máximo de 250 linhas por fonte e respostas limitadas antes de continuar ao MCP B.
- Identificadores de execução A/B são correlação do request ID interno e não são IDs nativos retornados pelo MCP SDK; a fixture atual não expõe request IDs nativos. Isso limita a rastreabilidade a servidor/tool e execução lógica Tesseract.

`tests/finops/correlation.test.ts` documenta dados fixos e casos incluindo valores monetários, créditos, escopos, canonical IDs, duplicatas e proveniência. `tests/mcp/mission14-correlation.test.ts` usa dois servidores MCP Streamable HTTP independentes e verifica persistência, idempotência, colisão de chave, propriedade, autorização independente, escopo fora da solicitação, tamanho excessivo e ausência de reenvio de B. `tests/e2e/mission-14-finops-correlation.spec.ts` conduz a jornada real na UI, confirma totais/divergências/proveniência, Axe, três viewports, teclado e estados após dois reinícios reais.

## Validação

| Comando/procedimento | Ambiente | Resultado | Evidência e limitações |
|---|---|---|---|
| Inspeção read-only do Git, worktrees, documentos, contratos e chamadas | Windows local | Aprovado | HEAD, dirty worktrees e estado do stash registrados acima; nenhum dado operacional lido. |
| Inspeção do arquivo operacional, stash e worktree M13 | Windows local | Preservados | Nenhum acesso ao conteúdo operacional ou backup perdido; stash não aplicado nem alterado. |
| `npm ci --ignore-scripts --prefer-offline` | Windows local | Aprovado | 371 adicionados; manifests/lockfile preservados; 0 vulnerabilidades no audit da instalação. |
| `npx vitest run tests/finops/correlation.test.ts tests/mcp/mission14-correlation.test.ts --reporter=dot` | Windows local | Aprovado às 14:27 -03:00 | 17 focados; cobrem período, escopo, tamanho e projeção segura. REDs observados antes das correções. |
| `npm test -- --reporter=dot` | Windows local | Aprovado às 14:29 -03:00 | 61 arquivos, 178 testes, código de saída 0, incluindo recuperação autenticada após nova instância do serviço. |
| `npx playwright test --config=playwright.m10.config.ts --reporter=list` | Windows local | Aprovado às 14:33 -03:00 | M10/M12/M14: 3/3 após filtro de histórico; Axe sem violações; viewports 390×844/768×1024/1280×720; teclado; dois reinícios e fixtures MCP Streamable HTTP. |
| E2E M14 isolado | Windows local | Aprovado | Jornada integrada com fixtures reais, dois reinícios e armazenamento temporário exclusivo. Sessão anônima deixa de existir após reinício; evidência lida somente no sandbox. |
| `npm run typecheck` | Windows local | Aprovado às 14:27 -03:00 | `tsc --noEmit`, código de saída 0. |
| `npm run build` | Windows local | Aprovado às 14:29 -03:00 | Next.js compilado, páginas estáticas geradas e `tsc -p tsconfig.server.json` aprovado. |
| `npm audit --audit-level=high` | Windows local | Aprovado às 14:27 -03:00 | `found 0 vulnerabilities`. |
| `git diff --check` | Windows local | Aprovado às 14:27 -03:00 | Sem whitespace errors; também aplicado ao índice staged antes do commit. |

## Problemas e riscos

- **Limite herdado:** payloads ricos de A→B não cabem no mapeamento atual M12; motivo da proposta de adapter tipado.
- **Identidade de sessão:** o E2E confirma no arquivo temporário que o resultado e o estado recuperado persistem após reinício. Uma sessão anônima anterior não pode consultar o histórico pelo novo cookie após reinício; não foi contornada a autorização. Recuperação consultável pela UI após reinício depende de identidade proprietária estável/autenticada. Isso é consistente com o isolamento de proprietário da M13, mas exige sessão de usuário autenticada para demonstração de consulta recuperada.
- **Risco residual:** resultados externos podem permanecer indeterminados; não há exactly-once MCP. Reusar a reserva idempotente e não reenviar automaticamente.
- **Política:** cada Registry call valida aprovação/schema atuais. B exige confirmação independente quando a tool assim sinalizar; confirmação A não autoriza B.
- **Moeda/período:** incompatibilidades devem permanecer separadas ou excluídas com motivo explícito; sem conversão cambial.

## Publicação

- **Commit local de implementação:** `77760437c17b90e850a668849758b433df232e4e` (`feat: add persisted FinOps MCP correlation`).
- **Commit de documentação do estado local:** `d4c96f1488638ee24dc29a4cb474d2dfb4d6789f`.
- **Branch remota:** `codex/missao-14-finops-correlation` publicada.
- **Pull Request:** [PR #12](https://github.com/poyato70/azure-cost-local/pull/12), integrada.
- **CI:** execução #20 (`43920106330`); `Quality / Linux` e `PowerShell / Windows` concluídos com sucesso.
- **Estado do merge:** concluído por squash em 2026-11-16.
- **Commit de merge confirmado em `origin/main`:** `d3935cc1bceecc447b6157a79e395939c3356888`.

## Encerramento

A implementação M14, documentação e CI foram integradas após os checks obrigatórios passarem. A confirmação de `origin/main` foi feita com `git fetch origin main` e `git rev-parse origin/main`; o resultado corresponde ao SHA de merge registrado acima.
