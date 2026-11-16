# Missão 12 — Orquestração MCP e visualização de operações no Mapa de Conexões

## Identificação

- **Estado atual:** PR #8 aberta; primeira execução de CI passou; revisão documental final será validada na nova execução.
- **Início:** 2026-11-16 01:52:16 -03:00.
- **Último registro:** 2026-11-16 02:36:11 -03:00.
- **Repositório:** `poyato70/azure-cost-local`.
- **Branch:** `codex/missao-12-mcp-orchestration`.
- **Commit inicial:** `ee51e17a31fef86254fca603deefbbd332ed0cc1` (main atualizada da Missão 11).
- **Pull Request / commit publicado:** Ainda não criados.

## Objetivo e escopo

Compor duas chamadas MCP independentes em sequência, manter autorização e validação de schema do registry, transferir campos explicitamente mapeados e expor estado/correlação na superfície de Conexões. Referências visuais consultadas: `ui_modelo.jpg` (grafite, relevo sutil, acento ciano/coral), `image (7).png` (topologia de nós) e vídeo `atahan_guc_pindown.io_1794792848.mp4` (pulso luminoso). As amostras do vídeo foram guardadas temporariamente em `test-results/mission-12/references/`.

## Progresso e duração

Plano operacional: 4 etapas verificáveis. **3/4 concluídas (75% das etapas; não é estimativa de tempo restante).** Tempo observado no registro: aproximadamente 43 min 55 s desde o início informado no gerador.

| Etapa | Estado | Evidência |
|---|---|---|
| 1. Instruções, branch, arquitetura e referências | Concluída | `AGENTS.md`, Mapa, rotas, registry, política, diagnóstico, fixture M10 e CI inspecionados. SDK presente: `@modelcontextprotocol/sdk` 1.32.2; Streamable HTTP real disponível; E2E M10 é executado em Windows CI. |
| 2. Serviço, rota e UI sequencial | Concluída | Serviço, endpoints, visual A→B, confirmações e idempotência adicionados; API não devolve o session ID interno. |
| 3. Validação e revisão | Concluída localmente | Suíte, build, typecheck, Playwright M10+M12, axe, viewports, audit e diff passaram; capturas revisadas em 390×844, 768×1024 e 1280×720. |
| 4. PR, CI e integração | Pendente | Aguardando commit/PR e CI remota. |

## Implementação observada

- `src/server/mcp/orchestration.ts`: estado por sessão limitado aos 100 fluxos recentes, ID de correlação, sequência A→B, mapeamento estrito de `amount`, `currency`, `period`, confirmação de B, resultado A preservado em falhas, estado indeterminado em erros de transporte não classificados e sem retries automáticos.
- `src/server/connections/routes.ts` e `src/server/app.ts`: POST start, GET da execução por ID (recuperável após refresh enquanto o processo permanece ativo) e POST de confirmação B.
- `src/web/pages/McpConnections.tsx` e `src/web/styles-mission09.css`: controles A/B, representação da topologia, confirmação de execução A e confirmação separada de B quando `_meta` é `tesseract/approval=each-call`. Pulso só durante chamada B; reduced motion usa destaque estático. Perda de resposta é apresentada como indeterminada e permite consultar o mesmo ID/chave, sem iniciar uma nova execução.
- `tests/mcp/mission12-orchestration.test.ts`: duas instâncias `McpServer` via Streamable HTTP real; valida schema/aprovação, mapeamento, chamadas únicas, B sem aprovação, erro de A, saída incompleta, erro de B preservando A e schema B alterado sem atingir o handler.
- `tests/fixtures/mcp-mission12-pair.ts` e `tests/e2e/mission-12-orchestration.spec.ts`: dois servidores HTTP sintéticos, app de produção em porta temporária, estado local isolado, confirmação no browser, refresh durante espera, resultado, atividade, screenshots, Axe e movimento reduzido.

## Validação

| Comando/procedimento | Ambiente | Resultado | Evidência e limitações |
|---|---|---|---|
| `npx vitest run` | Windows | Aprovado | 56 arquivos, 133 testes. O teste M12 foi repetido após os cenários finais de schema e falhas: 1 passou. |
| `npx playwright test --config=playwright.m10.config.ts` | Windows, app real + fixture M10 e duas fixtures M12 Streamable HTTP | Aprovado | Duas jornadas passaram na execução final; fluxo M12 recuperou o mesmo ID após refresh e finalizou o resumo sintético. |
| CI PR #8, run `43810918487` | GitHub Actions | Aprovado | `Quality / Linux` 43 s; `PowerShell / Windows` 2m45s. Esta execução valida o commit inicial da PR; a atualização deste relatório dispara nova execução obrigatória. [Run](https://github.com/poyato70/azure-cost-local/actions/runs/43810918487). |
| `npm run typecheck` | Windows | Aprovado | Sem erros TS registrados após as rotas de recuperação. |
| `npm run build` | Windows | Aprovado | Build Next.js e TypeScript de produção concluído após as últimas alterações de serviço/API. |
| `npm audit --audit-level=high` | Windows | Aprovado | `found 0 vulnerabilities`; nenhuma dependência nova. |
| `git diff --check` + Prettier check | Windows | Aprovado | Sem erros de whitespace ou formatação. |
| QA visual, Axe, teclado e reduced motion: 390×844, 768×1024, 1280×720 | Chromium headless | Aprovado | Sem overflow horizontal, Axe sem violações, foco Tab visível e pulso reduzido a 0s sob `prefers-reduced-motion`. Capturas visuais revisadas. |

## Segurança, falhas e limitações

- Toda tool usa `McpRegistry.call`, preservando identidade do servidor, aprovação e schema atual. Aprovação de A não autoriza B.
- Diagnósticos não registram valores de argumentos; resultado MCP só é exposto ao usuário na execução. Session ID interno não é devolvido pela API.
- Chave idempotente por sessão impede repetição de POST; confirmação concorrente/repetida não executa B novamente. Fluxos ficam em memória, com limite de 100 registros, e não sobrevivem ao reinício do processo.
- Fixtures usam somente dados sintéticos/loopback e portas dinâmicas; nenhum acesso a credenciais ou endpoints corporativos.
- Busca de padrões de chaves privadas/tokens nos arquivos alterados: nenhum resultado. CI GitHub e publicação ainda não executadas.

## Publicação

- **Branch/commit publicado:** `codex/missao-12-mcp-orchestration` / `29b050edd8d2c45f21cfaf652686864a3c97944e`.
- **Pull Request/CI:** [PR #8](https://github.com/poyato70/azure-cost-local/pull/8), aberta e mergeable; primeiro CI aprovado (run `43810918487`).
- **Merge/commit final na `main`:** Pendente da nova CI após atualização do relatório.

## Próximas ações

1. Revalidar o relatório/index atualizados com os checks Linux/Windows.
2. Integrar à main após CI aprovada; confirmar SHA remoto e concluir o status deste relatório.
