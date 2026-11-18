# Missão 17 — UX-06 abertura Tesseract e UX-07 observabilidade read-only

> **Atualização de reconciliação 2.1.1 — 2026-11-18:** O registro histórico abaixo descreve o estado anterior à conclusão/publicação da 2.1 e não representa o estado atual. A PR #19 foi integrada; `origin/main` foi confirmado em `84d5fe9bb262b49cdc0cfce4112f9a49627742fb`. A branch local foi reconciliada com essa base e os conflitos de `App.tsx`, `playwright.config.ts` e do nome do relatório M17 foram resolvidos. Typecheck, build, 204 testes unitários, E2E UX (3/3) e a suíte E2E completa final (47/47, 2 workers) passaram. Uma falha intermitente da primeira rodada integral (Multicloud) passou isoladamente na base e nas rodadas completas seguintes. O teste mobile verifica que todos os nós cabem antes da legenda. O preview isolado final está ativo em `http://127.0.0.1:43836/new_features_ux`; [PR #20 está aberta](https://github.com/poyato70/azure-cost-local/pull/20), sem merge. Os checks Linux e Windows passaram no SHA `06b481b18a0942bd87ee963ea0b03beaf84ab73f` (run 44415503491); a atualização documental subsequente não altera código executável.

## Reconciliação sobre 2.1

- **Base publicada:** `84d5fe9bb262b49cdc0cfce4112f9a49627742fb` (merge da PR #19).
- **Branch:** `codex/tesseract-2.1.1-ux`; **worktree de desenvolvimento:** `D:\DEV\FinOps\Tesseract-2-ux-next`.
- **Checkpoint pré-reconciliação:** `e39cceac4b768bb211c9870cb1b5fd72bb0ceccb` preservou a implementação local UX-06/07 antes da integração da main.
- **Reconciliação/refinamentos iniciais:** `2fdf71e936e6b2f1799acfb76a6ec6a0737231c3`, merge da base publicada com a implementação preservada.
- **Refinamento final validado:** `3a0b22d` (geometria/legibilidade do mapa, correção mobile, contraste e acessibilidade da abertura).
- Conflitos foram resolvidos mantendo as alterações da 2.1 (incluindo funcionalidades da Missão 16) e as rotas UX. O relatório de release `missao-17.md` foi preservado; este relatório UX ocupa `missao-17-ux-06-07.md` e o índice usa `17-UX`.
- A checagem `npm ci` foi feita numa worktree de validação separada, com sucesso (371 pacotes; 0 vulnerabilidades reportadas pela instalação). Nenhuma política npm ou dependência foi alterada por UX.
- Não foram modificadas autenticação, APIs/contratos MCP, persistência operacional ou worktrees/stashes de outras frentes. O dashboard permanece composto por leituras GET existentes e interações locais.
- A geometria do grafo foi compactada para três colunas: na captura desktop de 1280 px, todos os nós cabem a 64% de escala e o inspector permanece lateral, contra 46% antes do refinamento.

## Validação atual da reconciliação

| Verificação | Resultado observado | Evidência/limite |
|---|---|---|
| `npm run typecheck` | Passou | Worktree isolada em `D:\DEV\FinOps\Tesseract-2-ux-validation-20261118`. |
| `npm run build` | Passou | Next build e TypeScript do servidor concluídos. |
| `npm test -- --reporter=dot` | Passou: 68 arquivos, 204 testes | Sem alterações dos contratos MCP/autenticação/persistência. |
| E2E UX-06/07 | Passou: 3/3 | Axe sem violações no dashboard dos dois temas e no diálogo; GET-only, redaction, teclado, reduced motion, empty state, screenshot e geometria conferidos. |
| E2E completo | Rodada final: 47/47 passou, 2 workers. | Primeira rodada (1 worker) teve falha isolada de scrollWidth em Multicloud; o caso passou isoladamente na branch e main 84d5fe9, e nas rodadas completas seguintes. |
| CI GitHub PR #20 | Linux passou; Windows passou | Run 44415503491, SHA `06b481b18a0942bd87ee963ea0b03beaf84ab73f`. A atualização seguinte contém somente documentação. |
| `git diff --check` | Passou | Executado no código e repetido após consolidar os commits documentais. |
| Capturas finais | Geradas e inspecionadas | `test-results/ux-06-07/reconciled-84d5fe9-final/` na worktree isolada e copiada para a worktree UX; contém dark/light 1280, tablet 768, mobile 390 (sem sobreposição), abertura e estados vazios live. Fixtures sintéticas estão identificadas. |

### Limitações conhecidas

- Os estados de MCP refletem configuração/lista da sessão, não comprovam servidor MCP operacional. `GET /api/health` evidencia apenas a resposta do endpoint local.
- Não foram executadas operações MCP ou consultas Azure pelo dashboard; fluxos com fixture são sintéticos.
- Axe foi executado no escopo UX e no diálogo de abertura; não substitui auditoria manual WCAG integral das páginas preexistentes.
- O preview antigo em `127.0.0.1:43821` pertence à execução anterior e foi preservado. O preview final roda na worktree `D:\DEV\FinOps\Tesseract-2-ux-validation-20261118`, porta `43836`, PID `5932`, com runtime de teste e dados em `%TEMP%\tesseract-2.1.1-ux-preview-final2-20261118`; `/api/health` respondeu `ok=true`. Não contém conexões MCP operacionais ou credenciais configuradas. O preview intermediário PID `18728` na porta `43832` continua ativo; uma tentativa de encerrá-lo foi bloqueada pela revisão automática, por isso a versão final usa porta e diretório isolados novos.
- Publicação remota, PR e CI da 2.1.1 ainda pendentes.

---

## Registro histórico antes da reconciliação

## Identificação

- **Estado atual:** Implementação isolada e validação visual/técnica concluídas; reconciliação/publicação aguardam conclusão da versão 2.1, conforme instrução.
- **Início registrado:** 2026-11-18 11:26:34 -03:00 (criação deste relatório; início efetivo da tarefa ocorreu antes deste marco).
- **Conclusão local:** 2026-11-18 15:29 -03:00, após validação final.
- **Repositório:** `poyato70/azure-cost-local` (`origin` confirmado no checkout).
- **Branch:** `codex/tesseract-2.1.1-ux`.
- **Worktree:** `D:\DEV\FinOps\Tesseract-2-ux-next`.
- **Commit-base:** `4d4cfe23db3ac5a21702ea65a814c3ef2f074aef` (`codex/tesseract-2-ux`, head da PR #17).
- **PR/commit de implementação:** Não criados; alterações estão locais e sem commit.
- **Publicação:** Deferida até a versão 2.1 estar concluída e a branch ser reconciliada.

## Objetivo e restrições

Implementar o easter egg de abertura (UX-06) e uma rota experimental de observabilidade (UX-07) sem substituir a página inicial ou alterar autenticação, contratos MCP, APIs, regras de negócio, persistência, outras worktrees, serviços operacionais ou stash.

## Plano e acompanhamento

| Etapa | Estado | Evidência/critério |
|---|---|---|
| 1. Isolamento | Concluída | Branch/worktree próprios, base UX #17; `D:\DEV\FinOps\Tesseract-2` permaneceu em `9020bec1`; base e verificação UX não foram alteradas. |
| 2. Implementação UX-06/07 | Concluída | Ctrl+clique e abertura lazy; rota `/new_features_ux`; apenas leituras GET existentes, inspector/mapa; sem controles operacionais. |
| 3. Validação e revisão | Concluída | Typecheck, build, 3 E2E, Axe, temas, viewports e capturas inspecionadas; `git diff --check` executado. |
| 4. Reconciliação/publicação | Adiada | Aguardar encerramento da versão 2.1; sem commit, push, PR ou merge nesta etapa. |

- **Progresso:** 3/4 etapas (75%).
- **Tempo medido:** 4 h 03 min desde o primeiro marco registrado no relatório (11:26:34–15:29:28, fuso -03:00); a tarefa começou antes do marco.
- **Dependência:** Conclusão da versão 2.1 antes de comparar/reconciliar a branch 2.1.1.

## Inspeção e decisão de arquitetura

- A worktree foi criada em `D:\DEV\FinOps\Tesseract-2-ux-next`, na branch `codex/tesseract-2.1.1-ux`, baseada no head da UX #17. A PR #17 estava aberta e não integrada no momento da inspeção; `origin/main` estava em `facd3dfd794b1b9a2750f53280e763447ebe6ecd`.
- O shell é React servido por Fastify. A nova página lê `/api/health`, `/api/mcp-connections`, `/api/mcp-orchestrations` e `/api/diagnostics`; `/api/bootstrap` GET é aguardado antes das leituras com escopo de sessão para estabelecer o cookie local.
- Os nós e relações representam módulos e dependências conferidos na arquitetura. Status e registros dinâmicos vêm dos endpoints existentes. O escopo de conexões, fluxos e diagnósticos é a sessão/identidade corrente; “global” descreve o mapa integrado dos subsistemas locais, não telemetria de toda a organização.
- O botão de atualização e o mapa usam somente GET. Pan/zoom, seleção de nó e inspector são locais. Não há execução de tools, edição de conexões, alteração de rotas, simulação nem endpoint novo.

## Implementação

### UX-06

- `Brand` preserva navegação no clique normal e intercepta Ctrl+clique para abrir o modal de forma lazy.
- Canvas apresenta projeção geométrica 4D do Tesseract; não copia a sequência de jogo da referência. Modal fecha pelo botão ou Esc, mantém foco dentro do diálogo, restaura foco ao fechar e cancela o `requestAnimationFrame`/limpa o canvas no unmount.
- `prefers-reduced-motion: reduce` renderiza quadro estático. Não há faixa de áudio implementada; nenhum som inicia (estado efetivo desligado).

### UX-07

- Rota experimental direta `/new_features_ux`, acessível por item de navegação; a página inicial atual não foi substituída.
- Mapa com nós selecionáveis, relações SVG, pan e zoom por ponteiro/roda/teclado no desktop. Em tablet/mobile o mapa vira lista vertical navegável e legível, mantendo seleção/inspector; controles de zoom são ocultados nesse modo linear.
- Inspector informa origem, momento de verificação, estados verificado/desatualizado/não verificado/falha de leitura, configurações MCP observadas, fluxos registrados e diagnósticos da sessão.
- Fluxos e diagnósticos exibem estados vazios e desconhecidos separadamente. Dados sintéticos da suíte E2E carregam identificação visível “Fixture sintética”; as capturas live usam serviço isolado sem fixtures.
- Sanitização de apresentação mascara Bearer/JWT, campos de segredo/token, credenciais embutidas em URL e caminhos locais. O servidor também sanitiza diagnósticos registrados. Não foram alterados ou expostos artefatos com credenciais.

## Validação

| Comando/procedimento | Ambiente | Resultado | Evidência e limitações |
|---|---|---|---|
| `npm ci` | Nova worktree UX | Aprovado (código 0) | Instalou 371 pacotes. Npm reportou 5 vulnerabilidades high e scripts pendentes para `esbuild`/`koffi`; políticas e lockfile não foram modificados. |
| `npm run typecheck` | Worktree UX | Aprovado | TypeScript estrito passou após correção do tipo de import lazy. |
| `npm run build` | Worktree UX | Aprovado | Next build/export e compilação do servidor terminaram com código 0. |
| `npm run test:e2e -- tests/e2e/ux06-07.spec.ts` | Porta dedicada `43821`; app de teste isolado | Aprovado: 3/3 | Verificou abertura/fechamento, clique normal, Ctrl+clique, reduced motion, GET-only, seleção, pan/zoom, geometria inicial, estados vazios live, temas e ausência de overflow nos viewports. |
| Axe (`@axe-core/playwright`) | Desktop 1280 px; dashboard fixture e serviço live; temas claro/escuro; modal de abertura | Aprovado no escopo da interface UX nova | Axe passou sem violações no dashboard escuro, no contêiner `.observability` em tema claro, no estado live escuro e no diálogo de abertura. Um scan exploratório da página completa em tema claro apontou problemas de contraste em elementos globais existentes da navegação/cabeçalho; esses elementos estão fora do escopo UX-06/07 e não foram alterados. Isto não equivale a auditoria manual WCAG integral. |
| Viewports | 1280, 768, 640 (equivalente estreito/zoom) e 390 px | Aprovado nos testes focados | Capturas cobrem desktop, tablet e mobile; 640 px representa redução de viewport, não zoom nativo do navegador. |
| `git diff --check` | Branch UX | Aprovado | Sem whitespace errors. |
| Inspeção de outras worktrees | Git worktree list antes/depois | Aprovado | `Tesseract-2` continua em `9020bec1`; UX base em `4d4cfe2`; UX verify em `facd3df`; sem alterações nelas. |
| Preview dedicado | Navegador + processo isolado | Aprovado | Rota `/new_features_ux` abriu; API `/api/health` respondeu `ok`; bootstrap e endpoints GET carregaram estados vazios reais de teste. Processo Node PID 9088, porta 43821; armazenamento em `%TEMP%\tesseract-2.1.1-ux-preview-20261118\app-data`. A sessão do servidor permanece ativa para revisão humana. |

### Capturas (armazenamento temporário ignorado pelo Git)

Diretório: `D:\DEV\FinOps\Tesseract-2-ux-next\test-results\ux-06-07\`.

- `opening-dark-1280.png` — abertura do Tesseract após Ctrl+clique.
- `observability-dark-1280.png`, `observability-light-1280.png` — mapa/inspector com dados de fixture E2E, identificados como sintéticos.
- `observability-light-768.png`, `observability-light-390.png` — composição linear responsiva.
- `observability-live-empty-dark-1280.png`, `observability-live-empty-light-1280.png` — leitura do serviço real de teste em diretório isolado, sem conexões nem fluxos cadastrados.

Capturas são evidência local e não versionada; o relatório versionado registra seus nomes e contexto.

O preview dedicado está em `http://127.0.0.1:43821/new_features_ux`. A aba foi aberta e mantida disponível no navegador da sessão. O processo usa `TESSERACT_TEST_RUNTIME=1`, sem configuração Azure tenant/client, e não compartilha o armazenamento operacional.

## Limitações e pendências

- A observabilidade continua limitada aos módulos/estados presentes nos endpoints atuais; não monitora infraestrutura, instalações distintas ou Azure externo. O health check mede apenas a API local.
- Fluxos MCP são filtrados pelo escopo de sessão/identidade existente. Registros de outras sessões não são coletados nem agregados.
- Não há som na abertura, endpoint de telemetria novo nem conexão externa exercitada.
- `npm ci` reportou vulnerabilidades e lifecycle scripts não aprovados pelo npm local; isto não foi investigado como defeito UX nem alterado.
- Para publicação, revisar divergências com o resultado final da versão 2.1 e validar novamente sobre a base reconciliada. Nenhum resultado desta branch foi integrado.

## Arquivos da proposta local

- `playwright.config.ts`
- `src/web/App.tsx`
- `src/web/components/Brand.tsx`
- `src/web/components/Breadcrumbs.tsx`
- `src/web/components/Navigation.tsx`
- `src/web/pages/GlobalObservability.tsx`
- `src/web/pages/TesseractOpening.tsx`
- `src/web/styles-neumorphic.css`
- `tests/e2e/ux06-07.spec.ts`
- `docs/relatorios/missao-17.md`
- `docs/relatorios/README.md`

## Publicação

- **Branch/commit publicado:** Nenhum; sem commit/push.
- **PR/CI:** Não criado, conforme limite desta etapa.
- **Merge:** Não realizado.
- **Próxima ação:** Aguardar a versão 2.1, reconciliar a base e só então preparar a revisão/publicação da 2.1.1.
