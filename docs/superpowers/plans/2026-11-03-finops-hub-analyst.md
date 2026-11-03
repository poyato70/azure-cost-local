# FinOps Hub Analyst Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar perfil rastreável, consulta Hub, conciliação e benefícios condicionais.
**Architecture:** Adapter Hub separado de transporte API/MCP, queries registradas no servidor, contexto autorizado compartilhado pelos dois chats e UI. Persistência versionada compatível com settings existentes.
**Tech Stack:** React, Fastify, TypeScript, MSAL, MCP SDK, Zod, Decimal.js.
**Spec:** docs/superpowers/specs/2026-11-03-finops-hub-analyst-design.md (aprovada).

## Global Constraints

Local Windows; sem instalação/deployment automático; sem KQL arbitrário; Hub ADX inicial; dinheiro decimal por moeda; dois meses civis completos anteriores; Secret só no cofre atual. Testes sintéticos não comprovam integração real.

## Review Focus

1. Query injection e token enviado a outro host: endpoints e parâmetros estritos (tarefa2).
2. Configuração alterada durante consulta: abortar e rejeitar resposta/cache antigos (tarefa2).
3. Dataset ausente/coluna desconhecida: indisponível, nunca zero (tarefas2/3).
4. FOCUS incompatível ou cobertura desconhecida: não declarar conciliado (tarefa3).
5. Perfil/template importado amplia ferramentas: vínculos e permissões continuam no serviço (tarefa4).

## Tarefa1 — Perfil

Arquivos: shared/connections.ts; server/agents/finops-template.ts; web/pages/Agents.tsx; tests/agents/finops-template.test.ts.
Interface: finopsTemplate() retorna campos de instruções e templateSource (id/version/sources/customized), preservados no CRUD; sem endpoint/Secret predefinido.
- [x] RED template não existe; testar regras financeiras e rastreabilidade.
- [x] Implementar botão Usar perfil Analista FinOps; salvar origem e customização.
- [x] GREEN teste/typecheck; commit.

## Tarefa2 — Hub e transportes

Arquivos: shared/hubs.ts; server/hubs/{queries,service,transport,routes}.ts; storage/config-store.ts; mcp/registry.ts; app.ts; tests/hubs/{queries,service,transport}.test.ts.
Interfaces: HubProfile versionado com accessId, endpoint, database=Hub, schemaVersion=v1_2, transport=api|mcp, mcpConnectionId opcional. HubService.costs(ctx,id,scope,basis,now?) -> HubCostResult. buildHubQuery(operation,scope,period) produz string determinística, validável apenas pela entrada do servidor.
- [x] RED templates rejeitam outro RG/injection, datas/moedas, erro/truncamento, endpoint inválido e revisão cancelada.
- [x] CRUD Hub sem novos Secrets; API ADX bound HTTPS/cluster audience; MCP fixed query com ferramenta aprovada/schema e gate sem liberar query livre.
- [x] Normalizar tabelas nomeadas/colunas, números exatos e ausência/partialidade; testar com fixture real HTTP local sem tokens reais.
- [x] GREEN testes/typecheck; commit.

## Tarefa3 — Conciliação e benefícios

Arquivos: server/hubs/{reconcile,benefits}.ts; tests/hubs/{reconcile,benefits}.test.ts.
Interfaces: reconcile(hub,arm,policy) retorna por moeda valores/diferenças e comparabilidade; HubService.benefits(ctx,id,scope,kind) retorna métricas verificadas ou unavailable por dataset.
- [x] RED moedas distintas, denominador zero, cobertura desconhecida, bases incompatíveis e dados ausentes.
- [x] Comparação explícita sem corrigir totais; queries de leitura registradas por dataset, escopo e schema; não agregar purchases billing como gasto RG.
- [x] GREEN; commit.

## Tarefa4 — Dashboard e ambos os chats

Arquivos: web/pages/Hubs.tsx, App.tsx, Chat.tsx; shared/connections.ts; server/chat/{tools,copilot}.ts; agents/runtime.ts; tests/e2e/hubs.spec.ts; testes de autorização.
Interfaces: selection.hubId opcional indica origem Hub explicitamente; hub tool aceita operation costs|reconcile|reservations|savingsPlans, usa scope do servidor, nunca endpoint/query do modelo. Todos os vínculos Hub/access/MCP e revisões são revalidados.
- [x] RED botão template, cadastro Hub, seleção limpa contexto, resultados parciais e ferramenta fora de vínculos bloqueada.
- [x] UI configuração/teste/consulta e tabela por moeda/mês; comparação e capacidades de compromissos. Ambos chats expõem wrapper mediado quando Hub selecionado; fonte Cost Management permanece comportamento original.
- [x] GREEN Edge/typecheck/build; commit.

## Tarefa5 — Verificação e entrega

- [x] Revisão independente final, uma correção dos achados materiais com regressão.
- [x] npm test; npm run typecheck; npm run build; npm run test:e2e; npm audit --omit=dev; git diff --check.
- [x] Documentar operação, matriz implementado/teste sintético/aceite real pendente; atualizar migração e README.
- [x] Reiniciar serviço preservando IDs; publicar repositório privado autorizado e verificar SHA remoto. Não criar Hub nem solicitar Secret pelo chat.

Self-review: quatro requisitos distribuídos pelas tarefas1–4; cinco riscos têm testes donos. Execução contínua nesta conversa; decisões no ledger. Implementação inicial pode prosseguir sem Hub real, mas aceite real ficará pendente.

Execução: templates e resultados/rotas organizados em módulos próprios; transporte ficou em service.ts para compartilhar revisão/identidade. Conciliação é informativa e não certifica equivalência; em falta de Hub/credenciais o aceite real continua pendente. Utilização percentual e simulação de compras não foram inferidas. Recomendações Savings Plans no schema Hub v1_2 ficam explicitamente indisponíveis sem contrato certificado; custos atribuídos Savings Plans são consultáveis. Revisão final única concluída e quatro achados corrigidos.
