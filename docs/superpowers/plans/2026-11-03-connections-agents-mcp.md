# Saved Connections and Local Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar a aplicação existente com acessos salvos, client credentials, fontes API/MCP e agentes locais configuráveis, preservando Copilot e os cálculos de custos.

**Architecture:** Configuração versionada e SecretStore DPAPI no serviço local; IdentityProvider por sessão e conexão; adapters API/MCP mediados por política comum. AgentRuntime independente chama modelo Azure compatível e somente ferramentas autorizadas; a interface seleciona acesso, fonte e runtime explicitamente.

**Tech Stack:** TypeScript/Node 24, Fastify, React, MSAL Node 7.1.2, Copilot SDK 1.0.28, Zod, Vitest, Playwright/Edge. Novas dependências candidatas fixas: @modelcontextprotocol/sdk 1.32.2 e undici 8.12.3, consultadas no npm em 03/11/2026; verificar exports/engines na tarefa correspondente antes de instalar.

Servidores locais candidatos: @azure/mcp 3.0.0 (última versão sem sufixo de prévia encontrada) e @microsoft/fabric-mcp 1.7.0. O dist-tag latest do Azure aponta para 4.0.0-beta.4; não usá-lo por padrão. Fixar pacotes e executáveis por projeto ao instalar, conferindo catálogo/CLI efetivos dessas versões. Não depender de documentação main para presumir que uma ferramenta já está no pacote publicado.

**Spec:** `docs/superpowers/specs/2026-11-03-connections-agents-mcp-design.md`, aprovado em 03/11/2026.

## Global Constraints

- “O serviço continua exclusivo do notebook, em loopback; mantém login Microsoft por popup e Copilot local.”
- “Secret Value não é Secret ID.”
- “Nunca salvar Secret em .env, localStorage, URL, log, argumentos de processo, exportação ou histórico do chat.”
- “SecretStore usa DPAPI CurrentUser.”
- “Sem fallback silencioso.”
- “MCP e API são acessados exclusivamente pelo serviço.”
- “Chamadas de modelo continuam remotas; execução local não significa modelo offline.”
- “Configurações persistem; tokens, resultados financeiros e conversas ficam em memória.”
- “Não criar deployment, recurso Foundry ou compras automaticamente.”
- Limites máximos: dez chamadas por pergunta, dois minutos e 8.000 caracteres de resposta.
- Ferramentas de negócio somente leitura. Nenhuma concessão automática de RBAC, configuração de tenant ou deploy.

## Review Focus

1. Falha entre gravação do segredo e metadados: preservar acesso anterior e não produzir referência a arquivo ausente (tarefa 1).
2. Perfil editado durante login/inferência: bloquear autenticação/resultado com versão antiga (tarefas 2 e 8).
3. MCP altera schema/ferramentas após conexão: invalidar aprovação e recusar chamada até nova revisão (tarefas 5 e 6).
4. DNS muda entre validação e conexão ou redirect troca host: não enviar credencial ao destino novo (tarefa 4).
5. Tool result contém instruções/credencial ou ultrapassa tamanho: limitar, sanitizar e impedir ampliação de permissões (tarefas 6 e 8).

## Preparação e estrutura

Preservar baseline atual: testes em `tests/server`, `tests/costs`, `tests/chat`, `tests/budgets`, `tests/benefits` e seis cenários Edge. A contagem conhecida de 25 testes de serviço é histórica; executar baseline antes de mudanças. Não reiniciar serviço do usuário sem preservar identificadores não secretos e avisar que sessões em memória terminam.

Unidades novas: `src/shared/connections.ts`; `src/server/storage/` (metadados/vault/DPAPI); `auth/identity-provider.ts`; `connections/` (CRUD/invalidação/matriz); `security/` (destinos); `mcp/` (presets, transports, OAuth, políticas); `agents/` (CRUD/modelo/runtime); páginas React Acessos, MCPs e Agentes. `app.ts` registra rotas por módulo; não concentrar toda a ampliação nesse arquivo.

Tipos definidos na tarefa 1:
- `AccessProfile = {id,name,tenantId,clientId,preferredMode:'user'|'application',secretRef?:string,secretExpiresAt?:string,credentialVersion:number,configurationVersion:number}`.
- `PublicAccessProfile = Omit<AccessProfile,'secretRef'> & {secretConfigured:boolean}`; sem campo de segredo legível.
- `DataSelection = {accessId:string;source:'api'|'mcp';mcpConnectionId?:string}`.
- `RevisionSet = {accessId:string;accessVersion:number;credentialVersion:number;mcpId?:string;mcpVersion?:number;agentId?:string;agentVersion?:number}`.
- `ExecutionContext = RequestContext & {selection:DataSelection;revisions:RevisionSet;principalKind:'user'|'application'}`.
- `McpProfile = {id,name,preset:'azure'|'adx'|'foundry'|'fabric'|'powerbi',transport:'stdio'|'http',endpoint?:string,accessId?:string,authMode:'delegated'|'application'|'none',audience?:string,resourceContext:Record<string,string>,approvedTools:{name:string;schemaHash:string}[],configurationVersion:number}`. Nenhum comando executável arbitrário no payload público.
- `AgentProfile = {id,name,description,instructions,provider:'azure-chat-v1',endpoint,model,modelCredential:{kind:'apiKey';secretRef:string}|{kind:'entra';accessId:string},allowedAccessIds:string[],mcpConnectionIds:string[],allowedTools:string[],limits:{toolCalls:number;timeoutMs:number;responseChars:number},configurationVersion:number}`. DTO público substitui secretRef por keyConfigured.
- `CapabilityRecord = {service,transport,authMode,status:'available'|'pending'|'unsupported',reason,sourceUrl,checkedAt?,testedAt?}`.
- `ResultProvenance = {source:'api'|'mcp';connectionId:string;operation:string;identityLabel:string}`; acrescentado aos resultados de negócio sem remover `meta.source` atual.

Tipos auxiliares obrigatórios no mesmo módulo: `ConfigSnapshot={schemaVersion:1;accessProfiles:AccessProfile[];mcpProfiles:McpProfile[];agentProfiles:AgentProfile[]}`; `AccessInput` inclui campos públicos editáveis, `expectedVersion?:number` e `secretAction:{kind:'keep'}|{kind:'replace';value:string}|{kind:'remove'}`; `ConnectionStatus={connected:boolean;principalKind?:'user'|'application';capabilities:CapabilityRecord[];message:string}`. `ChatInput={message:string;runtime:'copilot'|'agent';agentId?:string;selection:DataSelection;scope?:Scope;basis:CostQuery['basis'];consent:true}`. DTOs de MCP/Agent seguem a mesma política de versão esperada e referência opaca de segredo, sem campo arbitrário de comando/header/token.

Na tarefa 4, `EndpointPolicy={connectionId:string;host:string;port:number;protocol:'https:'|'http:';allowPrivateNetwork:boolean;allowLoopback:boolean}`; `ValidatedEndpoint` é tipo opaco com URL e endereços resolvidos aprovados; `CredentialBinding={connectionId:string;audience:string;configurationVersion:number;credentialVersion:number}`. Na tarefa 8, `ModelTurn={messages:ModelMessage[];tools:ToolDescriptor[];maxOutputTokens:number}` e `ModelTurnResult={text?:string;toolCalls:{id:string;name:string;arguments:string}[]}`; ModelMessage tem role system/user/assistant/tool, conteúdo string e toolCallId quando necessário.

Campos omitidos no resumo são strings, salvo versões/limits. Escrever schemas Zod completos e estritos na tarefa 1; IDs novos UUID; nomes 1–120 caracteres; instruções até 12.000; contexto até 128 kB por ferramenta; schema MCP até 64 kB; no máximo 100 ferramentas listadas por conexão. Validar limites sem alterar política silenciosamente.

## Tarefa 1 — Persistência de acessos e segredos protegidos

**Arquivos:** criar `src/shared/connections.ts`, `src/server/storage/{config-store,secret-store,dpapi}.ts`, `scripts/dpapi.ps1`, `tests/storage/{config-store,dpapi}.test.ts`.

**Interfaces:** `SecretStore.put(value:string):Promise<string>`, `read(ref:string):Promise<string>`, `remove(ref:string):Promise<void>`; `ConfigStore.read():Promise<ConfigSnapshot>`, `mutate(fn:(draft:ConfigSnapshot)=>void):Promise<void>`. Snapshot versionado contém arrays accessProfiles/mcpProfiles/agentProfiles. Caminho fixo resolvido por LOCALAPPDATA, nunca vindo da API.

- [ ] Escrever testes: `expect(JSON.stringify(publicProfile)).not.toContain(secret)`; substituir segredo não altera metadados se gravação falhar; duas mutações concorrentes preservam ambas; arquivo corrompido não é sobrescrito.
- [ ] Rodar `npm test -- tests/storage`; confirmar falhas por implementação ausente.
- [ ] Implementar fila de escrita e substituição atômica de settings.json; blob DPAPI por UUID em vault. Gravar ciphertext novo antes de referenciá-lo; remover versão velha somente após commit dos metadados. Falha preserva blob anterior; órfãos não são lidos por nome arbitrário.
- [ ] Implementar helper PowerShell de comandos fixos protect/unprotect, stdin JSON com bytes em base64 e saída por pipe; DPAPI CurrentUser, ACL do usuário Windows e nenhum segredo em argumentos, temporários ou stderr. Código de erro sanitizado; nunca fallback em texto puro.
- [ ] Rodar roundtrip DPAPI Windows com string sintética, duas instâncias do ConfigStore simulando reinício, testes/typecheck. Relatar somente PASS/FAIL. Commit local.

## Tarefa 2 — CRUD de acessos e invalidação de versões

**Arquivos:** criar `src/server/connections/{access-service,invalidation,routes}.ts`, `tests/connections/{access-service,routes}.test.ts`; modificar `app.ts`, `auth/session-store.ts`.

**Interfaces:** `AccessService.list():Promise<PublicAccessProfile[]>`, `save(input:AccessInput):Promise<PublicAccessProfile>`, `remove(id:string):Promise<void>`; `Invalidation.capture(ids):RevisionSet`, `assertCurrent(revisions):void`, `subscribe(revisions,controller):()=>void`. ConfigStore e SecretStore da tarefa 1 são dependências.

- [ ] Testes falhando: campo Secret vazio preserva; remover é ação explícita; rotação incrementa credentialVersion/configurationVersion; edição sem segredo incrementa configurationVersion; acesso referenciado não pode ser excluído; GET não devolve secretRef nem valor.
- [ ] Rodar `npm test -- tests/connections`; confirmar RED.
- [ ] Implementar `/api/accesses` GET/POST, `/api/accesses/:id` PATCH/DELETE, todos protegidos por sessão local/CSRF e limites de corpo. Tratar versões esperadas em PATCH para impedir lost update, respondendo 409 em conflito.
- [ ] Invalidar sessões/executores/cache vinculados após commit de edição, rotação ou exclusão; manter bootstrap anônimo local para configurar acessos sem exigir login Microsoft. Não conectar automaticamente ao listar.
- [ ] Rodar testes/typecheck. Teste em voo captura revisão antiga e falha em assertCurrent antes de emitir/cachear; commit.

## Tarefa 3 — Identidade de aplicação e APIs por acesso

**Arquivos:** criar `src/server/auth/{identity-provider,application-provider}.ts`, `tests/server/application-auth.test.ts`; modificar `msal-provider.ts`, `session-store.ts`, `app.ts`, `azure/http.ts`, `azure/inventory.ts`, `costs/service.ts`, `chat/tools.ts`.

**Interfaces:** `IdentityProvider.getToken(ctx:ExecutionContext,audience:string):Promise<string>`, `connect(accessId:string,mode:'user'|'application',sessionId:string):Promise<ConnectionStatus>`, `disconnect(sessionId:string):Promise<void>`. Aplicação usa `ConfidentialClientApplication.acquireTokenByClientCredential({scopes:[audience+'/.default']})`; ARM audience é https://management.azure.com. Usuário preserva popup/PKCE/nonce do fluxo atual e vincula acesso/revisão no estado servidor.

- [ ] Testes falhando: modo aplicação não chama begin/getAuthCodeUrl; Secret vem só do SecretStore; tokenCache separado por acesso/versão/audience; token de Fabric não pode atender ARM; erro 401/403 não aparece como custo zero.
- [ ] Teste edição do perfil entre begin/finish: recusar resultado e não autenticar sessão antiga; `expect(session.principalKind).toBe('application')` apenas depois de token validado. Rodar RED.
- [ ] Implementar ativação explícita `/api/accesses/:id/connect`, teste e disconnect; exigir modo e validade mínima dos campos. Falta de Secret retorna erro de configuração antes de rede. Erros Microsoft sanitizados.
- [ ] Adaptar inventário, custos, budgets e benefícios a ExecutionContext/IdentityProvider; validar tenant/subscription de toda consulta. Acrescentar origem/connectionId e versões às chaves do cache e revalidar antes de gravar. Durante migração, o login inicial continua disponível e pode oferecer salvar identificadores, sem criar Secret.
- [ ] Rodar `npm test -- tests/server tests/costs tests/budgets tests/benefits`; exigir regressões verdes, incluindo nonce. Aceite real de client credentials depende do Secret informado localmente, nunca pelo chat. Commit.

## Tarefa 4 — Política de destinos e transporte autenticado

**Arquivos:** criar `src/server/security/{endpoint-policy,credential-binding}.ts`, `tests/security/endpoint-policy.test.ts`; ajustar transporte HTTP compartilhado quando necessário. Instalar undici fixo somente após conferir API necessária de dispatcher/connect.

**Interfaces:** `validateEndpoint(input:string,policy:EndpointPolicy):Promise<ValidatedEndpoint>`; `fetchBound(endpoint:ValidatedEndpoint,binding:CredentialBinding,init:RequestInit):Promise<Response>`. EndpointPolicy contém host/porta/protocolo aprovados e permissão de rede privada explícita; binding contém ID da conexão, audience e versão, não segredo serializável.

- [ ] Testes falhando: URL com userinfo, metadata 169.254.169.254, host estranho, IPv4-mapped IPv6 e loopback não autorizado são recusados; redirect 302 não recebe segundo request com Authorization; DNS rebind usa IP validado na conexão efetiva, mantendo TLS SNI do host.
- [ ] Rodar `npm test -- tests/security`; confirmar RED.
- [ ] Implementar HTTPS por padrão, HTTP somente loopback aprovado e bloqueio explícito de redirects. Validar resolução e conectar no IP aprovado por dispatcher; repetir validação de política/versionamento a cada operação. Endpoints Azure públicos usam hosts/audiences de preset; privados exigem cadastro explícito, sem metadados de nuvem.
- [ ] Aplicar a mesma camada ao MCP HTTP e modelo. Descoberta OAuth só pode visitar autoridade previamente vinculada; um WWW-Authenticate não autoriza exportar credenciais para outro host. Falha é explícita, sem seguir destino arbitrário.
- [ ] Rodar testes/typecheck; demonstrar em servidor local sintético que não houve vazamento de token em redirect/DNS. Commit.

## Tarefa 5 — Cliente MCP, OAuth e ciclo de vida

**Arquivos:** criar `src/server/mcp/{client,http-transport,stdio-transport,oauth,registry}.ts`, `tests/mcp/{client,lifecycle,oauth}.test.ts`. Instalar @modelcontextprotocol/sdk 1.32.2 após conferir exports.

**Interfaces:** `McpConnection.connect(ctx,profile):Promise<void>`, `listTools():Promise<ToolDescriptor[]>`, `callTool(name,args,ctx):Promise<McpToolResult>`, `disconnect():Promise<void>`; `McpRegistry.get(ctx,id):Promise<McpConnection>`. ToolDescriptor contém nome, schema, hash e hints; conteúdo MCP limitado e tratado como dado não confiável.

- [ ] Escrever fixtures MCP HTTP/stdio que implementam initialize, tools/list e tools/call. Testes: handshake real do protocolo; paginação e limites; timeout/cancelamento; stderr nunca vira resultado; desconectar mata processo próprio; retry não duplica tools/call.
- [ ] Testar alteração de schema após conectar: aprovação anterior deixa de valer. Rodar `npm test -- tests/mcp` e confirmar RED.
- [ ] Implementar Streamable HTTP com política da tarefa 4 e stdio pelo SDK. Executáveis/argumentos vêm de presets internos fixos, nunca campo livre da interface. Versões de pacotes executados são fixadas no plano de instalação/lockfile, não `latest` em runtime. Ambiente mínimo por conexão, sem herdar segredos globais.
- [ ] Implementar OAuth delegado por conexão usando mecanismo documentado do servidor/SDK, com PKCE/state/nonce quando aplicável, callback dedicado e tokens por audience em memória. Client registration/discovery só com autoridades autorizadas. Salvar referência de acesso e metadados públicos; não copiar um token ARM para MCP. Métodos não comprovados são pending/unsupported antes de solicitar Secret.
- [ ] Rodar testes/typecheck e desligamento de subprocessos. Revisão de configuração/credencial desconecta conexões antigas. Commit.

## Tarefa 6 — Presets Microsoft, ferramentas e matriz de autenticação

**Arquivos:** criar `src/server/mcp/{presets,capabilities,tool-policy,query-policy,routes}.ts`, `tests/mcp/{presets,tool-policy,query-policy}.test.ts`, `docs/mcp-auth-matrix.md`.

**Interfaces:** `getCapability(profile,mode):CapabilityRecord`; `approveTools(profile,descriptors):Promise<McpProfile>`; `authorizeTool(ctx,profile,descriptor,args):ValidatedToolCall`. Executar somente resultado de authorizeTool; nunca chamar name/URL pedido pelo modelo diretamente.

- [ ] Testes falhando: identificar URL GitHub/catálogo como não executável HTTP; cadastro dos cinco presets; readOnlyHint sozinho não permite execução; schemaHash alterado recusa; metadata/token/secrets removidos de resultados antes do contexto; resultado acima de 128 kB é truncado com aviso explícito.
- [ ] Testes KQL/DAX negativos: comandos de gerenciamento, referências a outros clusters/databases/modelos e funções de acesso externo são recusados. Implementar subconjunto conservador por adapter; não basta regex de início. Construção não reconhecida fica indisponível. Rodar RED.
- [ ] Implementar presets Azure/ADX via Azure MCP local ou HTTP informado, Foundry https://mcp.ai.azure.com, Fabric Core https://api.fabric.microsoft.com/v1/mcp/core, Power BI https://api.fabric.microsoft.com/v1/mcp/powerbi. Fabric local como preset oficial alternativo. ADX exige cluster/database; Power BI modelo; Fabric workspace quando requerido.
- [ ] Criar matriz a partir de documentação verificada de cada preset: serviço/transporte × usuário/aplicação, disponível/pendente/não suportado, motivo/fonte/data. Azure stdio+aplicação pode usar env AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET com cadeia explicitamente fixada, conforme versão oficial testada. Usuário local sem vínculo verificável de identidade é pending, sem herdar CLI. HTTP delegado e aplicação só habilitados quando contrato do endpoint demonstrar suporte; jamais marcar todos como compatíveis por terem OAuth.
- [ ] Criar rotas CRUD, testar/conectar/desconectar/listar ferramentas/aprovar. Conexão somente autenticada não é consulta validada; exigir tools/call de leitura. Registrar previews/Fabric IQ como informação, preservando Power BI pedido. Rodar testes/typecheck; commit.

Rotas MCP: GET/POST `/api/mcp-connections`, PATCH/DELETE `/api/mcp-connections/:id`, POST `/:id/test`, `/:id/connect`, `/:id/disconnect`, `/:id/approve-tools`, GET `/:id/tools` e `/:id/capabilities` sob o mesmo prefixo. Não expor tools/call bruto sem authorizeTool. Profile/ctx dos contratos desta tarefa são McpProfile/ExecutionContext.

## Tarefa 7 — Roteamento explícito de dados API/MCP

**Arquivos:** criar `src/server/connections/{data-provider,api-provider,mcp-provider}.ts`, `tests/connections/data-provider.test.ts`; ajustar rotas custos/budgets/benefícios e chat/tools.

**Interfaces:** `DataProvider.queryCosts(ctx:ExecutionContext,query:CostQuery):Promise<CostResult>`, `getBudgets(ctx,scope):Promise<BudgetStatus>`, `analyzeBenefits(ctx,scope,kind):Promise<BenefitAnalysis>`; `resolveProvider(selection:DataSelection):DataProvider`.

- [ ] Testes falhando: source=api usa somente API; source=mcp chama MCP ou retorna unsupported sem tocar REST direto; resultados normalizados trazem fonte, operação e conexão corretas; troca de fonte invalida cache/contexto.
- [ ] Rodar `npm test -- tests/connections/data-provider.test.ts`; confirmar RED.
- [ ] Encapsular serviços REST existentes em ApiProvider. McpProvider tem mapa explícito de adapters por capacidade. Sem ferramenta equivalente a Cost Management, queryCosts retorna unsupported com orientação de selecionar API. Não somar Pricing/Advisor como gasto real.
- [ ] Resultados MCP genéricos permanecem tipados como conexão e não são forçados a CostResult. Adicionar operação de consulta genérica ao chat/painel de conexões, mediada pela tarefa 6. Revisões verificadas antes de ferramenta, emissão e cache.
- [ ] Rodar regressões de custos/identidade e testar provenance; commit.

## Tarefa 8 — Agente local e provedor de modelo independente

**Arquivos:** criar `src/server/agents/{service,routes,model-provider,runtime}.ts`, `tests/agents/{service,model-provider,runtime}.test.ts`; ajustar `chat/routes.ts` (extrair de app.ts se necessário), `chat/tools.ts` e `shared/contracts.ts`.

**Interfaces:** `AgentRuntime.ask(ctx:ExecutionContext,agent:AgentProfile,input:ChatInput,emit:(event:ChatEvent)=>void):Promise<void>`; `ModelProvider.complete(input:ModelTurn,signal:AbortSignal):Promise<ModelTurnResult>`. TurnResult é texto ou toolCalls com IDs/nomes/argumentos estritos. `AgentService.save/list/duplicate/remove/testModel` retorna DTO sem segredos.

- [ ] Testes falhando: runtime não instancia CopilotClient; modelo solicita azure_query → serviço autorizado → segundo turno com resultado → resposta; referência de ferramenta inexistente, escrita, outro tenant ou endpoint vindos do modelo são recusados.
- [ ] Testar dez chamadas (a 11ª é negada), dois minutos com relógio falso, 8.000 caracteres, cancelamento, tool-call JSON inválido, ausência de tool calling e prompt injection nos resultados. Editar agente/modelo/credencial durante inferência bloqueia resposta antiga. Rodar RED.
- [ ] Implementar adapter Azure Chat Completions v1 em `/openai/v1/chat/completions`, model=deployment configurado, tool calling e limite de tokens de saída suportado. Usar chave de inferência protegida ou IdentityProvider para audience Azure cognitiveservices, conforme o endpoint; confirmar contrato/documentação antes de fixar headers. Nenhuma credencial no prompt. Endpoint validado pela tarefa 4.
- [ ] Implementar loop local com orçamento absoluto iniciado antes da primeira rede, signal em todas as chamadas e revisão de vínculos em cada etapa. Credenciais/endpoint/identidade nunca são escolhidos pelo modelo. Preservar resultados verificáveis e avisos; modelo não recalcula totais monetários.
- [ ] Implementar CRUD/testes de modelo independentes de testes de acesso. Teste real de inferência é explícito e informa consumo do provedor; nenhum deployment automático. Copilot permanece runtime separado usando a mesma mediação de ferramentas de negócio.
- [ ] Rodar testes/typecheck. Credenciais/modelo reais ausentes mantêm inferência real pendente, não mock em produção. Commit.

Rotas de agentes: GET/POST `/api/agents`, PATCH/DELETE `/api/agents/:id`, POST `/:id/duplicate` e `/:id/test-model` sob o mesmo prefixo. `/api/chat` continua a rota de execução, com novo ChatInput validado pelo servidor. Métodos CRUD compartilham as mesmas regras de versão/invalidação de acessos e MCPs; conexão é aceita apenas se estiver nos vínculos persistidos do agente.

## Tarefa 9 — Interface integrada de acessos, MCPs e agentes

**Arquivos:** criar `src/web/pages/{Accesses,McpConnections,Agents}.tsx`, `src/web/components/{AccessSelector,DataSourceSelector,SecretInput,ConnectionStatus}.tsx`, atualizar `App.tsx`, `api.ts`, `pages/Chat.tsx`, `components/ScopeFilters.tsx`, `styles.css`; criar `tests/e2e/connections.spec.ts`.

**Interfaces:** api client segue rotas anteriores; nunca recebe secretRef/valor de segredo em GET. ChatInput ganha runtime:'copilot'|'agent', agentId opcional e DataSelection. ExecutionContext é montado no servidor, não confiado ao navegador/modelo.

- [ ] Escrever e2e RED: salvar rascunho; conectar aplicação sem popup; usuário abre popup; segredo existente não reaparece ao editar; reiniciar/configuração persistida; erro específico em modo não suportado antes de pedir credencial; agente cadastrado selecionável e contexto limpo ao trocar runtime.
- [ ] Implementar navegação Acessos/MCPs/Agentes e formulários em português. Mostrar Secret Value distinto de Secret ID e chave de modelo. Expor ações manter/substituir/remover segredo; excluir com referências apresenta bloqueio claro. IDs de aplicação/diretório são editáveis, não inferidos de nome.
- [ ] Adicionar seletores acesso/fonte ao dashboard e seletor Copilot local/Agente cadastrado ao chat. Mostrar origem/identidade/servidor e estados completos/parciais/sem capacidade. Fonte MCP sem custo equivalente oferece escolher API, sem troca automática.
- [ ] Exibir matriz de autenticação/capacidades, contexto específico por serviço e allowlist de ferramentas. Testar/conectar/modelo/dados são ações distintas; não declarar consulta validada por cadastro salvo. Consentimento do chat identifica o provedor que receberá dados.
- [ ] Rodar e2e, testes de serviço, typecheck/build. Inspecionar visualmente no notebook, popup, estados de erro e formulários com dados sintéticos, sem capturar segredos em screenshots. Commit.

## Tarefa 10 — Aceites reais, operação e entrega

**Arquivos:** atualizar `docs/setup.md`, `docs/validation.md`, `README.md`, `scripts/start.ps1`; criar `docs/connections-validation.md`.

**Interfaces:** relatório por capacidade com código implementado, teste sintético, revisão visual e teste real separados; estado real é available/pending/unsupported e fonte/data. Nada de “integração concluída” só por mocks verdes.

- [ ] Rodar `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, auditoria de dependências de produção e `git diff --check`. Corrigir falhas materiais; testes adicionais só por mudanças/falhas/riscos novos.
- [ ] Verificar DPAPI sintético real, persistência após reinício, rotação e limpeza de sessões; comprovar ausência de segredo em respostas/logs/argumentos usando fixture de teste, sem varrer credenciais reais do Windows.
- [ ] Com acessos fornecidos localmente, validar login de usuário, identidade de aplicação sem popup e consulta de custo real em scope autorizado. Validar MCP initialize/tools/list/tools/call por preset disponível e uma pergunta de agente local com ferramenta real. Marcar recursos/licenças/endpoints ausentes individualmente como pendentes.
- [ ] Conferir resultado de custos com portal usando mesmo período/base/moeda, sem misturar consulta modelo semântico com gasto Azure. Registrar metadados sanitizados, nunca dados privados em Git.
- [ ] Revisão independente final do conjunto, com foco em segredos, SSRF, OAuth, versões e limites de ferramentas. Corrigir achados materiais por regressões RED→GREEN e repetir verificações afetadas.
- [ ] Entregar serviço local iniciado, comandos de operação, documentação da matriz e limitações reais. Preservar identidades existentes; não publicar, implantar recursos, alterar RBAC ou configurar Teams.

## Auto-revisão e handoff

R1 coberto por tarefas 5–7/9; R2 por 3; R3/R4 por 1–3/9; R5 por 8–9; R6 por 5–6/9. Os cinco itens de Review Focus têm testes explícitos nas tarefas indicadas. Interfaces de fonte/identidade/modelo permanecem separadas; tool schema não concede autorização. As quatro recomendações da revisão do desenho aparecem nas tarefas 2/4/6/8.

As tarefas têm dependências compartilhadas e serão executadas na ordem acima. Manter execução nativa nesta conversa, com revisão independente final, conforme método utilizado no MVP. Plano sujeito à revisão do usuário antes da implementação conforme skill writing-plans. Se o usuário preferir trabalho por agentes em cada tarefa, registrar a mudança antes de executar.
