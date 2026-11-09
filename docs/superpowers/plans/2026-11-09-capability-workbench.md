# Capability Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute directly with independent final review.

**Goal:** Implementar desenho aprovado de navegação, laboratório MCP/API/agentes e custos Azure por tag.
**Architecture:** Reutilizar serviços Fastify/React e política de endpoints. Expandir capacidades MCP por operações explicitamente suportadas, sem execução automática.
**Tech Stack:** TypeScript, React, MCP SDK, Lucide, Zod, Vitest, Playwright.
**Spec:** ../specs/2026-11-09-capability-workbench-design.md — aprovado.

## Global Constraints
Preservar cofre/configuração. Fontes personalizadas não desativam segurança. Sem fallback de canal. Somente leitura autorizada; testes financeiros reais e aceite visual separados.

## Review Focus
Catálogo ausente versus vazio; cancelamento/revogação; credenciais em evidência; tags históricas versus atuais; navegação por teclado/mobile.

### 1. Navegação e contexto
Files: src/web/components/Navigation.tsx, Welcome.tsx; App.tsx; styles.css; pages/Help.tsx.
- [ ] Menu em árvore com Lucide monocromático, rótulos preservados e seleção discreta.
- [ ] Aviso prévio e bloqueio de consulta Azure incompatível; esclarecer tags de governança.
- [ ] Boas-vindas acessível e movimento reduzido. Ajuda contextual e links oficiais.

### 2. Laboratório e descoberta
Files: server/mcp/catalog.ts, registry.ts, connections/routes.ts; web/pages/McpLab.tsx, Discovery.tsx; McpConnections.tsx.
Interfaces: catalog(ctx,id): capacidades e catálogos paginados; inspect(ctx,id,kind,args): leitura explícita de prompt/resource listado. Políticas existentes permanecem.
- [ ] Testes de paginação, capacidades ausentes e limites antes do código.
- [ ] Separar Integração/Análise/Descoberta; integração configura; análise inspeciona e usa executor atual de tools.
- [ ] Catálogo oficial e manifesto personalizado HTTPS com consentimento, sem execução/instalação automática.
- [ ] Avaliação de agentes e APIs com contratos e teste de leitura existente, correlação e logs.

### 3. Custos por tag
Files: shared/contracts.ts; server/costs/service.ts; web/pages/TagCosts.tsx; tests/costs/tag-query.test.ts.
Interfaces: CostQuery.tagFilter {name,values}; Query API dataset.filter.tags. Agrupamento por ResourceId/ServiceName já existente.
- [ ] Testar filtro transmitido e validação de entradas.
- [ ] UI por tag histórica da cobrança com escopo/período, resultado gráfico/tabela/JSON. Comparação com inventário atual deve ter cobertura explícita; não simular herança.

### 4. Verificação e publicação
- [ ] Typecheck, testes de serviço/navegador, build e revisão independente.
- [ ] Documentar capacidades entregues e pendências reais; publicar commits significativos e registrar no Linear ARG-20.
