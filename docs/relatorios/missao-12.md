# Missão 12 — Orquestração MCP e visualização de operações no Mapa de Conexões

## Identificação

- **Estado atual:** Implementação, QA e integração concluídos.
- **Início:** 2026-11-16 01:52:16 -03:00.
- **Último registro:** 2026-11-16 02:40:02 -03:00.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/missao-12-mcp-orchestration`.
- **Commit inicial:** `ee51e17a31fef86254fca603deefbbd332ed0cc1` (main da Missão 11).
- **Pull Request:** [#8](https://github.com/poyato70/azure-cost-local/pull/8), merged.
- **Commit de integração na main:** `d6ce754bac03aef4ef8c3bcde65872045ad5bfd3`.

## Objetivo e escopo

Compor duas chamadas MCP independentes em sequência, manter autorização e validação de schema do registry, transferir campos explicitamente mapeados e expor estado/correlação na superfície de Conexões. Referências consultadas: `ui_modelo.jpg` (grafite, relevo sutil, acento ciano/coral), `image (7).png` (topologia de nós) e `atahan_guc_pindown.io_1794792848.mp4` (pulso luminoso). Amostras temporárias do vídeo e evidências estão em `test-results/mission-12/` (diretório ignorado pelo Git).

## Progresso e duração

Plano operacional: 4 etapas verificáveis. **4/4 concluídas (100% das etapas; não é estimativa de tempo restante).** Duração observada do início até a integração PR #8: **47 min 05 s**.

| Etapa | Estado | Evidência |
|---|---|---|
| 1. Inspeção e contexto | Concluída | `AGENTS.md`, mapa, rotas, registry, política, diagnóstico, fixtures e CI inspecionados. SDK MCP 1.32.2; transporte Streamable HTTP. |
| 2. Implementação | Concluída | Serviço, rotas, visual A→B, autorizações, idempotência, correlação e relatório adicionados. |
| 3. Validação e revisão | Concluída | Suíte, build, typecheck, Playwright M10/M12, axe, auditoria e QA visual aprovados. |
| 4. PR, CI e integração | Concluída | PR #8 integrada após CI Linux e Windows aprovadas; SHA remoto confirmado. |

## Implementação observada

- `src/server/mcp/orchestration.ts`: execução sequencial por sessão, ID de correlação, estado para cada etapa, mapeamento estrito de `amount`, `currency`, `period`, confirmação de B, preservação de A em falhas, estado indeterminado sem retry automático, retenção em memória limitada a 100 execuções.
- `src/server/connections/routes.ts` e `src/server/app.ts`: POST start, GET por ID e POST de confirmação B. Session ID interno não é devolvido.
- `src/web/pages/McpConnections.tsx` e `src/web/styles-mission09.css`: topologia A→B, confirmação A e confirmação B conforme `_meta=tesseract/approval=each-call`, pulso só durante chamada e destaque estático em reduced motion. Perda de resposta preserva ID/chave para consultar o estado sem nova execução.
- Testes: duas instâncias `McpServer` reais Streamable HTTP; mapeamento, chamada única, B sem aprovação, erro em A, saída incompleta, erro em B preservando A e schema de B alterado. Playwright usa app real, duas fixtures MCP, estado local isolado e portas temporárias.

## Validação

| Verificação | Ambiente | Resultado | Evidência/limitação |
|---|---|---|---|
| `npx vitest run` | Windows | Aprovado | 56 arquivos, 133 testes; teste M12 também repetido após cenários finais. |
| `npx playwright test --config=playwright.m10.config.ts` | Windows, app real + fixtures MCP | Aprovado | 2 jornadas aprovadas (M10 e M12); refresh recupera o mesmo fluxo aguardando autorização. |
| `npm run typecheck` | Windows | Aprovado | Sem erros. |
| `npm run build` | Windows | Aprovado | Build Next.js e TypeScript de produção. |
| `npm audit --audit-level=high` | Windows | Aprovado | Zero vulnerabilidades; nenhuma dependência adicionada. |
| `git diff --check` e Prettier | Windows | Aprovado | Sem erros. |
| QA 390×844, 768×1024, 1280×720; Axe, Tab e reduced motion | Chromium headless | Aprovado | Sem overflow; axe sem violações; foco visível; pulso desativado sob reduced motion. Capturas revisadas em `test-results/mission-12/`. |
| CI run `43811379370` | GitHub Actions | Aprovado | Quality/Linux 1m00s; PowerShell/Windows 2m15s. [Run](https://github.com/poyato70/azure-cost-local/actions/runs/43811379370). |

## Segurança e limitações

- Todas as tools são chamadas via `McpRegistry.call`, usando identidade, aprovação e schema vigentes. Aprovação A não concede autorização a B.
- Diagnósticos não registram valores dos argumentos. A saída MCP é tratada como dado e exibida ao usuário.
- Execuções recuperáveis enquanto o serviço está ativo; o estado é volátil, limitado às 100 mais recentes e não persiste após reinício.
- Fixtures usam somente valores sintéticos e loopback. Nenhuma credencial ou endpoint corporativo foi acessado.
- Busca de padrões de chaves privadas/tokens nos arquivos alterados não encontrou resultados.

## Publicação

- **Branch:** `codex/missao-12-mcp-orchestration`.
- **Commit head publicado:** `94dd6cbefb23cc3d7ef5f0fe4795c5a2ec9ef3b8`.
- **PR:** [#8](https://github.com/poyato70/azure-cost-local/pull/8), merged.
- **CI:** [run `43811379370`](https://github.com/poyato70/azure-cost-local/actions/runs/43811379370), ambos os checks obrigatórios aprovados.
- **Commit final confirmado em `origin/main`:** `d6ce754bac03aef4ef8c3bcde65872045ad5bfd3`.

## Evolução opcional

Persistir estado além do ciclo de vida do processo, mantendo política explícita de privacidade, expiração e retenção.
