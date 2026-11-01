# Azure Cost Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar dashboard web local de custos Azure com budgets, análise de compromissos e chat Copilot que consulte valores reais.

**Architecture:** Interface React e API Fastify na mesma origem loopback. Serviços de domínio compartilhados por dashboard e ferramentas do chat; adaptadores Azure e Copilot separados da autenticação e do canal de apresentação.

**Tech Stack:** Node 24, TypeScript, React, Vite, Fastify, MSAL Node, Copilot SDK, Zod, decimal.js, Recharts, Vitest e Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-azure-cost-dashboard-design.md`, aprovado pelo usuário em 01/11/2026.

## Global Constraints

- “Aplicação web individual, acessada somente pelo navegador do notebook, com serviço local.”
- “Sem coletar senha, sem Client Secret e sem copiar credenciais de outros aplicativos.”
- “Não armazenar tokens, segredos ou relatórios no workspace sincronizado pelo OneDrive.”
- “Sem compra, alteração de infraestrutura ou modificação de budget.”
- “Não somar moedas diferentes; exibir grupos separados.”
- “Dashboard e chat usam os mesmos serviços.”
- “Sem acesso Azure/Copilot, registrar integração pendente, nunca aceite real concluído.”
- Não implementar bot Teams, SharePoint ou hospedagem corporativa nesta entrega.

## Review Focus

1. Logout durante consulta em andamento: resultado tardio não repovoa cache nem interface (tarefas 1 e 3).
2. Resource groups homônimos em subscriptions distintas: chat exige desambiguação (tarefa 6).
3. Paginação com nextLink externo ou ciclo: recusar envio de token e interromper com resultado parcial (tarefa 3).
4. Budget com filtros de tag e período próprio: consumo deve respeitar ambos (tarefa 4).
5. Recomendação sem moeda, cobertura ou utilização: ausência não vira zero nem economia garantida (tarefa 5).

## Ambiente e dependências

Verificado em 01/11/2026: Node 24.20.0, npm 11.19.0, Git 2.55.0.windows.5, Copilot CLI 1.0.106-2; Azure CLI ausente no PATH. Pasta contém somente documentação, sem código/repositório identificado. Não houve consulta a credenciais ou teste de login.

Versões consultadas no registro npm: react/react-dom 19.3.1, vite 8.3.5, fastify 5.12.7, @azure/msal-node 7.1.2, @github/copilot-sdk 1.0.28, typescript 7.0.2, vitest 5.0.5, decimal.js 10.6.0, zod 4.6.7, @fastify/static 10.1.8, @fastify/cookie 11.1.5, recharts 3.10.1, @playwright/test 1.64.1. São candidatos fixados, não uma matriz já testada. Confirmar peer dependencies, API e compatibilidade com CLI na tarefa 1/6; ajustes justificados no lockfile. Não atualizar CLI global automaticamente. Fixar também dependências auxiliares e tipos ao instalar.

## Estrutura e contratos

`src/shared/contracts.ts`: tipos e schemas; `src/server/app.ts`: fábrica Fastify; `src/server/main.ts`: inicialização loopback; `src/server/config.ts`: configuração; `src/server/auth/`: MSAL e sessões; `src/server/azure/`: transporte HTTP e inventário; `src/server/costs/`, `budgets/`, `benefits/`: serviços e rotas por capacidade; `src/server/chat/`: SDK e ferramentas. `src/web/`: interface, páginas, componentes e cliente API. `tests/`: testes de domínio/rotas e e2e. `docs/setup.md` e `docs/validation.md`: configuração e evidências.

Contratos compartilhados definidos na tarefa 1:
- `Scope = { tenantId: string; subscriptionId: string; resourceGroup?: string }`.
- `DateRange = { from: string; toExclusive: string; timeZone: 'America/Sao_Paulo' }`, datas civis YYYY-MM-DD.
- `CostQuery = { scope: Scope; period: DateRange; basis: 'ActualCost'|'AmortizedCost'; groupBy: 'ServiceName'|'ResourceId'; granularity: 'Daily'|'Monthly' }`.
- `ResultMeta = { scope: Scope; period?: DateRange; source: string; fetchedAt: string; status: 'complete'|'partial'|'unavailable'; warnings: string[] }`.
- `CostResult = { meta: ResultMeta; basis: CostQuery['basis']; rows: { date: string; dimension: string; amount: string; currency: string }[]; totals: { currency: string; amount: string }[] }`.
- `BudgetStatus = { meta: ResultMeta; items: { id: string; name: string; amount: string; currency: string; spent: string|null; percent: string|null; period: DateRange; filters: unknown; thresholds: number[] }[] }`.
- `BenefitAnalysis = { meta: ResultMeta; kind: 'reservation'|'savingsPlan'; existing: unknown[]; recommendations: unknown[]; scenarios: { source: 'official'|'simulation'; term: string; currency: string|null; estimatedSavings: string|null; assumptions: string[] }[]; detailedSimulationAvailable: boolean }`.
- `RequestContext = { sessionId: string; userId: string; tenantId: string; signal: AbortSignal }`; contexto criado no servidor, nunca aceito do modelo.
- Erros de API tipados `unauthenticated`, `forbidden`, `unsupported`, `throttled`, `upstream`, `invalid_request`. Estado vazio legítimo tem sucesso e lista vazia.

### Task 1: Serviço local, contratos e proteção de sessão

**Files:** criar `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `src/shared/contracts.ts`, `src/server/{app,main,config}.ts`, `src/server/auth/session-store.ts`, `tests/server/session.test.ts`.

**Interfaces:** produzir `buildApp(deps: AppDeps): FastifyInstance`, `SessionStore.create(userId: string, tenantId: string): string`, `requireSession(request): RequestContext` e schemas acima. `AppDeps` injeta clock, store e provedores, sem dependência de login real nos testes.

- [ ] Criar esqueleto mínimo, instalar versões fixas e scripts `dev`, `build`, `start`, `test`, `typecheck`, `test:e2e`. Configurar exclusões de credenciais, relatórios locais e dependências; verificar contexto Git antes de inicializar repositório local.
- [ ] Escrever teste que falha: rota protegida sem cookie → 401; Host externo e Origin externo → recusados; sessão invalidada não aceita conclusão tardia; cookie HttpOnly/SameSite; mutações exigem CSRF válido.
- [ ] Executar `npm test -- tests/server/session.test.ts`; esperar falha pelos comportamentos ausentes.
- [ ] Implementar serviço em `127.0.0.1:4317`, aceitar callback localhost explicitamente configurado, mesmas políticas de origem na interface servida/proxy Vite. Saúde pública sem informação sensível. Cache/session generation impede gravação depois de logout.
- [ ] Rodar teste, `npm run typecheck` e `npm run build`; exigir sucesso. Registrar compatibilidade real das dependências.
- [ ] Se Git inicializado, revisar arquivos adicionados e fazer commit local da unidade, sem push. Repetir esse fechamento nas tarefas seguintes.

### Task 2: Login Microsoft e descoberta dos escopos

**Files:** criar `src/server/auth/{msal-provider,routes}.ts`, `src/server/azure/inventory.ts`, `tests/server/auth.test.ts`, `docs/setup.md`.

**Interfaces:** consumir SessionStore; produzir `getArmToken(ctx: RequestContext): Promise<string>`, `listSubscriptions(ctx): Promise<Subscription[]>`, `listResourceGroups(ctx, subscriptionId: string): Promise<string[]>`; definir `Subscription={id:string;name:string;tenantId:string}` no contrato. Rotas `/api/auth/login`, `/api/auth/callback`, `/api/auth/session`, `/api/auth/logout`, `/api/subscriptions`, `/api/resource-groups`.

- [ ] Escrever testes: state inválido/reutilizado rejeitado; PKCE challenge/verifier corretos; callback não aceita redirecionamento arbitrário; logout limpa contexto; escopo de tenant diferente exige nova sessão; segredo/token não aparece na resposta.
- [ ] Rodar `npm test -- tests/server/auth.test.ts`; esperar falha.
- [ ] Implementar MSAL PublicClientApplication com cache em memória por sessão/fluxo, configuração explícita tenant/client ID e ARM delegated scope. Login por navegador; renovação silenciosa ou novo login quando necessário. Registrar setup de aplicativo público com callback exato e permissões/consentimento, sem criá-lo automaticamente.
- [ ] Documentar suporte da conta convidada/pessoal vinculada ao tenant e permissões de custos. Não presumir que acesso ao inventário garante acesso ao billing.
- [ ] Rodar testes/typecheck. Login real fica pendente até configuração fornecida pelo usuário; não solicitar senha ou token no chat.

### Task 3: Consulta, agregação e cache de custos

**Files:** criar `src/server/azure/http.ts`, `src/server/costs/{periods,service,cache,routes}.ts`, `tests/costs/{periods,service,http}.test.ts`.

**Interfaces:** `queryCosts(ctx: RequestContext, query: CostQuery): Promise<CostResult>`; `lastCompleteMonths(now: Date, count: number): DateRange`; `compareCosts(current: CostResult, previous: CostResult): Comparison[]`, com `Comparison={currency:string;delta:string;percent:string|null}`. Rota `POST /api/costs/query`.

- [ ] Testes falhando: 01/11/2026 → 01/09 a 01/11 exclusivo; transição de ano, fevereiro bissexto e UTC próximo da meia-noite local; 0.1+0.2 → string decimal 0.3; USD/BRL separados; base zero → percentual null.
- [ ] Testes de transporte/cache: 403 diferente de zero; 429 respeita Retry-After com relógio simulado e máximo de três tentativas; nextLink externo/circular recusado; cache de cinco minutos separado por contexto e consulta; logout em voo não grava; nova seleção cancela resultado antigo.
- [ ] Executar `npm test -- tests/costs`; confirmar falhas esperadas.
- [ ] Implementar API Query com versão verificada na documentação, mapear colunas pelo nome, normalizar datas para semântica inclusiva/exclusiva comprovada em teste, paginação e limites de resposta. Usar decimal.js para agregação e comparação. Não converter moeda implicitamente.
- [ ] Implementar chave completa do cache e validação server-side da identidade/escopo antes de cada consulta. Sinalizar paginação incompleta e resultados provisórios.
- [ ] Rodar testes/typecheck e registrar uma requisição sanitizada de referência em documentação, sem dados privados.

### Task 4: Budgets por subscription e RG

**Files:** criar `src/server/budgets/{service,routes}.ts`, `tests/budgets/service.test.ts`.

**Interfaces:** `getBudgets(ctx: RequestContext, scope: Scope): Promise<BudgetStatus>`, rota `POST /api/budgets/query`; consumir transporte e queryCosts da tarefa 3.

- [ ] Testes falhando: vazio → lista vazia; 403 → indisponível; budget filtrado por tag/serviço usa apenas consumo compatível; respeitar período e moeda próprios; ausência de currentSpend → spent/percent null quando consumo não puder ser reproduzido com fidelidade.
- [ ] Rodar `npm test -- tests/budgets` e confirmar falhas.
- [ ] Implementar leitura Microsoft.Consumption/budgets, incluindo paginação. Preferir currentSpend retornado; consulta complementar só com tradução fiel dos filtros para Cost Management. Base não comprovada vira warning, não comparação indevida.
- [ ] Rodar testes/typecheck e verificar corpo das rotas sem operações de criação/modificação.

### Task 5: Reservations e Savings Plans

**Files:** criar `src/server/benefits/{providers,service,routes}.ts`, `tests/benefits/service.test.ts`, `docs/benefits-capabilities.md`.

**Interfaces:** `analyzeBenefits(ctx: RequestContext, scope: Scope, kind: BenefitAnalysis['kind']): Promise<BenefitAnalysis>`; `BenefitProvider.read(ctx, scope, kind): Promise<BenefitAnalysis>`; rota `POST /api/benefits/query`.

- [ ] Antes de codificar, documentar matriz endpoint/versão/contrato/escopo/permissão para recomendações de Reservations, benefício Savings Plans e utilização existente. Validar em documentação oficial os endpoints específicos; sem substituição silenciosa de escopo RG por billing.
- [ ] Testes falhando: recomendação oficial preserva origem e hipóteses; campo ausente fica null; escopo sem suporte fica indisponível; não somar economias sobrepostas; falta de série horária → detailedSimulationAvailable false, sem fabricar cálculo.
- [ ] Rodar `npm test -- tests/benefits` e confirmar falhas.
- [ ] Implementar provedores de leitura da matriz e normalizar respostas. Dados existentes sem autorização geram warning parcial enquanto recomendações disponíveis continuam visíveis. Simulação detalhada só se dados necessários estiverem presentes; estimativa retail identificada separadamente.
- [ ] Rodar testes/typecheck. Registrar capacidades verificadas e as que dependem da conta; módulo opcional MCP fica fora da primeira implementação por não ser necessário à entrega mínima aprovada.

### Task 6: Chat Copilot com ferramentas restritas

**Files:** criar `src/server/chat/{copilot,tools,routes}.ts`, `tests/chat/{tools,copilot-config}.test.ts`.

**Interfaces:** `createChatTools(ctx: RequestContext): Tool[]` usa serviços anteriores; `ask(ctx: RequestContext, input: {message:string;scope?:Scope;basis:CostQuery['basis']}): AsyncIterable<ChatEvent>`; definir `ChatEvent` union `{type:'text';text:string}|{type:'result';result:CostResult|BudgetStatus|BenefitAnalysis}|{type:'error';code:string}`. Rota `POST /api/chat` por stream; `/api/chat/status` retorna disponibilidade sem credenciais.

- [ ] Testes falhando: modelo solicita outro tenant → negado; RG homônimo sem seleção → pedido de esclarecimento, sem consulta; pergunta com dois meses usa período da tarefa 3; ferramentas retornam números do serviço, não valores inventados; tentativa de executar shell rejeitada.
- [ ] Rodar `npm test -- tests/chat` e confirmar falhas.
- [ ] Verificar APIs do SDK 1.0.28 e compatibilidade com CLI local; implementar allowlist explícita de ferramentas próprias, sem builtin/MCP/plugins herdados e com descoberta de configuração externa desabilitada quando suportada. Permission handler recusa ações fora da allowlist; nunca usar aprovação irrestrita. Testar catálogo efetivo e comportamento real antes de habilitar.
- [ ] Implementar limites de dez chamadas por pergunta, dois minutos e 8.000 caracteres de resposta; cancelamento, streaming e limpeza do estado controlado pela aplicação. Não registrar prompts/dados financeiros por padrão. Explicar envio de contexto ao Copilot antes de ativar o chat.
- [ ] Rodar testes/typecheck e teste real mínimo do SDK sem dados financeiros. Sem login/licença/restrição comprovados: status indisponível e dashboard funcional.

### Task 7: Dashboard e experiência integrada

**Files:** criar `index.html`, `src/web/main.tsx`, `src/web/App.tsx`, `src/web/api.ts`, `src/web/styles.css`, `src/web/components/{ScopeFilters,StatusPanel,MoneyTable}.tsx`, `src/web/pages/{Costs,Budgets,Benefits,Chat}.tsx`, `tests/e2e/dashboard.spec.ts`, `playwright.config.ts`.

**Interfaces:** cliente `api.queryCosts(query,signal)`, `api.getBudgets(scope,signal)`, `api.analyzeBenefits(scope,kind,signal)`, `api.ask(input,signal)` consome rotas anteriores. Interface sem acesso direto a token Azure ou processo CLI.

- [ ] Escrever e2e com respostas HTTP simuladas explicitamente identificadas no teste: login/configuração pendente, troca de RG durante consulta lenta sem flash de resultado antigo, erro 403 sem zero, moedas separadas, budget vazio, chat indisponível sem quebrar painel e consistência painel/chat para mesma consulta.
- [ ] Rodar `npm run test:e2e` e confirmar falhas de interface ausente.
- [ ] Implementar navegação em português e quatro áreas, filtros comuns, gráfico diário/mensal, tabela por serviço/recurso, comparação anterior, seleção real/amortizado, compromissos existentes versus cenários. Mostrar datas, fonte, moeda, atualização e limitações nos resultados.
- [ ] Implementar tela de configuração inicial com tenant/client ID, instruções e diagnóstico local; sem solicitar senha. Tratar loading/vazio/parcial/erro e cancelamento, teclado e layout adaptável ao notebook. Sem dados fictícios na execução normal.
- [ ] Rodar e2e, testes, typecheck e build; inspecionar navegador visualmente e registrar problemas encontrados/corrigidos.

### Task 8: Validação real e entrega local

**Files:** criar `scripts/start.ps1`, atualizar `docs/setup.md`, criar `docs/validation.md` e `README.md`.

**Interfaces:** `npm run build` seguido de `npm start` entrega origem única loopback; script abre navegador e informa como encerrar sem alterar configuração global.

- [ ] Executar `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`; todos devem passar. Revisar alterações e dependências, sem repetir testes sem motivo.
- [ ] Com usuário autenticado, comparar dois meses completos de um RG entre API, painel, chat e portal com mesmos filtros. Verificar real/amortizado, budgets subscription/RG e uma análise de compromissos real. Registrar apenas evidência sanitizada, fora do workspace quando financeira.
- [ ] Verificar sessão expirada, logout, reinício, indisponibilidade Copilot e proteção de loopback/origem. Confirmar que CLI/SDK não ganha acesso a ferramentas excluídas.
- [ ] Revisão independente final e correção de achados materiais antes de declarar conclusão. Registrar separadamente testes automatizados, revisão visual e integrações reais pendentes.
- [ ] Entregar instruções de início, parada, configuração Entra/Copilot e limitações comprovadas. Sem publicar, comprar benefícios, alterar permissões ou configurar Teams.

## Auto-revisão do plano

Cobertura: autenticação e escopos (1–2), custos/cache/datas (3), budgets (4), compromissos (5), Copilot (6), interface (7), operação e aceites reais (8). Os cinco riscos de Review Focus têm testes nas tarefas indicadas. Tipos compartilhados são definidos na tarefa 1 e consumidos sem renomeação nas seguintes. Sem autenticação real, tarefas de construção podem avançar com testes isolados, mas aceite de integração permanece pendente.

Método recomendado: execução nativa nesta conversa, com revisão independente final, por haver forte dependência entre contratos e serviços. Plano aprovado; execução nativa autorizada em 01/11/2026.


## Registro de execução

Tarefas 1–7 implementadas no workspace. Tarefa 8: testes automatizados, inspeção visual e verificação do catálogo real Copilot executados; aceite com custos Azure reais aguarda os identificadores e login do usuário. Cobertura/utilização existentes de billing e simulação horária independente permanecem indisponíveis e explicitadas na interface, conforme entrega mínima aprovada. Consulte docs/validation.md para evidências e limitações.
