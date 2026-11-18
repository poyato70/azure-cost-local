# Missão 16 — Diagnóstico e validação controlada do acesso Azure ARM MCP

## Identificação

- **Estado atual:** Diagnóstico concluído; compatibilidade parcial por caminho, mas configuração cadastrada e autorização efetiva não verificadas.
- **Início observado:** Não registrado no início; não estimado retrospectivamente.
- **Conclusão observada:** 2026-11-16 18:06 -03:00 (relógio UTC consultado; convertido para America/Sao_Paulo).
- **Repositório:** `poyato70/azure-cost-local`.
- **Checkout legado preservado:** `D:\DEV\FinOps\Tesseract`, `main`, HEAD `db9eed3274337f8e17b03d467ca2644ed852e513`, 33 commits atrás de `origin/main`; seis alterações locais staged preservadas: `docs/demo/README.md`, `src/web/App.tsx`, `src/web/components/Navigation.tsx`, `src/web/pages/DemoWorkspace.tsx`, `src/web/styles.css` e `tests/e2e/demo-workspace.spec.ts`.
- **Worktree inspecionada:** `D:\DEV\FinOps\Tesseract-missao-16`, detached em `origin/main` `facd3dfd794b1b9a2750f53280e763447ebe6ecd`.
- **Stash M13:** `codex-preserve-before-mission-13` observado no estado conhecido anterior e não tocado nesta missão.
- **Publicação:** Não aplicável nesta etapa; sem commit, PR ou merge.

## Objetivo e escopo

Verificar se a identidade de aplicação já informada pelo usuário pode ser reaproveitada em Azure REST, ARM MCP remoto e Azure MCP local, confrontando a implementação do HEAD atual com documentação Microsoft/Azure. Não foram acessados secrets/tokens, o armazenamento operacional nem tenant corporativo. Não foi iniciado login nem chamada externa.

## Decisão

**PARCIALMENTE COMPATÍVEL (por caminho); conexão registrada e autorização NÃO VERIFICADAS.**

- O código tem autenticação `client_credentials` para chamadas Azure REST usando o perfil de acesso salvo. Assim, um perfil app-only existente pode ser reaproveitado nessa rota, condicionado a credencial válida, audience correta e RBAC/escopo Azure já concedidos. Nenhuma dessas condições da conexão do usuário foi observada nesta execução.
- O preset atual para o ARM MCP remoto recusa o modo `application`. O endpoint oficial exige token delegado com `MCP.Access`; o token app-only para Azure Resource Manager REST tem audience e semântica diferentes. O perfil de aplicação existente, por si só, não é intercambiável com a autorização delegada remota.
- O preset Tesseract `azure` local `stdio` está codificado para repassar o perfil de aplicação ao Azure MCP via variáveis `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` e `AZURE_TOKEN_CREDENTIALS=EnvironmentCredential`. Documentação oficial do Azure MCP confirma suporte a `EnvironmentCredential` e Service Principal. Isso demonstra compatibilidade arquitetural prevista, não funcionamento do pacote local no ambiente, conexão cadastrada, RBAC ou consulta real.
- Não foi possível confirmar se o perfil mencionado pelo usuário existe, se está configurado como `preferredMode: application`, se tem secret cadastrado ou se corresponde ao tenant/escopo pretendidos. A API `/api/accesses` exige sessão local; não havia serviço Tesseract ouvindo na porta padrão 4317. A inspeção não leu arquivo de armazenamento para contornar essa barreira.

## Matriz de compatibilidade

| Caminho | Mecanismo/identidade | Público do token | Permissão | Compatibilidade no código | Evidência e impedimento |
|---|---|---|---|---|---|
| A. Azure REST direto (Cost Management/ARM) | Service Principal via MSAL `acquireTokenByClientCredential` | `https://management.azure.com/.default` | RBAC e/ou permissões de billing no escopo consultado; atribuição exata varia por API e escopo | **Compatível tecnicamente**, se o perfil existente e as permissões estiverem válidos | `ApplicationProvider.details()`; `IdentityProvider.connectApplication()`; `ArmHttp` e `AzureCosts.queryCosts()`. `tests/server/application-auth.test.ts` verifica client credentials com token sintético. Nenhuma chamada Azure real ou verificação do perfil atual ocorreu. [Microsoft Cost Management API permissions](https://learn.microsoft.com/en-us/azure/cost-management-billing/automate/cost-management-api-permissions) |
| B. Azure Resource Manager MCP remoto | OAuth delegado por usuário no cliente Tesseract | `api://22bfbae3-f4e7-485f-be43-8cee15065084/MCP.Access` | Consentimento para scope delegado `MCP.Access` e RBAC do usuário no escopo de destino | **Incompatível com modo app-only atual**; delegado é suportado pelo código | `presets.ts` marca `arm` com `application` como `unsupported`; `resourceScopes()` retorna `MCP.Access`; `IdentityProvider.begin()` usa fluxo de usuário; `McpRegistry.connect()` exige principal `user`. `tests/mcp/arm-policy.test.ts` e `tests/mcp/arm-transport.test.ts` usam fixtures, não serviço Microsoft. [Configuração oficial de clientes ARM MCP](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-resource-manager-mcp-other-clients), [repositório ARM MCP](https://github.com/Azure/Azure-Resource-Manager-MCP) |
| C. Azure MCP Server local gerenciado pelo Tesseract | Processo `stdio` com EnvironmentCredential/Service Principal | Token de saída obtido pelo Azure Identity para os recursos usados pelas tools; não é o token de entrada do ARM MCP remoto | RBAC/autorizações dos recursos consultados; conjunto exato depende das tools | **Compatível por desenho**, ainda não validado em runtime | `McpRegistry.connect()` prepara ambiente app-only e preset local `azure` usa `@azure/mcp@3.0.0`/`azmcp`. [Autenticação oficial Azure MCP](https://github.com/Azure/azure-mcp/blob/main/docs/Authentication.md), [EnvironmentCredential](https://learn.microsoft.com/en-us/dotnet/api/azure.identity.environmentcredential?view=azure-dotnet). Não iniciado: execução do preset pode invocar `npm exec --yes`; não seria somente inspeção e pode obter pacote. Nenhum processo foi iniciado. |

### Distinções importantes

- Um **app registration** tem um client ID; seu service principal é a representação da aplicação dentro do tenant. Client ID/secret para fluxo client credentials identificam o aplicativo, mas não substituem consentimento delegado e identidade do usuário exigidos pelo ARM MCP remoto.
- O mesmo client ID pode, em tese, participar de fluxo delegado se o app registration e a política do tenant permitirem redirect URI e fluxo público de auth code/PKCE usados pelo Tesseract. Isso não foi demonstrado para o cadastro existente. O Tesseract instancia `PublicClientApplication` para login delegado; o secret salvo não é usado nesse login.
- ARM MCP remoto e Azure MCP local são servidores distintos. Não se deve inferir que suporte a Service Principal no Azure MCP local implica suporte app-only no ARM MCP remoto.

## Evidências inspecionadas

- Instruções: `D:\DEV\AGENTS.md`, `AGENTS.md`, `docs/relatorios/TEMPLATE.md` e `docs/relatorios/README.md`.
- Histórico: `docs/relatorios/missao-14.md` e `docs/relatorios/missao-15.md`. M15 relata adaptador e fixtures locais; declaração explícita de que descoberta/consulta autenticada Azure permanecia pendente.
- Identidade: `src/server/auth/application-provider.ts`, `identity-provider.ts`, `msal-provider.ts`, `resource-scopes.ts`.
- Conexões: `src/shared/connections.ts`, `src/server/connections/access-service.ts`, rotas `/api/accesses` em `src/server/connections/routes.ts`.
- MCP: `src/server/mcp/presets.ts`, `registry.ts`, `tool-policy.ts`, `arm-policy.ts`.
- FinOps: `src/server/azure/http.ts`, `src/server/costs/service.ts`, `src/server/finops/azure-arm-mcp-adapter.ts`.
- Testes: `tests/server/application-auth.test.ts`, `tests/mcp/arm-policy.test.ts`, `tests/mcp/arm-transport.test.ts`, além de `tests/e2e/forecast-arm.spec.ts`.
- Fontes Microsoft/Azure abertas nesta missão: documentação ARM MCP de configuração/autorização, permissões Cost Management API, autenticação Azure MCP e `EnvironmentCredential`.

## Metadados locais e limites

- `GET /api/accesses` exige cookie de sessão; `AccessService.list()` remove `secretRef` e expõe apenas `secretConfigured` como booleano. A leitura seria sanitizada, mas requer sessão autenticada.
- A rota `/api/accesses/:id/test` obtém token de verdade, logo é uma chamada externa e não foi executada.
- Na inspeção de portas locais, havia listeners em 7680 e 5040; nenhum em 4317, que é a porta padrão da configuração Tesseract (`src/server/config.ts`). Não foi feita requisição HTTP local, login, autenticação MSAL, consulta Entra, descoberta MCP nem query de dados.
- O usuário informa que há um Service Principal cadastrado; isso permanece **DOCUMENTED/relatado pelo usuário**, não **AS-IS comprovado** nesta sessão.
- Nenhum secret, token, conteúdo do cofre, arquivo de armazenamento operacional ou tenant corporativo foi acessado.

## Respostas solicitadas

1. **O Service Principal existente pode ser reutilizado?** Tecnicamente sim em Azure REST e no caminho Azure MCP local codificado, caso o perfil e credencial existentes sejam válidos. A existência/configuração efetiva não foi verificada via interface segura nesta execução.
2. **Funciona em quais caminhos?** Azure REST: suporte implementado, autorização não testada. ARM MCP remoto: não como app-only; requer autorização delegada compatível. Azure MCP local: caminho app-only previsto e correspondente às credenciais EnvironmentCredential, ainda não executado.
3. **O Tesseract suporta autenticação necessária?** Sim para client credentials no Azure REST, OAuth delegado para ARM MCP remoto e EnvironmentCredential repassada ao Azure MCP local. Suporte de código não equivale a conexão/integração operacional comprovada.
4. **Quais testes reais foram executados?** Nenhum teste real contra Azure/ARM MCP. Testes de código já existentes foram lidos, mas não executados nesta missão; fixtures não comprovam conectividade externa.
5. **Menor conjunto de mudanças necessário?** Para REST, nenhuma mudança de código identificada; confirmar metadados do perfil e autorização existente pela UI, depois testar leitura controlada. Para ARM MCP remoto, selecionar/configurar a conexão como HTTP/delegada e obter o consentimento `MCP.Access`; não reaproveitar app-only como se fosse delegado. Para MCP local, antes de alterar algo, validar versão/pacote no ambiente isolado e a configuração da conexão existente; nenhuma mudança é atualmente justificada.
6. **Ação humana indispensável?** Se o objetivo é ARM MCP remoto, um usuário precisa completar login delegado e consentimento `MCP.Access` permitido pela política da organização; administrador só se a política exigir consentimento administrativo ou provisionamento do recurso. Nenhum consentimento ou privilégio foi solicitado/concedido. Para validação de REST/local, é indispensável confirmar pela interface que o perfil correto está cadastrado e que já possui autorização de leitura no escopo de teste.

## Validação e decisões

| Verificação | Resultado | Limite |
|---|---|---|
| Estado Git do checkout inspecionado | Aprovado: detached em `facd3dfd794b1b9a2750f53280e763447ebe6ecd`, sem alterações antes do relatório | Checkout legado com staged local foi preservado em separado |
| Inspeção de autenticação, contratos e testes | Aprovado | Análise de código; execução automatizada bloqueada pela ausência das dependências locais |
| Consulta a documentação oficial atual | Aprovado | Referências não verificam tenant nem configuração específica do usuário |
| API sanitizada de metadados da conexão cadastrada | Bloqueado por ausência de sessão/serviço local ativo | Sem leitura direta do armazenamento operacional |
| Autenticação, `tools/list` e consulta Azure | Não executado | Exige sessão/consentimento/permissões atuais, não comprovados; sem acesso a tenant |
| `npm exec -- vitest run tests/server/application-auth.test.ts tests/mcp/arm-policy.test.ts tests/mcp/arm-transport.test.ts --reporter=dot` | Bloqueado | `node_modules/.bin/vitest.cmd` ausente; dependências não instaladas por restrição de não instalar sem autorização |
| Outros testes, build, typecheck | Não executado | Não necessários para a inspeção documental; nenhuma dependência instalada |
| `git diff --check` após relatório | Aprovado | Nenhum erro de whitespace |

## Plano de continuidade proposto

1. Usuário abre a aplicação normalmente e confirma na tela Acessos qual perfil existente deve ser usado; verificar apenas nome/tipo e `secretConfigured`, sem exibir secret. Não criar credencial duplicada.
2. Para verificar REST, usar teste de token ARM somente após confirmação do perfil/sessão; depois executar uma leitura mínima no escopo explicitamente autorizado. Token obtido não comprova permissão de leitura.
3. Para ARM MCP remoto, vincular esse perfil somente se seu app registration puder executar o fluxo delegado configurado; usuário conclui popup `MCP.Access`, então fazer `tools/list`, rever schemas/allowlist e executar a consulta mínima escopada. Se o app registration não puder delegado, parar e obter orientação do administrador antes de alterar o registro.
4. Para Azure MCP local, numa etapa autorizada separada, validar `@azure/mcp@3.0.0` e execução isolada em ambiente temporário. Não presumir que a instalação via `npm exec` já existe nem iniciar automaticamente.
5. Registrar resultados reais separados por mecanismo; nenhum resultado de fixture substitui resposta do Azure.

**Progresso:** 3/4 etapas diagnósticas concluídas (75%): inspeção/contexto, matriz documental e análise de compatibilidade; validação local da conexão e chamadas externas bloqueadas por ausência de sessão/aplicação ativa e autorização verificável. O início não foi cronometrado, portanto o tempo decorrido não pode ser reportado sem estimativa.

## Riscos residuais

- Perfil e secret cadastrados, validade do secret, app registration/redirect URI, tenant, consentimento, RBAC, escopo e acesso a Cost Management/Resource Graph permanecem desconhecidos.
- Documentação de ferramentas e autenticação pode evoluir; a fonte oficial foi consultada nesta missão, mas o pacote local pinado precisa ser verificado sem iniciar integração.
- A aplicação executa código de terceiros no processo MCP local; sua execução e cadeia de credenciais exigem validação isolada antes de uso operacional.
- Autenticação bem-sucedida não prova autorização financeira, completude, paginação nem integridade da consulta.

## Publicação

- **Commit/PR/merge:** Não realizados nem iniciados.
- **Relatório:** criado nesta worktree isolada conforme instrução de repositório.

## Continuação — validação local (2026-11-16)

### Dependências e verificações atuais

- `npm ci` concluiu na worktree M16: 371 pacotes adicionados, 378 auditados, zero vulnerabilidades reportadas. `package.json` e `package-lock.json` permaneceram sem diff.
- O npm 11 observou scripts de instalação não aprovados para `esbuild@0.27.2` e `koffi@3.2.1`; esses scripts foram omitidos pela política `allowScripts`. Nenhuma política foi alterada e nenhum script foi aprovado manualmente.
- `npm test -- --reporter=dot tests/server/application-auth.test.ts tests/server/auth.test.ts tests/server/session.test.ts tests/connections/access-service.test.ts tests/connections/independent-transport.test.ts tests/connections/mcp-identity.test.ts tests/mcp/arm-policy.test.ts tests/mcp/arm-transport.test.ts tests/mcp/client.test.ts tests/mcp/mission10-registry.test.ts tests/mcp/tool-policy.test.ts tests/security/review-regressions.test.ts`: **12 arquivos, 33 testes aprovados**.
- `npm test -- --reporter=dot`: **62 arquivos, 190 testes aprovados**.
- `npm run typecheck`: aprovado, código de saída 0.
- `npm run build`: aprovado, Next.js compilou, gerou páginas estáticas e compilou TypeScript do servidor; código de saída 0.
- `npm audit --audit-level=high`: `found 0 vulnerabilities`.
- `git diff --check`: aprovado após atualizar este relatório. A worktree contém somente a atualização do relatório e do índice; manifests/lockfile sem diff. `node_modules`/artefatos ignorados foram criados pela validação local.
- Os testes foram locais, incluindo fixtures MCP e tokens sintéticos. Nenhum teste acessou tenant ou credencial real.

### Cadastro e conectividade — ainda bloqueados

- Na verificação desta continuação, nenhum listener Tesseract foi encontrado na porta padrão 4317. Os listeners observados nas portas 5040 e 7680 pertenciam a `svchost.exe`, não ao entrypoint Tesseract.
- O ambiente de processo desta execução não contém `AZURE_TENANT_ID` nem `AZURE_CLIENT_ID` configurados; os valores não foram lidos/expostos. A API de perfil `/api/accesses` exige cookie de sessão autenticada.
- Não iniciei a aplicação nesta worktree: `buildApp()` chama `McpOrchestration.init()`, que lê e regrava o histórico persistente para recuperar estados `running_*` e invalidar confirmações pendentes. Isso pode alterar o armazenamento operacional durante o startup. A instância ausente e o perfil armazenado não puderam ser consultados por sessão legítima sem iniciar esse fluxo. Também não usei acesso direto a arquivos ou segredos.
- Consequentemente, nenhum metadado do perfil real, teste de token, autorização RBAC, consulta REST, `tools/list` ou chamada Azure MCP local foi obtido. Não houve erro de autenticação Azure a registrar porque nenhuma tentativa externa foi feita.
- Para prosseguir com o perfil cadastrado, é necessário disponibilizar a instância já em uso e uma sessão autenticada pela interface normal, ou autorizar explicitamente o startup controlado deste checkout contra o armazenamento operacional, ciente da recuperação que o `init()` executa. Isso não concede consentimento Entra nem permissões Azure.

### Estado da decisão

O estado permanece **PARCIALMENTE COMPATÍVEL por arquitetura, configuração concreta NÃO VERIFICADA**. A etapa local foi validada, mas não há evidência para escolher A (Azure REST) ou B (Azure MCP local) com o Service Principal cadastrado. C (ARM MCP remoto) continua dependendo de OAuth delegado `MCP.Access` e não deve receber tentativa app-only. Próxima decisão aguarda leitura sanitizada do perfil pela UI autenticada e autorização demonstrável para uma operação de leitura.

- **Continuação iniciada:** 18:21 -03:00, arredondado do início do processo `npm ci` observado às 18:21:05.
- **Conclusão observada:** 18:33 -03:00.
- **Tempo decorrido desta continuação:** aproximadamente 12 minutos, calculado dos marcos observados; não inclui a fase inicial da Missão 16.

## Continuação — caminho somente leitura para metadados (2026-11-16)

### Mecanismo já existente

- A UI chama `GET /api/bootstrap`; sem cookie local, esse endpoint cria uma sessão local e a envia como cookie `sid`. O bootstrap não exige autenticação Microsoft para carregar configurações locais.
- Em seguida, `App.reloadSettings()` chama `GET /api/accesses` e `GET /api/mcp-connections`. Essas rotas exigem a sessão local por cookie, mas não exigem `userId` Microsoft para listar metadados.
- `AccessService.list()` converte cada perfil com `publicAccess()`, que retira `secretRef` e expõe somente `secretConfigured: boolean`. O modelo público inclui nome, UUID de perfil, modo preferido e versões; a tela **Acessos** mostra nome, modo, indicador de Secret e Tenant/Client ID.
- `McpRegistry.list()` aplica `publicProfile()`, que remove `tokenRef` e retorna somente `tokenConfigured: boolean`; também acrescenta capacidade, estado e conexão ativa. A página **MCPs** mostra provedor/preset, transporte, endpoint, autenticação, pacote ou grupo de tools quando aplicável, e identidade Azure associada.
- Para ARM, `resourceContext.scope` vem no perfil público, mas o resumo da conexão não o apresenta. A tela **Editar MCP** carrega valores em memória; a seção **Contexto de recursos — configuração avançada** revela o JSON de scope sem gravá-lo, desde que o usuário não pressione **Salvar**. Azure REST não armazena scope no perfil de acesso: o escopo é selecionado na consulta (subscription/resource group).
- A UI não exibe o UUID interno do perfil no cartão; o endpoint sanitizado o contém. Para distinguir perfis pelo procedimento normal, nome, modo, status do Secret e Tenant/Client mostrados na própria tela são suficientes. Se houver nomes duplicados, o operador pode identificar o card por Tenant/Client sem copiar esses GUIDs para conversas.
- `/api/mcp-presets` também é uma rota de leitura de sessão e retorna a matriz de capabilities conhecidas; isso descreve suporte do produto, não prova que existe uma conexão salva nem que a conexão foi testada.

### Procedimento mínimo para o usuário

1. Use a instância Tesseract que já está em operação (URL/porta que o operador normalmente utiliza); não abra uma segunda instância desta worktree contra o mesmo armazenamento.
2. Na navegação **Conexões → Acessos**, localize o perfil existente. Leia apenas nome, modo (**Aplicação** ou **Usuário**), indicador **Secret configurado/Sem Secret** e versão. Não use **Testar Secret**, **Conectar aplicação** ou **Conectar usuário** durante esta inspeção; esses botões fazem autenticação externa.
3. Na página **Conexões → MCPs**, confira se há perfil vinculado ao nome do acesso. Registre preset, transporte, modo de autenticação, endpoint exibido e capability/status. Para scope ARM, abra **Editar MCP** e expanda **Contexto de recursos — configuração avançada**; não salve alterações. Em Azure `stdio`, não há endpoint HTTP por desenho; confira pacote e grupo de tools. O vínculo com acesso é exibido na identidade da conexão.
4. Informe somente o nome escolhido do perfil, seu modo e se o Secret está configurado; para MCP, informe preset/transporte/autenticação/endpoint e scope necessário. Não envie Secret, token, URL OAuth, cookie, resposta integral do endpoint, nem os GUIDs completos de Tenant/Client.
5. Após confirmar perfil e scope, decidir separadamente se autoriza uma validação externa de token REST (somente autenticação), uma consulta Azure REST mínima (autorização + dados), ou um teste MCP local. A listagem de capabilities não realiza discovery; clicar **Conectar e listar tools** inicia um servidor stdio e pode disparar `npm exec --yes`, portanto requer autorização separada para executar/obter pacote.

### Estado desta etapa

O mecanismo de metadados é legítimo e sanitiza referências de credenciais, sem acesso alternativo ou bypass. No momento da inspeção, porém, não havia instância Tesseract ativa; o único processo desta worktree que habilitaria a rota executa `McpOrchestration.init()` durante a inicialização e recupera/regrava o histórico. Não iniciei a aplicação nem consultei as rotas. A consulta concreta fica aguardando o operador usar a instância normal já ativa e fornecer os poucos metadados acima.

**Próximo passo recomendado:** começar pela identificação somente leitura do perfil na tela **Acessos** e verificar se existe conexão MCP associada em **MCPs**. Isso resolve se a próxima decisão é A (REST), B (Azure MCP local) ou C (ARM MCP delegado) antes de qualquer autenticação ou query.

## Verificação final do cadastro (2026-11-16)

### Estado observado

- Worktree M16 permanece em `facd3dfd794b1b9a2750f53280e763447ebe6ecd`; alterações locais permanecem limitadas ao relatório e seu índice. Stash `codex-preserve-before-mission-13` continua listado e intocado.
- Não há listener Tesseract na porta padrão `4317`. Os listeners locais observados durante esta verificação, em `5040` e `7680`, pertencem a `svchost.exe`, não ao entrypoint `src/server/main.ts`/`dist/server/main.js`.
- Nenhuma rota de metadados foi chamada, pois requer instância Tesseract ativa e cookie de sessão local; não foi criada uma instância nem sessão.
- Não foram inspecionados diretamente arquivos locais, armazenamento operacional ou conteúdo do cofre.

### Matriz do cadastro e do próximo teste

| Campo/caminho | Resultado nesta verificação | Evidência/condição |
|---|---|---|
| Perfil de Acesso e identificador | **Desconhecido** | A tela/API sanitizada não estava disponível. A UI mostra nome e modo; o UUID interno não aparece no cartão. |
| Modo de autenticação do perfil | **Desconhecido** | Não foi possível saber se o perfil existente é `application` ou `user`. |
| Secret configurado | **Desconhecido** | A UI/rota informaria somente `secretConfigured` (boolean); nenhum conteúdo secreto seria devolvido. |
| Conexão MCP associada | **Desconhecido** | `GET /api/mcp-connections` retornaria perfis públicos por sessão, com acesso associado, capability e status; não consultado. |
| Preset, transporte e endpoint | **Desconhecido para conexões salvas** | As capabilities de produto estão implementadas, mas isso não confirma cadastro. Preset `arm` é remoto HTTP; `azure` é processo local stdio. |
| Escopo configurado | **Desconhecido** | Para ARM MCP, `resourceContext.scope` pode ser lido na UI em Editar → contexto avançado, sem salvar. Azure REST escolhe scope na consulta e não o persiste no perfil de Acesso. |
| Azure REST com Service Principal | **Compatível no código; perfil/RBAC não verificados** | `ApplicationProvider` usa client credentials e REST usa audience `management.azure.com`. Primeiro teste, após identificar o perfil: **Testar Secret** verifica aquisição do token; depois uma consulta Cost Management mínima, somente leitura, no escopo que o operador confirmar. Não executados nesta etapa. |
| Azure MCP local com Service Principal | **Compatível por desenho; runtime/cadastro não verificados** | O perfil `azure` stdio injeta EnvironmentCredential. `Conectar e listar tools` inicia subprocesso e pode invocar `npm exec --yes`; não executar sem autorização específica para iniciar/obter o servidor. |
| ARM MCP remoto com Service Principal app-only | **Incompatível no caminho atual** | O preset `arm` permite fluxo delegado `MCP.Access`; `application` é recusado. Não tentado. |
| Primeiro teste real recomendado | **REST somente após confirmação do perfil e escopo** | Separar autenticação (`Testar Secret`) de autorização/consulta (`AzureCosts.queryCosts`). Se o cadastro for só usuário ou não houver Secret, não presumir que exista SP reutilizável; não criar outro. Nenhuma query foi feita. |

### Procedimento normal ao operador — não executado

1. No checkout operacional que costuma hospedar a instância, verificar o estado sem iniciá-la: `.\status.ps1 -Port 4317`.
2. Se estiver parada, o comando normal documentado é `.\start.ps1 -Port 4317 -StartupTimeoutSeconds 60`. Executá-lo somente no checkout operacional existente, sem iniciar também a worktree M16.
3. Antes do startup, considerar seus efeitos observados no código: `McpOrchestration.init()` executa mutação e regrava o histórico; estados `running_a`/`running_b` cujo processo não está ativo são marcados `indeterminate`, sem retry; `awaiting_b_confirmation` passa a `approval_required` e recebe evento de recuperação. O startup também pode criar diretórios de dados e a inicialização de `ConfigStore` executa o helper DPAPI `acl` quando a rota lê configurações.
4. Com a instância normal aberta, navegar em **Conexões → Acessos** e ler nome/modo/indicador de Secret; depois **Conexões → MCPs** para preset, transporte, acesso vinculado, autenticação, endpoint/status/capability. Para scope ARM, abrir Editar e expandir contexto avançado, sem salvar. Não clicar em teste, conexão, autorização ou execução nesta fase.

**Decisão:** o cadastro não foi identificado porque não havia aplicação disponível e preservar o histórico impede iniciar um processo que o recuperaria/regravaria. A melhor próxima validação continua sendo Azure REST caso a UI confirme perfil `application` e Secret configurado; isso é uma recomendação condicional, não uma escolha baseada em conexão observada. Nenhuma chamada Azure ocorreu. Nenhum teste foi repetido nesta etapa.

- **Concluído às:** 2026-11-16 22:01 -03:00 (relógio UTC convertido para o fuso informado).
- **`git diff --check`:** aprovado após esta atualização.
- **Publicação:** não realizada; sem commit, PR ou merge.

## Inspeção pela instância normal — 2026-11-18

### Inicialização solicitada

- Verificação prévia: `status.ps1 -Port 4317` informou que o serviço deste checkout estava parado e a porta disponível.
- Comando solicitado pelo usuário, executado na worktree M16: `\.\start.ps1 -Port 4317 -StartupTimeoutSeconds 60`.
- Resultado: build de produção aprovado; serviço iniciou em `http://127.0.0.1:4317`; health check aprovado dentro do limite de 60 segundos.
- O startup executou `McpOrchestration.init()`, que lê e regrava o histórico operacional para recuperar estados. Conforme código, chamadas `running_a`/`running_b` com processo ausente podem virar `indeterminate`, e `awaiting_b_confirmation` pode virar `approval_required`. Não li diretamente nem comparei o conteúdo do histórico; portanto não afirmo quais transições ocorreram.

### Metadados observados na UI

A UI carregou os dados pelas rotas de leitura autenticadas por sessão local (`GET /api/accesses` e `GET /api/mcp-connections`). Não foi necessário login Microsoft para listar metadados. Nenhum botão de teste, conexão, autorização ou execução foi acionado.

| Elemento | Observação sanitizada |
|---|---|
| Perfis em Acessos | Três perfis de aplicação com Secret configurado. Todos exibiam o mesmo par Tenant/Client ID; valores e nomes completos omitidos. Isso indica registros duplicados apontando para o mesmo tenant/app registration, sem verificar o estado atual do service principal no Entra. |
| Perfil vinculado ao MCP | Um dos perfis de aplicação já cadastrados; nome omitido. |
| MCP salvo | `azure-full`; status **cadastrado**, **sem sessão MCP aberta**, zero tools permitidas/descobertas. |
| Preset/transporte/auth | `azure` / stdio local / Client Credentials (identidade de aplicação). |
| Pacote/namespace | `@azure/mcp@3.0.0`, grupo `pricing`. A tela informa que o grupo pricing consulta preços de catálogo; não representa consulta de gastos reais. |
| Endpoint | Não há endpoint HTTP para esse perfil stdio. |
| Scope | Não há scope ARM salvo nesta conexão. O contexto é namespace `pricing`. O perfil de Acesso não armazena scope Cost Management; esse scope é escolhido na consulta REST. |
| ARM MCP remoto | Existe como item de catálogo/configuração disponível, mas não foi observado perfil salvo `arm`/HTTP. Não há conexão remota ARM configurada identificada na UI. |

### Matriz atualizada e primeiro teste recomendado

| Caminho | Compatibilidade observada | Primeiro teste apropriado | Executado? |
|---|---|---|---|
| A. Azure REST com SP | Um perfil de aplicação existente tem Secret configurado; código suporta `client_credentials`. Permissão Azure/RBAC e validade do Secret continuam não verificadas. | Na tela **Acessos**, testar o perfil de aplicação já cadastrado para provar somente aquisição de token; se aprovado, confirmar scope e fazer consulta Cost Management mínima read-only. O teste de token não prova RBAC nem acesso aos dados. | Não. Nenhuma chamada externa nesta etapa. |
| B. Azure MCP local | Há conexão existente `azure-full` ligada ao mesmo perfil app-only, mas ainda está somente cadastrada e configurada para `pricing`, não FinOps real. | Após autorização específica para iniciar/baixar o processo MCP, conectar e listar tools; revisar a lista/schema real. Esse passo pode chamar `npm exec --yes`; não se presume que habilite Cost Management. | Não. Nenhum subprocesso foi iniciado. |
| C. ARM MCP remoto | Nenhum perfil remoto salvo foi identificado. O modo app-only não é aceito pelo preset remoto atual. | Se esse caminho for escolhido, criar/configurar somente após aprovação uma conexão `arm` HTTP/delegada e passar pelo consentimento `MCP.Access`; não usar o SP app-only como bearer delegado. | Não. Nenhum login/consentimento/conexão tentado. |

**Decisão de sequência:** A é o menor primeiro teste para validar a credencial do Service Principal existente sem criar outro perfil. Depois do token, uma consulta REST limitada é necessária para provar autorização e dados. B é uma alternativa já cadastrada, mas seu grupo atual (`pricing`) não atende o objetivo de custo/inventário e depende de execução MCP externa. C requer autenticação delegada e não reutiliza app-only no fluxo atual.

- Nenhum token, Secret, cookie, GUID completo, dado financeiro ou resposta do tenant foi registrado no relatório.
- Nenhuma query Azure, `tools/list`, `Testar Secret`, alteração de configuração ou permissão foi executada.
- O conteúdo anteriormente observado sobre ausência de MCP ativo deve ser lido como estado anterior ao startup; depois do comando, o relatório registra o novo estado da instância e a conexão MCP ainda não testada.
- **Concluído:** 2026-11-18 08:45 -03:00, horário consultado após a inspeção.

## Validação real do Service Principal e enumeração de subscriptions — 2026-11-18

### Operações realizadas pela UI normal

- A instância Tesseract já iniciada por solicitação explícita do usuário continuou em `http://127.0.0.1:4317`; não foi iniciada uma segunda instância.
- Na página **Acessos**, foi usado **Testar Secret** em um perfil de aplicação existente. Resultado apresentado pela aplicação: secret válido e token para Azure Resource Manager obtido no Entra ID em aproximadamente 1,5 s. O token não foi exibido nem registrado. Isso comprova aquisição de token naquele momento; não comprova RBAC sobre Cost Management.
- Em seguida, **Conectar aplicação** vinculou esse perfil à sessão local e informou token ARM válido. Essa ação não alterou o registro do perfil nem permissões Entra/Azure.
- Com a conexão ativa, a página **Custos** carregou a lista de subscriptions por chamada de leitura ARM. A lista não foi copiada para este relatório. Evidência limitada a autenticação e autorização para enumerar subscriptions.
- **Nenhuma consulta de custos, comparação, inventário, escrita ou operação administrativa foi executada.** Não foi iniciado MCP local nem chamado `tools/list`.

### Decisão de caminho

| Caminho | Estado atualizado | Próxima validação |
|---|---|---|
| Azure REST | **Primeiro caminho recomendado.** Secret validado e listagem real de subscriptions autorizada. A autorização de Cost Management permanece desconhecida. | Após o operador confirmar subscription ou Resource Group e período, executar consulta `ActualCost` somente leitura no escopo confirmado. A UI também dispara comparação com o período anterior depois da consulta; isso deve ser considerado parte do teste. |
| Azure MCP local | Perfil existente `azure-full` continua cadastrado com grupo `pricing`, sem sessão e sem tools descobertas. Grupo pricing não é consulta de custos realizados. | Não é a primeira fatia para FinOps real. Qualquer descoberta exigiria iniciar o processo local configurado e revisar seus schemas antes de uso. |
| ARM MCP remoto | Não foi identificado perfil remoto salvo; o fluxo app-only existente não é compatível com a política atual do preset ARM. | Não usar este caminho sem fluxo delegado e decisão humana sobre `MCP.Access`. |

### Escopo ainda necessário

A aplicação seleciona automaticamente a primeira subscription listada como valor inicial do filtro. Esse padrão de UI **não equivale à confirmação do operador** e não foi usado para executar uma query. Para a primeira consulta real, o operador precisa informar/confirmar:

1. Subscription desejada (nome ou identificador parcial reconhecível na própria UI; não é necessário compartilhar GUID completo).
2. Resource Group, se a consulta deve ser limitada a um; caso contrário, confirmar escopo da subscription inteira.
3. Período de datas. Sugestão operacional para evitar mês incompleto: último mês civil completo, se esse for o período que o operador deseja analisar.

A consulta será somente leitura, em `ActualCost`; o resultado de comparação do período anterior também será solicitado automaticamente pela interface. Até confirmação explícita do escopo e período, **não executar consulta**.

### Limites de evidência e segurança

- A enumeração de subscriptions demonstra que o token tem acesso para essa operação ARM. Não prova acesso à API Cost Management, completude dos custos, nem permissões para outras subscriptions ou grupos.
- A UI mostrou nomes corporativos de subscriptions; eles foram omitidos do relatório para reduzir exposição desnecessária.
- Startup da instância executou recuperação/regravação do histórico MCP conforme documentado acima. O histórico não foi inspecionado diretamente; transições específicas permanecem desconhecidas.
- Nenhum segredo, token, cookie ou GUID completo foi incluído. Não houve alteração de credenciais, conexões, políticas ou permissões.
- Sem alterações de código nesta continuação; a suíte completa não foi repetida. `git diff --check` será registrado abaixo somente após a verificação final.

### Estado para decisão

**PARCIALMENTE PRONTO; primeira consulta FinOps bloqueada por confirmação do escopo e período.** A alternativa A (Azure REST) é agora a recomendação baseada em evidência real de token e enumeração ARM. Autorização de Cost Management permanece **DESCONHECIDA**, não uma falha confirmada.

- **Conclusão observada:** 2026-11-18 08:51 -03:00 (relógio consultado ao fechar a atualização).
- **Commit/PR/merge:** não realizados.

## Missão 16 — primeira consulta real de Cost Management (2026-11-18)

### Escopo e execução

- Identidade escolhida na UI: perfil de aplicação previamente cadastrado, Client Credentials. A sessão conectou normalmente e obteve token ARM válido; nenhum token/secret foi mostrado ou registrado.
- Canal confirmado: **APIs — capacidades → Operação Azure: Custos → Testar leitura API no escopo selecionado**. A implementação chama `api.queryCosts()` e `POST /api/costs/query`, que por sua vez usa `AzureCosts.queryCosts()`/`ArmHttp`. Esse caminho executa somente a consulta principal; não dispara a comparação automática de período anterior da página Custos.
- Subscription corporativa indicada pelo operador; identificador completo omitido. Resource group: todos da subscription.
- Período: 2026-10-01 00:00:00Z até 2026-11-01 00:00:00Z (limite exclusivo). Base `ActualCost` (UI: Real), granularidade diária (`Daily`) e agrupamento por serviço (`ServiceName`).
- A operação é somente leitura. A sessão local foi vinculada ao perfil existente para autenticação; não houve alteração persistida de recursos, permissões, credenciais, conexões ou configuração.

### Resultado observado

- Foram feitas **3 tentativas** da consulta autorizada, mantendo os mesmos filtros. Horários no log local: 09:04:56, 09:05:48 e 09:06:54 (America/Sao_Paulo), em 2026-11-18.
- Nas três tentativas, `GET /subscriptions` retornou HTTP 200; o endpoint de Azure Cost Management `.../providers/Microsoft.CostManagement/query` respondeu HTTP 429. A rota local `POST /api/costs/query` retornou `throttled`/429.
- O Tesseract registrou os tempos de espera recebidos do Azure: 26 s, 34 s e 28 s. Após esperar o intervalo indicado, uma nova tentativa ainda recebeu 429; a execução foi encerrada sem insistência adicional.
- **Autenticação:** comprovada para obtenção do token e chamadas ARM de enumeração. **Autorização de Cost Management:** não determinada, pois a resposta 429 impediu obter uma resposta de dados ou um 403 conclusivo.
- **Dados:** nenhum conjunto financeiro foi retornado. Quantidade de registros, presença/ausência de custos, moeda e total são **não determinados**; não equivalem a consulta bem-sucedida com zero registros.
- **Paginação/truncamento:** não avaliáveis sem resposta 200. O código da integração limita paginação a 50 páginas e marcaria resultado parcial ao atingir o limite, mas essa garantia não foi exercitada por esta chamada.
- A interface mostrou o erro sanitizado de limitação HTTP 429. Não houve valores financeiros a validar visualmente.

### Proveniência e privacidade

- Proveniência verificável no log operacional da sessão: três eventos locais `POST /api/costs/query` com `throttled`/429; para cada um, a chamada ARM ao endpoint de query Cost Management retornou 429, precedida por `GET /subscriptions` 200. Os eventos trazem correlação por request ID; os identificadores completos e a subscription ID foram omitidos deste relatório versionável.
- A interface informa que tokens e secrets não são registrados nos logs. Nenhum corpo bruto de erro, token, secret, nome de outro escopo ou dado financeiro corporativo foi copiado para este relatório.
- O código envia `type: ActualCost`, período customizado, granularidade `Daily`, agregação `Cost`/`Sum` e agrupamento `ServiceName`, contra API `2026-06-01`; confirmação da implementação é evidência do request esperado, enquanto o log comprova o endpoint e status observados.

### Parecer de prontidão

**Primeira consulta financeira real: BLOQUEADA por throttling Azure (429). MVP FinOps com dados reais: ainda não validado.** A identidade e o escopo são reconhecidos para chamadas ARM de enumeração, mas não foi obtida resposta Cost Management. O 429 não demonstra falha de Secret nem permite concluir falta de RBAC; não solicitar nem ampliar privilégios com base nele. Próximo passo é aguardar a janela de throttling e repetir apenas quando autorizado operacionalmente, mantendo escopo e período; se o endpoint então responder 403, registrar o erro sanitizado e solicitar ao responsável a revisão de RBAC/billing no escopo — sem alteração automática. Um resultado 200 ainda deve ser verificado quanto a moeda, total, linhas, paginação e consistência visual antes de declarar a fatia MVP pronta.

- **Conclusão observada:** 2026-11-18 09:07 -03:00 (horário local observado nos logs; sem alegar precisão de cronômetro da tarefa).
- **Código/configuração:** sem alterações nesta validação.
- **Commit/PR/merge:** não realizados.

## Resultado manual informado pelo operador e ajustes de UX — 2026-11-18

### Evidência manual fornecida

- O operador informou que o teste manual funcionou e forneceu capturas da tela. A captura mostra resultado com `source: Azure Cost Management Query API`, `basis: ActualCost` e `meta.status: complete`; também mostra moeda BRL em linhas visíveis. Nenhum valor monetário ou nome de serviço foi transcrito para este relatório.
- **Diferença de escopo temporal:** nas capturas, os filtros e `meta.period` mostram início `2026-09-01` e fim exclusivo `2026-11-01`, com `timeZone: America/Sao_Paulo`. Isso representa setembro e outubro no contexto da aplicação, não a janela solicitada anteriormente de 01/10/2026 a 01/11/2026 UTC. Assim, o screenshot comprova que houve um resultado de consulta real segundo o operador, mas não comprova a consulta exata limitada a outubro UTC.
- A captura mostra aviso de que dados de uso podem atrasar e ser revisados; `status: complete` descreve o processamento da resposta, não garante fechamento/finalidade da fatura.
- A quantidade total de linhas, paginação e total financeiro não foram verificados. Nenhum dado financeiro corporativo, token ou identificador completo foi copiado para o relatório versionável.
- As três tentativas anteriores registradas acima foram chamadas distintas e terminaram em HTTP 429. O resultado posterior é evidência documental da captura do operador, não uma reexecução independente nesta sessão.

### Ajustes de UX implementados nesta continuação

- Removido o bloco extenso de capacidades do topo da experiência; a tabela e o texto explicativo aparecem abaixo da ação de leitura e do resultado, em seção compacta com sinalização **Informação**.
- A ação **Testar leitura API no escopo selecionado** recebe estilo primário com contraste, borda, foco visível e estado de hover.
- O painel de resultado tem ação **Copiar**, com ícone, confirmação de sucesso/erro e escrita do JSON exibido na área de transferência.
- O painel de Diagnóstico oferece **Copiar visíveis** e **Exportar visíveis**. O arquivo segue `tesseract-AAAA-MM-DD_HH-mm-ss.log`; cópia/exportação respeita os filtros atuais e não envia dados para fora do computador.
- Alterações de código limitadas a `src/web/pages/ApiLab.tsx`, `src/web/pages/Diagnostics.tsx` e `src/web/styles.css`; nenhuma dependência foi adicionada. Nenhuma integração, política ou configuração Azure foi alterada.

### Validação desta continuação

- `prettier --write src/web/pages/ApiLab.tsx src/web/pages/Diagnostics.tsx`: executado; arquivos formatados.
- `git diff --check`: aprovado após as alterações.
- Build de produção: será registrado somente após observar o resultado do comando nesta continuação.
- Testes automatizados: não executados nesta continuação. As capturas são validação manual do operador para a consulta anterior, não validação dos novos controles de interface.
- **Prontidão funcional:** consulta real demonstrada em captura para setembro–outubro no timezone da aplicação; a janela outubro UTC exata, contagem/total, moeda global e paginação ainda não foram confirmados. Resultado da interface atual aguarda build para disponibilização no bundle servido.

- **Conclusão observada da atualização:** 2026-11-18 09:28 -03:00.
- **Commit/PR/merge:** não realizados.

### Atualização posterior — consulta completa informada pelo operador

- Uma segunda captura fornecida pelo operador mostra `source: Azure Cost Management Query API`, `basis: ActualCost` e `meta.status: complete`, com moeda BRL em linhas visíveis. O operador informa que a consulta funcionou. Isso atualiza a evidência anterior de 429, mas continua sendo uma captura enviada pelo operador, não nova execução independente pelo Codex. Valores monetários e identificadores completos não foram registrados.
- Na captura mais recente, o filtro mostra início `2026-10-01` e “Até (exclusivo)” `2026-10-31`; `meta.period` confirma `from: 2026-10-01` e `toExclusive: 2026-10-31`. Pelo contrato da integração, o request encerra em `toExclusive - 1 segundo`, logo essa janela inclui 01–30/10 e **não inclui 31/10**. O timezone da metadata é `America/Sao_Paulo`. Para cobrir o mês inteiro com o limite exclusivo, a data final precisa ser `2026-11-01`; isso não altera o escopo Azure.
- A resposta ainda carrega o aviso de atraso/revisão dos dados de uso. Número total de linhas, valor total e paginação não foram aferidos nas capturas.

### Bundle e processo local após a implementação de UX

- `npm run build`: **código de saída 0**. Next.js compilou, gerou as páginas estáticas e a compilação TypeScript terminou sem erro.
- A leitura local `GET http://127.0.0.1:4317/` respondeu HTTP 200. O processo já em execução manteve a CSP calculada no startup antigo; a comparação detectou dois scripts inline do HTML novo cujos hashes não constam nessa CSP. Assim, um reload no mesmo processo não é evidência suficiente para dizer que o bundle atualizado será carregado corretamente.
- Não reiniciei o processo: a inicialização executa recuperação/regravação do histórico MCP e os logs de diagnóstico ficam em memória do serviço. A reinicialização pode invalidar/reclassificar estados recuperados e apagaria o log em memória que a nova UX deve permitir copiar/exportar. O bundle novo está em `dist/web`, mas a UX requer reinício controlado do processo existente para alinhar a CSP. Não foi iniciada uma segunda instância.
- `git diff --check`: aprovado após as mudanças e relatório.
- Testes automatizados: não executados nesta continuação; nenhuma dependência adicionada.

**Estado atualizado:** a consulta real foi demonstrada em captura do operador e a UI foi implementada e compilada. O teste mais recente ainda exclui o dia 31/10 devido ao limite exclusivo; resultado de mês completo requer data final 01/11. A UX nova está compilada, mas aguarda reinício controlado do processo atual para garantir CSP compatível.

- **Atualização concluída:** 2026-11-18 09:33 -03:00.
- **Commit/PR/merge:** não realizados.

## Estabilização da experiência FinOps — validação local atual

### Escopo preservado

- Checkout inspecionado: `D:\DEV\FinOps\Tesseract-missao-16`, HEAD `facd3dfd794b1b9a2750f53280e763447ebe6ecd` (detached). Alterações locais preexistentes foram mantidas; o stash M13 e outros worktrees não foram tocados.
- O serviço operacional do checkout M16 permaneceu ativo na porta 4317 (PID 20584; `status.ps1` confirmou health HTTP). Não foi reiniciado nem acessado contra o histórico persistente. Nenhuma segunda instância operacional foi iniciada.
- O E2E usou serviço fixture isolado na porta 4318 e armazenamento temporário exclusivo criado por `scripts/playwright-server.ts`; não fez chamadas ao tenant nem utilizou credenciais.

### Evolução implementada

- A tela APIs organiza os parâmetros da consulta antes da ação principal: base e escopo vêm dos controles existentes; a tela acrescenta somente `ServiceName`/`ResourceId` e `Daily`/`Monthly`, que são os valores aceitos por `costQuerySchema`.
- O campo de data final agora é inclusivo para quem usa a tela. `ScopeFilters` converte o último dia escolhido para o `toExclusive` do contrato; testes cobrem outubro, virada de ano, ano bissexto e mudança do início do intervalo.
- Para Cost Management, a resposta padrão é visual: totais separados por moeda, série temporal agregada, detalhamento ordenável, quantidade de linhas, escopo, período, fonte, status e avisos. Agregações usam `Decimal`; resultado parcial é rotulado como subtotal. JSON permanece fechado em **Detalhes técnicos** e tem cópia explícita.
- A ação principal recebe estilo/foco de destaque e texto conforme Custos, Budgets ou Tags. O painel de capacidades foi mantido no final como informação discreta.
- Diagnósticos recebem sanitização comum no servidor e uma segunda sanitização antes de cópia/exportação. Foram cobertos Bearer/JWT, valores de `token`, `secret`, `password`, `cookie`, credenciais de URL e chaves correlatas. Exportação respeita eventos filtrados e nome `tesseract-AAAA-MM-DD_HH-mm-ss.log`.
- Playwright aceita `TESSERACT_E2E_PORT`, possibilitando iniciar o serviço fixture em porta distinta da instância operacional.

### Evidências atuais

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado após correção de importação nomeada de `Decimal` exigida por `tsconfig.server.json`.
- Testes direcionados de intervalo, agregação e diagnósticos: **3 arquivos, 6 testes aprovados**.
- `npm test`: uma execução feita em paralelo ao build teve **193/195 aprovados**, com dois timeouts dos testes de inicialização `tsx` no arquivo `tests/storage/data-directory-isolation.test.ts`. Sem concorrência, esse arquivo passou **7/7**; depois, a suíte integral isolada passou **64 arquivos, 195/195 testes**. Os limites de tempo não foram alterados.
- `TESSERACT_E2E_PORT=4318 npx playwright test tests/e2e/api-lab.spec.ts`: aprovado. A jornada confirmou outubro selecionado como 01–31/10 na tela e `toExclusive=2026-11-01` no request fixture; verificou filtros, totais sintéticos BRL/USD separados, JSON fechado, cópia técnica, cópia/exportação sanitizada, erro 429 e ausência de resultado zero após erro. A mesma execução verificou ausência de overflow da página em 390×844, 768×1024 e 1280×800.
- `TESSERACT_E2E_PORT=4318 npx playwright test`: **41/41 testes E2E passaram**, incluindo fixture MCP e regressões responsivas.
- `git diff --check`: aprovado no estado inspecionado; será repetido após o fechamento deste relatório.
- Não foi executado `npm audit` nesta etapa. Não houve nova consulta real Azure.

### Consulta real e pendências de operação

- A evidência de resultado real continua sendo a captura manual do operador descrita acima. Ela não comprova, por si só, o intervalo UTC completo de outubro: a captura mais recente mostrava `toExclusive=2026-10-31`, que exclui 31/10. Nenhuma chamada real foi repetida para evitar tráfego desnecessário e limites Azure. A consulta completa de outubro ainda precisa de confirmação na sessão autorizada após escolher data final inclusiva `31/10/2026` na nova UI (request interno até `01/11/2026`).
- A CSP e o bundle novos foram compilados, mas o processo ativo foi iniciado com política anterior e serve o conteúdo correspondente ao startup. O carregamento da atualização em `4317` continua sem comprovação.
- Não foi possível inspecionar ou exportar os eventos diagnósticos em memória nem verificar execuções MCP pendentes sem usar a sessão autenticada do navegador. Portanto, não se afirma que não existam execuções pendentes. Nenhuma retomada, recuperação ou limpeza foi feita.
- O limite de durabilidade permanece o já documentado: o build e E2E não demonstram persistência física contra perda de energia. A consulta fixture não valida autorização, RBAC, moeda, total, linha count ou paginação reais.

### Decisão atual

**UX e validação local: aprovadas. Ativação na instância operacional e publicação: pendentes.** Antes de reiniciar `4317`, o operador deve abrir Diagnóstico e copiar/exportar os eventos relevantes, verificar no Mapa de Conexões que não há execução pendente que exija ação, e autorizar o reinício controlado; o startup executa `McpOrchestration.init()` e pode reclassificar estados recuperados. Depois do reinício, confirmar CSP/bundle, validar visualmente a consulta completa de outubro uma vez e verificar total/moeda/linhas/paginação sem registrar valores corporativos no relatório versionável. Até essas verificações, não integrar à `main`.

- Resultados acima observados em 2026-11-18; tempo decorrido da sessão de implementação será informado na resposta final com base no relógio desta execução.
- Commit/PR/merge naquele ponto de registro: ainda não realizados.

## Publicação e CI — atualização observada em 2026-11-18

- A implementação foi registrada no commit `016a905451321d3e1a9a8332a86560e8206b7987` (`feat(finops): stabilize API cost query UX`) na branch `codex/missao-16-finops-ux`.
- PR [#16](https://github.com/poyato70/azure-cost-local/pull/16) foi aberta como draft. A execução CI `44312846911` terminou: `PowerShell / Windows` **aprovado**; `Quality / Linux` **falhou** no gate `npm audit --audit-level=high`, após typecheck, build e testes Linux passarem.
- O log do job Linux apontou cinco avisos de alta severidade transitivos na cadeia de desenvolvimento que inclui `picomatch` (`vitest → vite → tinyglobby → fdir`). O advisory [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) não lista versão corrigida; o pacote atualmente publicado consultado foi `picomatch` 4.0.7, também dentro do intervalo afetado descrito pelo advisory. A auditoria local também falha no mesmo gate. Não foi aplicado `npm audit fix --force`, não houve downgrade/alteração arbitrária de dependências e nenhum alerta foi suprimido.
- A falha de segurança impede aprovação dos checks obrigatórios. A PR permanece aberta em draft e **não foi mesclada**. Não se afirma que a CI esteja aprovada nem que a missão esteja pronta para integração. Reavaliar quando houver versão corrigida compatível ou correção upstream segura, mantendo o lockfile e as políticas do projeto íntegros.
- Não foram executados novos testes após o commit: esta atualização apenas reconcilia relatório e índice com resultados CI já observados. `git diff --check` passou para esta atualização documental.
- A validação do bundle na instância operacional e a confirmação da consulta real para todo o intervalo de outubro permanecem pendentes conforme a seção acima; nenhum restart nem nova chamada Azure foi feito.
- **Decisão desta atualização:** bloqueado para merge pela falha do gate Linux. PR #16 draft aberta; CI Windows aprovada; CI Linux falhou por advisory transitivo sem correção compatível identificada.

### Reexecução da CI após atualização documental

- No commit `f7747135c632f492bcfabb9aaeb60a6f92becad1`, a execução `44313750484` terminou em 2026-11-18: `PowerShell / Windows` aprovado, inclusive testes seriais, Playwright MCP e acessibilidade; `Quality / Linux` falhou novamente somente no gate de vulnerabilidades. Typecheck, build e testes unitários/MCP no Linux passaram.
- A PR #16 continua aberta em draft; os checks obrigatórios permanecem incompletos por causa do Linux. Nenhum merge foi feito.
- Tempo observado desde o início da validação desta rodada (09:51:31 -03:00) até esta atualização (10:30 -03:00): aproximadamente 38 minutos e 30 segundos. Inclui validação local, leitura/atualização documental e acompanhamento CI; não inclui trabalho anterior da missão.
