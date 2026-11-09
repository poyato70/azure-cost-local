# Tesseract multicloud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Entregar a experiência multicloud aprovada preservando segurança e integrações locais.
**Architecture:** React/Vite e Fastify existentes. Conectores de consulta independentes, resposta financeira normalizada com evidência bruta e consolidação conservadora.
**Tech Stack:** TypeScript, React, Fastify, Zod, Decimal.js, Recharts, SDKs oficiais AWS/GCP, Vitest e Playwright.
**Spec:** ../specs/2026-11-09-multicloud-experience-design.md (aprovado pelo usuário em 09/11/2026).

## Global Constraints
- Aplicação local; preservar acessos/cofre e suporte explícito à rede corporativa.
- Sem conversão cambial ou soma automática de Kubernetes com nuvem.
- Publicar mudanças significativas e registrar cada commit no Linear P-ARG-2.
- Dados simulados não validam acesso financeiro real.

## Review Focus
- Revogação durante resposta HTTP: cancelar e não emitir resposta antiga.
- Troca de RG durante leitura de tags: descartar resultados anteriores.
- MCP selecionado: nenhuma consulta cai silenciosamente para Azure API.
- Falha parcial e moedas/bases diferentes: não gerar total enganoso.
- Endpoint privado, exportação ausente e credenciais expiradas: mensagem recuperável sem segredo.

### Task 1: Integridade e regressões
**Files:** src/server/agents/{http-agent,runtime}.ts; src/server/app.ts; src/web/pages/Budgets.tsx; tests/agents/http-agent.test.ts; tests/e2e/{dashboard,preliminary-fixes}.spec.ts.
**Interfaces:** manter HttpAgentClient.ask(message, signal), LocalAgentRuntime.ask e contratos existentes. HTTP externo recebe pergunta; contexto será explicitamente limitado ao contrato remoto.
- [ ] Testar erro HTTP sem vazamento e revogação durante chamada; observar falha.
- [ ] Sanitizar falhas, aplicar gate e cancelamento ao agente HTTP; esclarecer contexto efetivamente enviado.
- [ ] Proteger /api/budgets/locks contra seleção MCP; abortar leituras antigas de budgets/tags e validar fixtures.
- [ ] Rodar testes de regressão, typecheck e build; registrar evidências.
- [ ] Commit e registro no Linear.

### Task 2: Contratos e consultas multicloud
**Files:** src/shared/multicloud.ts; src/server/multicloud/{service,routes}.ts; src/server/app.ts; tests/multicloud/service.test.ts; package.json/package-lock.json.
**Interfaces:** CloudQuery {provider, from, toExclusive, configuration}; CloudResult {provider, currency, basis, rows, total, raw, warnings, queriedAt}; queryCloud(query, signal): Promise<CloudResult>; consolidateCloudResults(results) agrupa somente bases/moedas comparáveis, alocação separada.
- [ ] Testar paginação AWS, créditos GCP, tabela inválida, limite BigQuery, alocação OpenCost, falhas parciais e bases incompatíveis.
- [ ] Implementar conectores AWS por perfil local/SSO, GCP ADC e OpenCost com endpoint validado, timeout e cancelamento. Não persistir segredos novos em texto.
- [ ] Expor rota local autenticada por sessão com validação estrita, sem vazar respostas de erro upstream.
- [ ] Rodar testes, typecheck/build; documentar pré-requisitos reais e custos de execução BigQuery.
- [ ] Commit e registro no Linear.

### Task 3: Experiência e visão multicloud
**Files:** src/web/App.tsx; src/web/styles.css; src/web/pages/Multicloud.tsx; src/web/components/CloudResults.tsx; tests/e2e/multicloud.spec.ts; docs/validation.md.
**Interfaces:** Multicloud independente do escopo Azure; CloudResults recebe CloudResult e oferece gráfico/tabela/JSON; navegação agrupada preserva páginas existentes.
- [ ] Capturar estado atual para auditoria de UX e registrar limitações; testar navegação, consulta e dados brutos com fixtures identificadas.
- [ ] Aplicar identidade própria e navegação por tarefas, busca e formulários por provedor; estados locais junto às ações.
- [ ] Implementar consultas múltiplas com status por fonte e totais compatíveis sem dupla contagem.
- [ ] Verificar desktop e larguras pequenas, teclado e ausência de overflow; rodar suite e build.
- [ ] Atualizar roteiro Windows, limites de validação e versão; revisão independente final; commit, publicar GitHub e registrar no Linear.

## Registro de execução
Execução direta nesta sessão conforme autorização de implementar até concluir; decisões rotineiras resolvidas sem novas aprovações. Auditoria visual não equivale a teste financeiro. Revisão independente final exigida antes de encerrar.
