# Missão 10 — Validação MCP ponta a ponta e auditoria funcional do Mapa de Conexões

## Identificação

- **Estado:** concluída e integrada à `main`.
- **Início observado:** 2026-11-15 22:16:45 -03:00.
- **Último registro de teste:** 2026-11-15 23:51:37 -03:00.
- **Integração confirmada:** 2026-11-15 23:57:22 -03:00.
- **Tempo observado até a integração:** 1 h 40 min 37 s.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch de trabalho:** `codex/missao-10-mcp-e2e`.
- **Base:** `origin/main` em `b664ccd9b7f4bdde3790df73782bd0ff78868488`; confirmado novamente após `git fetch`.
- **Pull Request:** [#5](https://github.com/poyato70/azure-cost-local/pull/5), merged.
- **Commits da branch:** `00f848b3d8f7...` e `3ce224d3e27a...`.
- **SHA integrado em `main`:** `77cd2a50e5900d1b1dfcc5c92baba7030ea66aaa`.

## Resumo

A aplicação e o servidor de teste trocaram mensagens MCP reais por Streamable HTTP no E2E e por stdio no teste de protocolo. A jornada no navegador cadastrou um endpoint local temporário, conectou, descobriu tools/resources/prompts, leu um resource, aprovou tools, preencheu e executou schemas, observou respostas de sucesso e erro, inspecionou o mapa e desconectou.

A auditoria encontrou e corrigiu dois problemas funcionais: o mapa priorizava tráfego HTTP genérico e escondia eventos MCP recentes; falhas de execução não atualizavam a atividade. Também ajustou a composição do mapa em tablet e implementou confirmação por execução quando o servidor sinaliza esse requisito em metadados. A confirmação é consumida a cada tentativa e exigida novamente na chamada seguinte; o backend recusa a execução se o campo não estiver confirmado.

## Plano e progresso

| Etapa | Estado | Evidência |
|---|---|---|
| 1. Inspecionar Git, serviço, SDK, registry, política, UI e testes | Concluída | Branch isolada sobre `origin/main`; serviço e portas do usuário preservados; SDK 1.32.2 e rotas documentados. |
| 2. Criar servidor MCP controlado com SDK | Concluída | `tests/fixtures/mcp-mission10-server.ts`; somente dados marcados `M10_FIXTURE_ONLY`; escrita limitada a diretório temporário. |
| 3. Validar stdio e Streamable HTTP | Concluída | Handshake, capacidades, chamadas, recursos, prompts, erro, sessão HTTP inválida e encerramento observados. |
| 4. Auditar autorização, schema, resultado e eventos | Concluída | Aprovação persistente por nome/hash, confirmação por chamada, rejeição de schema alterado, tool bloqueada e sanitização cobertas. |
| 5. Jornada Playwright com aplicação real | Concluída | `tests/e2e/mission-10-mcp.spec.ts`; uma jornada passou contra a aplicação de produção e fixture MCP real, sem mocks HTTP. |
| 6. Corrigir defeitos e auditar UX/acessibilidade responsiva | Concluída | Eventos MCP priorizados e atualizados após falha; mapa reorganizado para tablet; três viewports, teclado e movimento reduzido inspecionados. |
| 7. Validação final | Concluída | 55 arquivos/132 testes, typecheck, build, E2E e `git diff --check` passaram. |
| 8. Consolidar relatório e índice | Concluída | Relatório final e índice registram PR, resultados, limitações e SHA integrado. |
| 9. Abrir PR e integrar | Concluída | PR #5 integrada via merge commit; SHA remoto relido em `origin/main`. |

- **Progresso:** 9/9 etapas (100%). O percentual mede etapas concluídas, não prazo estimado.
- **Tempo desde o início até a integração:** 1 h 40 min 37 s.
- **Bloqueios:** nenhum bloqueio local. O transporte stdio da aplicação usa somente os lançadores fixos dos presets; por isso a fixture stdio foi exercitada pelo cliente/servidor SDK diretamente e não pelo registry da aplicação. O E2E da aplicação exercitou o registry e o endpoint Streamable HTTP.

## Ambiente e servidor controlado

- **SDK:** `@modelcontextprotocol/sdk@1.32.2`; Zod 4.6.7; Ajv já presente no projeto.
- **stdio:** subprocesso Node temporário executa `McpServer` com `StdioServerTransport`; `Client` negocia, lista e chama capacidades e encerra o filho.
- **Streamable HTTP:** servidor stateful local executa `McpServer`/`StreamableHTTPServerTransport`, com IDs de sessão; sessão desconhecida retorna 404. O E2E usa o registry real da aplicação e uma porta dinâmica local.
- **Capabilities:** quatro tools (`m10_read_status`, `m10_schema_echo`, `m10_controlled_error`, `m10_temp_write`), dois resources (texto e JSON estruturado) e dois prompts (argumento opcional e obrigatório). Descrições, resultados e conteúdo de teste contêm `M10_FIXTURE_ONLY`.
- **Efeito observável:** `m10_temp_write` grava somente em `M10_FIXTURE_TEMP`; política de tool destrutiva impede aprovação e execução no preset custom. Os testes confirmaram zero escritas não autorizadas.
- **Isolamento do E2E:** aplicação em `127.0.0.1:14517`, fixture HTTP em porta dinâmica, `LOCALAPPDATA` temporário, sem credenciais Azure/AWS/GCP. Ao encerrar, não ficaram listeners de teste nas portas 4317, 14317 ou 14517 nem processos correspondentes à fixture/aplicação da missão.

## Fluxos e política verificados

- Descoberta MCP real: handshake e capabilities, 4 tools, 2 resources e 2 prompts.
- Leitura MCP real do resource `m10-json-resource`; prompt obrigatório rejeitado sem argumento e aceito com argumento no teste de protocolo.
- Schema guiado de `m10_schema_echo`: texto obrigatório, número inteiro, booleano, enum, defaults, array de strings, objeto aninhado e campo opcional. O E2E confirmou resultado com os valores enviados e o formulário não exigiu JSON manual.
- Tool não aprovada e tool destrutiva: bloqueadas sem executar; schema alterado após descoberta: aprovação antiga recusada.
- Tool aprovada explicitamente: execução retorna resultado identificável; logs não registram argumentos nem credenciais.
- Confirmação por execução: `_meta["tesseract/approval"] = "each-call"` integra o hash de confiança. Sem confirmação, o backend rejeita a chamada; com confirmação, a tentativa chega ao servidor. A interface limpa a confirmação após a chamada, inclusive com erro, e exige novo consentimento.
- Erro MCP controlado: reportado como erro, diagnosticado como `mcp_tool_failed` e destacado em vermelho no mapa. O evento aparece junto aos sucessos reais.
- Desconexão: encerra a sessão; cadastro aparece salvo/desconectado.
- Aprovação por chamada é um metadado de política Tesseract, não um campo padronizado MCP. Servidores que não anunciam esse metadado continuam usando aprovação persistente por tool e hash até mudança do schema/metadados.

## Correções implementadas

- `src/web/components/ConnectionsMap.tsx`: atividade do mapa exibe apenas eventos MCP, para que chamadas importantes não sejam deslocadas por consultas de navegação.
- `src/web/pages/McpConnections.tsx`: uma falha de chamada atualiza os perfis e recarrega os diagnósticos; confirmação por chamada é apresentada e consumida no cliente.
- `src/web/styles-mission09.css`: até 900 px, provedor e integração são empilhados para preservar o nome completo e as relações do mapa em tablet.
- `src/shared/connections.ts`, `src/server/mcp/tool-policy.ts`, `src/server/mcp/registry.ts` e `src/server/connections/routes.ts`: propagam metadados, incluem-nos no hash de confiança e validam confirmação no servidor antes da execução.
- Test harness Playwright fecha explicitamente os handles dos logs; fixture mantém processos/dados no diretório temporário.

## Resultados de validação

| Verificação | Resultado observado | Evidência/limitação |
|---|---|---|
| Protocolo MCP stdio | Aprovado | Cliente/servidor SDK reais; handshake, tools, resources, prompts, erro, gravação temporária autorizada e encerramento. |
| Protocolo MCP Streamable HTTP | Aprovado | SDK real, sessão stateful, capacidades, erro e rejeição de sessão desconhecida. |
| Registry/política HTTP | Aprovado | 3 testes focados; execução real contra servidor SDK. |
| Jornada Playwright ponta a ponta | Aprovado | 1 teste passou em Edge headless; cadastro, conexão, descoberta, leitura, aprovação, confirmação por chamada, tool de sucesso e erro, resultado, atividade e desconexão. |
| Viewport 390 × 844 | Aprovado na inspeção | Sem overflow horizontal; mapa e formulários em coluna; captura `test-results/m10-qa-run/mission10-390x844.png`. |
| Viewport 768 × 1024 | Aprovado na inspeção | Mapa em coluna, nome “Personalizado” completo e feed MCP legível; captura `test-results/m10-qa-run/mission10-768x1024.png`. |
| Viewport 1280 × 720 | Aprovado na inspeção | Relações e feed lado a lado; captura `test-results/m10-qa-run/mission10-1280x720.png`. |
| Erro e atividade visual | Aprovado na inspeção | Evento `mcp_tool_failed` destacado; captura `test-results/m10-qa-run/mission10-activity-error.png`. |
| Teclado e movimento reduzido | Aprovado no teste | Foco visível após Tab; `prefers-reduced-motion` reduz transição dos cartões a `0s`. |
| Typecheck | Aprovado | `npm run typecheck`, código 0. |
| Build de produção | Aprovado | `npm run build`, código 0. |
| Suíte unitária completa | Aprovado | `npx vitest run --reporter=dot`: 55 arquivos, 132 testes passaram; duração 50,33 s, iniciou 23:51:37 -03. |
| `git diff --check` | Aprovado na revisão local | Repetir após estágio final antes do commit. |
| Scanner automatizado de acessibilidade | Não disponível | `@axe-core/playwright` e `axe-core` não estão instalados. Não se adicionou dependência nova; QA manual/Playwright não substitui auditoria quantitativa de contraste. |

### Timeout do teste de scripts Windows

Uma primeira execução da suíte paralela atingiu o limite de 30 s em `tests/server/service-scripts.test.ts` (cenário de ciclo de vida). O teste isolado passou em 25,334 s. Duas execuções posteriores da suíte completa passaram, incluindo a execução final de 132/132 em 50,33 s; não houve alteração no timeout nem nos scripts de serviço. A evidência sustenta flutuação sob concorrência/carga de workers, sem regressão persistente observada. Isso não prova que o teste nunca excederá o limite em outra carga de CI.

## Reprodução local

No Windows, a partir da raiz do repositório; nenhuma credencial externa é necessária:

```powershell
npm ci
npm run build
npx vitest run tests/mcp/mission10-protocol.test.ts tests/mcp/mission10-registry.test.ts --reporter=verbose --testTimeout=20000 --pool=forks --maxWorkers=1
npx playwright test --config=playwright.m10.config.ts
npx vitest run --reporter=dot
```

O Playwright inicia a aplicação compilada e o servidor HTTP MCP de teste, cria diretórios/portas temporários, guarda capturas/logs em `test-results/m10-qa-run/` e encerra os processos da fixture. O teste stdio está em `tests/mcp/mission10-protocol.test.ts` e pode ser repetido pelo comando focado acima.

## Segurança e escopo

- Sem tokens reais ou acesso a dados corporativos. Valores e capabilities usados são sintéticos.
- O servidor independente aceita somente chamadas MCP; nenhuma validação principal usa mocks REST.
- Eventos registram operação/status e omitem argumentos e credenciais. A sanitização de resultado remove campos de token/credencial; teste focado confirmou ausência do token sintético no resultado serializado.
- Nenhuma configuração Microsoft Entra foi alterada. Nenhuma operação destrutiva ocorreu fora do diretório temporário.
- Portas do serviço do usuário verificadas sem listener na inspeção inicial e final: 4317 e 14317.

## Publicação

- **Branch baseada em:** `origin/main` `b664ccd9b7f4bdde3790df73782bd0ff78868488`.
- **Commits:** `00f848b` (confirmação por execução) e `3ce224d` (fixture, testes e relatório).
- **Pull Request:** [#5 — Missão 10: validar jornada MCP e política de execução](https://github.com/poyato70/azure-cost-local/pull/5).
- **Estado:** merged em 2026-11-15 23:57:22 -03:00. O GitHub informou PR mergeable; não publicou status checks remotos para esta branch.
- **Merge commit confirmado em `origin/main`:** `77cd2a50e5900d1b1dfcc5c92baba7030ea66aaa`.

## Pendências

Missão encerrada. A inspeção automatizada de acessibilidade quantitativa permanece como melhoria futura, pois axe não fazia parte das dependências instaladas e não foi adicionada nesta missão.

## Último registro

2026-11-15 23:58:41 -03:00 — relatório final atualizado após a integração; SHA remoto `77cd2a50e5900d1b1dfcc5c92baba7030ea66aaa` confirmado em `origin/main`.
