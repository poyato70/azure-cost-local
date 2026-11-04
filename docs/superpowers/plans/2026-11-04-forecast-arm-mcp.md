# Forecast e ARM MCP — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans para execução contínua; uma revisão independente final.

**Goal:** acrescentar previsão oficial ao dashboard/API/chat e preparar prova de conceito ARM MCP com usuário, avaliando MCP local separado.
**Architecture:** Forecast independente de custos realizados; serviços de negócio mantêm ARM direto. Preset ARM MCP HTTP delegado, endpoint/resource fixos, tools de leitura e escopo configurado; sem fallback silencioso. MCP próprio é análise de reaproveitamento, não implementação autorizada pelo terceiro item.
**Tech Stack:** TypeScript, Fastify, React, MSAL, MCP SDK e Decimal.js existentes.
**Spec:** três direções selecionadas pelo usuário em 04/11/2026; docs/cost-management-mcp-options.md.

## Global Constraints

Aplicação local, credenciais no cofre atual; não mudar Entra/RBAC automaticamente; previsões não são fatura nem gasto realizado; ausência de histórico não é zero; moedas e estados parciais preservados; não executar tools de escrita.

## Review Focus

- Forecast misturado com realizado: separar CostStatus, totais por moeda e datas (tarefa1).
- Paginação externa/circular e schema inesperado: bloquear/fail closed, parcial explícito (tarefa1).
- Endpoint malicioso recebe token ARM MCP: origem fixa e scope MCP.Access do recurso descoberto (tarefa2).
- Tool ARM recebe scope diferente aninhado: exigir escopo fixo e recusar formatos desconhecidos (tarefa2).
- Token/logout/edição em andamento: preservar sinais e versões existentes (tarefas1–2).

## Tarefa1 — Forecast oficial por API

Arquivos: shared/forecast.ts, server/forecast/service.ts, web/pages/Forecast.tsx, app.ts, chat/tools.ts, web/api.ts, App.tsx; tests/forecast/service.test.ts e teste Edge.
Interface: ForecastService.query(ctx,ForecastQuery)->ForecastResult; ForecastQuery scope/period/basis/includeActual; ForecastResult rows(costStatus), forecastTotals/actualTotals e meta.
- [x] Testes: datas exclusivas, moedas, segregação Actual/Forecast, resposta vazia sem zero, status inválido e paginação externa. Cancelamento usa o sinal existente; não houve teste dedicado novo desse limite.
- [x] Implementar API 2025-03-01 validada na documentação; granularity Daily, Cost sum; sem grouping arbitrário. Rota /api/forecast/query exige autorização de subscription. UI usa filtros e sugestão mês atual. Chat azure_query operation forecast reutiliza serviço, sem permitir endpoint livre.
- [x] GREEN testes/typecheck/build; verificar UI e commit.

## Tarefa2 — ARM MCP delegado

Arquivos: shared/connections.ts, auth/resource-scopes.ts, identity-provider.ts, mcp/presets.ts/registry.ts/tool-policy.ts; web/pages/McpConnections.tsx; testes de política/transporte e UI.
Interface: preset arm, URL https://mcp.management.azure.com, audience api://22bfbae3-f4e7-485f-be43-8cee15065084, scope MCP.Access; header x-mcp-toolset: CostManagement. resourceContext.scope define subscription/RG autorizado.
- [x] RED: bloquear app-only, endpoint/audience trocados, escrita e scope diferente; assegurar login/silent com mesmo scope exato.
- [x] Preset/teste/descoberta, aprovação nome/schema apenas leituras e escopo fixo. Payload desconhecido bloqueado. Resultados ARM genéricos limitados/identificados como possivelmente parciais; não alimentar cartões diretamente.
- [x] Teste de disponibilidade/metadados público real sem token; teste MCP initialize/list/call por fixture HTTP local. Login/consulta real requerem usuário e permissão do tenant; registrar pendência, não simular sucesso.

## Tarefa3 — avaliação MCP local e entrega

- [x] Relatório de serviços reutilizáveis, requisitos de stdin/stdout, seleção explícita da identidade, ferramentas de leitura, Forecast e limites de dados; não criar servidor/processo persistente nem alterar configuração global Copilot.
- [x] Uma revisão independente final e um passe de correção dos achados materiais com regressões.
- [x] npm test, typecheck, build e testes Edge relevantes; docs de operação/estado; reinício preservando IDs; publicação privada autorizada e confirmação SHA.

Autorrevisão: três itens cobertos; riscos mapeados às duas tarefas de código; não instalar plugin global nem exigir novo modelo/infraestrutura. Manter branch atual com trabalho limpo no início. Execução inline nesta conversa.

Estado: implementação e verificações técnicas concluídas; login/leitura real ARM e Forecast permanecem pendentes do usuário. Publicação privada autorizada em andamento. Evidências detalhadas em docs/validation.md e docs/forecast-arm-operation.md.
