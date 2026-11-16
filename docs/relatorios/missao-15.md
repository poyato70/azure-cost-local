# Missão 15 — Integração FinOps real, contratos de dados e confiabilidade financeira

## Identificação

- **Estado atual:** Entrega técnica integrada à `main`; integração Azure real continua pendente de acesso autorizado, discovery e chamada efetiva.
- **Início medido:** 2026-11-16 16:13:59 -03:00 (marco observado no relógio da sessão).
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/missao-15-finops-real`.
- **Worktree:** `D:\DEV\FinOps\Tesseract-missao-15`.
- **Commit inicial:** `95ffe00e36f1b641dcb1bfc5fb54f62df5bccdf5`.
- **Pull Request:** [#14](https://github.com/poyato70/azure-cost-local/pull/14), integrada por squash.
- **Commit integrado em `main`:** `b4a5d7f6920fe365d52264c005c344d90bf29bab`.
- **CI do HEAD final do PR:** workflow `CI`, run `43944231600` (#26), jobs Linux e Windows aprovados.

## Objetivo, escopo e decisão provisória

Preparar um caminho Azure somente leitura através do ARM MCP, adaptando respostas para os contratos internos M14 sem substituir o fluxo sintético existente. O adaptador e suas fixtures podem ser validados localmente sem credenciais. A consulta real só será declarada validada após `tools/list`, autorização, chamada MCP efetiva e captura sanitizada da resposta do ambiente autorizado.

**Decisão provisória:** selecionar Azure Resource Manager MCP (`https://mcp.management.azure.com`) porque o catálogo oficial atual documenta `query_costs` para custo real e `execute_query` para Azure Resource Graph. O Tesseract também já contém o serviço direto `AzureCosts` usando ARM REST, mas isso não comprova uso MCP nem capacidade de inventário; não será apresentado como validação M15.

| Capacidade | Disponibilidade documentada | Autorização | Contrato | Evidência atual |
|---|---|---|---|---|
| Consulta de custos | `query_costs` documentada pelo ARM MCP | Depende de `MCP.Access`, RBAC e escopo de Cost Management | Parâmetros listados em docs; resultado descrito como linhas de custo/uso até 100, schema observado localmente ainda ausente | `https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-resource-manager-mcp-tools`; `https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/CostManagementAndPricingTools.md` |
| Inventário | `execute_query` documentada para Azure Resource Graph | Depende de identidade e RBAC de leitura no escopo | Query/`options`; paginação por `skipToken`; resultado MCP exato a confirmar por discovery | Mesmo tool reference; troubleshooting oficial recomenda continuar enquanto existir `skipToken` |
| Escopo | Subscription, resource group, management group ou billing conforme ferramenta | Identidade selecionada e permissões atuais | Query de custo recebe `scope`; inventário terá query gerada localmente e fixada ao escopo cadastrado | Tool reference e política local `src/server/mcp/arm-policy.ts` |
| Período/métrica | `query_costs` aceita `timeframe` ou datas, granularidade, dimensão e métrica | Permissão não observada no tenant | Período e métrica são enviados explicitamente; custos reais, amortizados e preços de varejo não serão misturados | `CostManagementAndPricingTools.md` |

**Estado real desta inspeção:** conexão Azure ARM autorizada não foi descoberta nem chamada; nenhum tenant, conta ou credencial foi consultado. A disponibilidade runtime, schemas reais, permissões, contrato de resposta e reconciliação real permanecem **PENDENTES/BLOQUEADOS por acesso**.

## Plano e acompanhamento

| Etapa | Estado | Evidência/critério |
|---|---|---|
| 1. Inspeção e seleção da fonte | Concluída | Inspeção do worktree, M14, políticas, autenticação, orquestração e fontes oficiais; acesso real marcado pendente. |
| 2. Contrato e adaptador Azure ARM MCP | Concluída localmente | `azure-arm-mcp-adapter.ts` mapeia schemas descobertos, falha fechada, limita linhas, preserva IDs de origem e adapta tabelas/linhas para contratos M14. Fixtures contratuais em `tests/finops/azure-arm-mcp-adapter.test.ts`. |
| 3. Integração M14 e interface | Concluída localmente | Fluxo sintético preservado; modo Azure restrito à mesma conexão ARM, escopo cadastrado e tools `query_costs`/`execute_query`; UI identifica sintético/Azure, métrica e limitações de reconciliação. |
| 4. Testes e segurança | Concluída localmente | 62 arquivos/190 testes unitários; fixtures contratuais para mapeamento, partial, duplicidade, ID case-insensitive e autorização exata. Playwright 40/40 com duas fixtures MCP e reinicialização real. |
| 5. Validação final e documentação | Concluída | Typecheck, build, audit, `git diff --check`, Axe e viewports registrados; CI Linux/Windows concluída com sucesso. |
| 6. PR, CI e integração | Concluída | PR #14 integrada por squash; run #26 aprovou `Quality / Linux` e `PowerShell / Windows`; SHA de `main` confirmado. |

- **Progresso:** 6/6 etapas de entrega completas (100%); validação Azure real permanece pendente como critério adicional separado.
- **Tempo decorrido:** 45m15s no marco de 2026-11-16 16:59:14 -03:00, medido desde o início observado.
- **Bloqueio residual:** não há conexão autorizada ao Azure ARM MCP nesta execução; schemas dinâmicos e payloads reais não podem ser confirmados. Nenhum bypass ou credencial foi usado.

## Inventário AS-IS inicial

- `src/server/costs/service.ts` implementa consultas diretas à Azure Cost Management Query REST API, com escopo autorizado, período, agregação Decimal e limite de paginação. Isso é código existente e não prova integração atual a tenant. Fonte: símbolo `AzureCosts.queryCosts`.
- `src/server/mcp/presets.ts` define preset `arm` no endpoint `https://mcp.management.azure.com`; `src/server/auth/resource-scopes.ts` define audience MCP ARM.
- Na base inicial M15, `src/server/mcp/tool-policy.ts` permitia `query_costs`, mas não `execute_query`; M15 adiciona somente a allowlist de leitura com validação estrita de query gerada pelo servidor.
- Na base inicial, `src/server/mcp/arm-policy.ts` rejeitava query genérica. M15 mantém a recusa de query/destinos genéricos e permite unicamente a projeção exata escopada e limitada do adaptador.
- M14 usa `src/server/finops/correlation.ts` e `McpOrchestration.startFinOpsCorrelation` com contratos de fixtures `{rows}`. Payloads externos não são intercambiáveis automaticamente com esses schemas.
- A API e UI M14 já selecionam conexões/tools MCP e exibem resultados e proveniência. Não foi identificada consulta real nesse fluxo.
- O ARM MCP está documentado como preview; schemas variam e devem ser descobertos no cliente. A disponibilidade de `query_costs`/`execute_query` na conexão configurada e o shape real de resposta são desconhecidos nesta sessão.
- As fontes oficiais consultadas divergem em limites de linhas documentados: a página Learn indica até 100 linhas, enquanto material upstream consultado menciona máximo 5000. M15 escolhe o teto conservador 100, sem assumir que a paginação real está implementada.

## Implementação

- **Adaptador de custos:** valida schema runtime para escopo, período, métrica e `ResourceId`; mapeia `ActualCost`/`AmortizedCost`; limita consulta a 100 linhas; aceita apenas payloads identificados de linha ou tabela Cost Management. Valores são tratados com `Decimal`. Não classifica créditos sem campo de origem; agregações sem ID de recurso permanecem não alocáveis pelo contrato M14. O adaptador marca respostas desconhecidas como erro, duplicidades como parcial e linhas conflitantes/inválidas como rejeitadas.
- **Adaptador de inventário:** gera query Resource Graph fixa por subscription/RG, projeta somente id/nome/tipo/localização/grupo/subscription, solicita página limitada a 250 quando o schema permite, rejeita linhas fora do escopo, e marca continuação/truncamento como parcial sem afirmar completude.
- **Normalização:** IDs ARM são comparados sem diferenciar caixa conforme documentação Azure; os custos usam chave canônica minúscula e preservam `originalResourceId`; inventário mantém `resourceId` recebido e inclui `canonicalResourceId` quando necessário. Query de RG usa comparador case-insensitive `=~`.
- **Orquestração/política:** modo Azure exige mesma conexão ARM, escopo idêntico ao Registry, schemas atuais aprovados e tools revisáveis. `execute_query` foi incluída na allowlist de leitura; política autoriza exclusivamente a query determinística do adaptador e opções de paginação limitadas. Sem retry automático. A execução sintética continua default e requer conexões distintas como antes.
- **UX:** seletor de demonstração sintética ou Azure ARM MCP preview, mesma conexão no modo Azure, escopo cadastrado somente leitura, métrica explícita, estado da fonte no resultado/histórico, parcialidade e ausência de total independente claramente comunicadas.
- **Reconciliação financeira:** não existe total independente da fonte demonstrado no contrato MCP disponível. A UI não apresenta o total calculado pelas linhas como reconciliação validada; os resultados ficam com `sourceTotalReconciliation: not_available`. Uma consulta inventory atual também não prova o estado histórico do recurso.

## Validação

| Comando/procedimento | Ambiente | Resultado | Evidência e limitações |
|---|---|---|---|
| Leitura do prompt M15, `AGENTS.md`, relatório M14, contratos, auth, política MCP, orquestração, UI, fixtures e CI | Windows local, worktree M15 | Aprovado | Worktree criada em `95ffe00`; checkout legada e suas alterações locais preservadas. |
| Leitura da documentação Microsoft/Azure atual | Pesquisa web | Aprovado | Referências oficiais acima; documentação identifica tool names e ressalta schemas mutáveis durante preview. Não equivale a runtime discovery. |
| `npm ci` | Worktree M15 | Aprovado | Instaladas dependências conforme lockfile, sem alteração intencional do manifesto/lock. NPM reportou zero vulnerabilidades; scripts de instalação de `esbuild` e `koffi` não foram executados por política de allow-scripts. |
| `npm run typecheck` | Worktree M15 | Aprovado após correção | Primeira execução encontrou shadowing de `costRows` e tipagem de correlação; ambos corrigidos. Execução seguinte concluiu sem erros. |
| `npx vitest run tests/finops/azure-arm-mcp-adapter.test.ts tests/mcp/arm-policy.test.ts tests/mcp/mission14-correlation.test.ts` | Worktree M15 | Aprovado após correção | 3 arquivos, 15 testes aprovados. Primeira rodada identificou shadowing e regressão sintética por não atribuir resultado local; correções feitas e reteste passou. |
| `npm test` | Worktree M15 | Aprovado | 62 arquivos, 190 testes aprovados. |
| `npm run build` | Worktree M15 | Aprovado | Next otimizado compilado e TypeScript server concluído. |
| `npm run test:e2e` | Worktree M15 | Aprovado | 40 testes aprovados. Inclui M14 com duas fixtures MCP, reinicialização real, autorização pendente, seleção Azure sem credenciais/dados sintéticos, Axe sem violações reportadas, teclado e viewports 390×844, 768×1024, 1280×720. Primeira tentativa paralela ao build falhou porque `dist/server/main.js` ainda não havia sido produzido; execução serial após build passou. |
| `npx playwright test --config=test-results/mission15-m10-m12.config.mjs` (config temporária removida após uso) | Worktree M15 | Aprovado | M10 e M12, 2/2. M12 já passava; M10 revelou que `page.goto("/")` navegava ao `baseURL` global em vez da aplicação própria na porta 14517. O teste foi corrigido para visitar explicitamente seu servidor isolado e passou. Tentativas iniciais com configurações temporárias incompletas não são contadas como resultado aprovado. |
| `npm audit --audit-level=high` | Worktree M15 | Aprovado | Zero vulnerabilidades reportadas. `npm ci` também indicou zero vulnerabilidades; seus avisos dizem que scripts de instalação de `esbuild`/`koffi` não foram executados por política do npm. |
| `git diff --check` | Worktree M15 | Aprovado | Reexecutado depois das alterações finais e sem erros de whitespace. `package.json` e `package-lock.json` não têm diff; instalação não atualizou as dependências declaradas. |
| `tools/list` no ARM MCP / consulta de custos / inventário | Não executado | Bloqueado | Exige acesso e autorização Azure; não foi consultado tenant nem usada credencial. |

## Preservação

- Checkout legada `D:\DEV\FinOps\Tesseract` permanece em `db9eed3274337f8e17b03d467ca2644ed852e513`, 31 commits atrás de `origin/main`, com mudanças locais staged preservadas; não será usada para alterações M15.
- Worktree M13 permanece em `1db27cec0088ae4b6a92a9d15529c84706def1a4`.
- Stash `codex-preserve-before-mission-13` permanece listado e intocado.
- Worktrees M14 e M14 closeout mantidas; nenhuma remoção ou operação de limpeza executada.
- Nenhum acesso aos dados operacionais locais ou ao backup perdido M13.

## Segurança e riscos residuais

- Nenhuma consulta externa/tenant ocorreu.
- A validação Azure alcançada é **contratual com fixtures**. O E2E integra a aplicação real a duas fixtures MCP controladas, não ao ARM MCP Microsoft.
- A configuração Playwright padrão continua ignorando M10 e M12; ambos foram executados de forma explícita em uma configuração temporária e isolada. A falha de M10 expôs baseURL incorreta no próprio teste e foi corrigida, sem remover as proteções de isolamento.
- A análise Axe em Playwright não constitui declaração de conformidade WCAG integral; a renderização foi validada nos três tamanhos em browser, mas a revisão visual humana não foi executada nesta sessão.
- O primeiro E2E foi iniciado simultaneamente com o build e não iniciou devido à ausência transitória de `dist/server/main.js`; a repetição após build completo passou 40/40.
- Schemas e respostas do ARM MCP em preview precisam de descoberta real; fixtures nunca serão apresentadas como capturas reais.
- `query_costs` pode agregar até 100 linhas por chamada; paginação/truncamento e totais devem ser representados como parciais até a completude ser comprovada.
- `execute_query` executa Azure Resource Graph. Somente query determinística construída pelo servidor para campos de inventário pode ser permitida; query arbitrária ou operação de escrita não pode ser aprovada pelo fluxo M15.
- O inventário atual não prova que o recurso existia com mesmo estado no período histórico de cobrança.
- O serviço `AzureCosts` direto já existente continua fora do caminho MCP M15; não misturar resultados nem declarar esse serviço como validação do adaptador.

## Publicação

- Commits do branch de trabalho: implementação `8abc41afe78fe4a72d6480de294164b0bd6fe797`, documentação/CI `dee1f0d4ed1049bee22dce8c86bb371f551751d4` e fechamento pré-merge `cc7384c2d394a645b390bf819db1b0522f506a42`.
- Branch remota: `codex/missao-15-finops-real`.
- Pull Request [#14](https://github.com/poyato70/azure-cost-local/pull/14) foi integrada por squash em `2026-11-16T19:58:35Z`.
- SHA remoto de `main`, conferido por Git e metadados do PR: `b4a5d7f6920fe365d52264c005c344d90bf29bab`.
- CI do HEAD final `cc7384c2d394a645b390bf819db1b0522f506a42`: workflow `CI`, run `43944231600` (#26); `Quality / Linux` e `PowerShell / Windows` concluídos com `success`. Windows incluiu E2E M10/M12/M14 e acessibilidade; Linux incluiu typecheck, build, unit/MCP e dependências.
- Nenhuma credencial ou dado corporativo incluído no relatório.

## Pendências e evolução

1. Realizar discovery `tools/list` e consulta somente leitura com identidade e autorização corporativas aprovadas; registrar schema/runtime e amostra sanitizada.
2. Revisar payloads reais e verificar completude/paginação, status do RBAC e limites da fonte antes de habilitar uso operacional. Não contornar controles.
3. Concluir revisão visual humana em browser; Axe e viewports automatizados não substituem essa aceitação.

As pendências 1–2 bloqueiam a classificação de **integração real validada**, mas não anulam a entrega técnica contratual publicada. Não chamar dados sintéticos ou fixtures de dados reais.
