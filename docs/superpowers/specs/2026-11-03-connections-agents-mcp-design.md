# Conexões salvas, identidade de aplicação e agentes locais

Data: 03/11/2026. Estado: desenho aprovado pelo usuário em 03/11/2026; implementação desta ampliação ainda não iniciada.

## Objetivo e escolhas confirmadas

Ampliar o dashboard existente para suportar APIs e MCP, acessos persistentes com Tenant ID/Client ID e Secret Value opcional, autenticação por identidade de aplicação, agentes configurados pela própria interface e área de conexões Azure/ADX/Foundry/Fabric/Power BI. O usuário escolheu execução do agente no serviço local, preservando futura migração para Foundry. O serviço continua exclusivo do notebook, em loopback; mantém login Microsoft por popup e Copilot local.

Seis requisitos rastreados: R1 escolha API/MCP; R2 identidade de aplicação com Secret; R3 acessos nomeados salvos; R4 cadastro do Client ID e Secret Value associado a um Tenant ID; R5 seletor Copilot local/Agente cadastrado; R6 área de conexões dos cinco serviços Microsoft. Secret Value não é Secret ID. Cadastro de aplicativo não cria um registro Entra nem concede permissões automaticamente.

## Abordagens e decisão

1. Agente definido e executado no serviço local, acessando modelo remoto e ferramentas autorizadas. Escolhida pelo usuário. Configurações, sessões e execução ficam sob controle da aplicação.
2. Interface criando agentes gerenciados no Foundry. Considerada e reservada para evolução; exigiria recursos e permissões adicionais no Azure.

Chamadas de modelo continuam remotas; execução local não significa modelo offline. O agente cadastrado terá runtime independente do Copilot CLI, evitando que as duas opções sejam apenas rótulos do mesmo agente.

## Estado atual e compatibilidade

React/Vite + Fastify/TypeScript, MSAL Node 7.1.2 e Copilot SDK 1.0.28. Sessões/identificadores atualmente em memória, APIs de custos/budgets/benefícios diretas e chat com ferramenta azure_query. Preservar cálculos decimais, moedas separadas, períodos explícitos, cancelamento, proteção Host/Origin/CSRF, popup OAuth e validações de nonce/state/PKCE/tenant.

Não haverá reescrita do dashboard. Introduzir interfaces IdentityProvider, SecretStore, DataProvider, McpConnection e AgentRuntime; adaptar contratos atuais para incluir connectionId, credentialVersion e origem efetiva. Cache e execução devem separar identidade, sessão, tenant, conexão, fonte e escopo. A aprovação anterior de somente leitura continua válida para ferramentas de negócio; cadastrar conexões e agentes é operação local de configuração autorizada.

Incluir configurationVersion por acesso, conexão e agente. Alterar modelo, endpoint, instruções, ferramentas, recursos permitidos ou vínculos invalida as execuções antigas, além da rotação de segredo. Capturar versões no início e revalidá-las antes de executar ferramenta, emitir resposta ou preencher cache; resposta tardia de configuração antiga não pode reaparecer.

## Acessos salvos e autenticação

Área Acessos com listar/criar/editar/testar/ativar/excluir. Campos: nome, Tenant ID, Client ID, modo de autenticação, Secret Value quando aplicável, data de expiração opcional e estado do último teste.

- Modo usuário: salvar identificadores; conectar via popup oficial. Tokens de usuário permanecem em memória; reinício exige login novamente.
- Modo aplicação: Tenant ID + Client ID + Secret Value, MSAL ConfidentialClientApplication e client credentials. Botão Conectar autentica sem usuário Microsoft; token renovado em memória. Funções RBAC e permissões do serviço continuam obrigatórias.
- O mesmo cadastro pode conter identificadores de uso pessoal e Secret opcional, mas cada ativação escolhe explicitamente um modo; não trocar usuário por aplicação automaticamente. Um cliente público já existente pode precisar de registro/configuração apropriada para client credentials; adicionar texto no campo Secret não concede essa capacidade.
- Permitir salvar rascunho sem Secret, mas desabilitar conectar em modo aplicação até fornecê-lo. Expiração declarada é metadado do usuário; autenticação determina validade efetiva.
- Secret é recebido uma vez, armazenado protegido e retornado somente como secretConfigured=true e versão; nunca devolver valor ou máscara derivada. Campo vazio ao editar preserva o segredo; ação separada remove/substitui. Rotação invalida tokens, cache e execuções da identidade anterior.
- Sessão local com cookie opaco e CSRF continua obrigatória também para aplicação. Selecionar/conectar acesso é ação explícita; não conectar automaticamente ao abrir uma página. Sair limpa sessão/tokens/conversas, preservando cadastros salvos.

## Persistência e proteção no Windows

Metadados e segredos em %LOCALAPPDATA%/AzureCostLocal/config, fora do repositório e OneDrive. Esquema versionado, gravação atômica e serializada, ACL restrita ao usuário. Metadados JSON contêm apenas referências opacas a segredos; SecretStore usa DPAPI CurrentUser. Nunca salvar Secret em .env, localStorage, URL, log, argumentos de processo, exportação ou histórico do chat.

O serviço acessa DPAPI sob o mesmo usuário Windows; falha de descriptografia é erro explícito, sem fallback em texto puro. Integração Windows por helper restrito/nativo; se usar PowerShell, transportar dados por stdin, não por argumentos ou arquivo temporário. Não ler credenciais de navegadores, caches privados ou outros aplicativos. DPAPI protege os dados persistidos; não isola contra processos já executados como o mesmo usuário Windows.

Excluir cadastro remove o segredo se não referenciado, bloqueando exclusão de acesso em uso por outra conexão/agente até remover o vínculo ou confirmar substituição. Arquivo corrompido não pode apagar todos os acessos; manter o original e apresentar recuperação. Testar reinício do serviço e associação ao usuário Windows.

## Escolha API ou MCP

Fonte explícita por fluxo: API direta ou uma conexão MCP cadastrada. Exibir conexão, identidade, endpoint/servidor e ferramenta/API que produziu cada resultado. Sem fallback silencioso. Uma capacidade ausente no MCP retorna indisponível e oferece ao usuário selecionar API.

O Microsoft Azure MCP Server não deve ser apresentado como equivalente automático ao Cost Management Query. Custos reais continuam entregues por API quando o servidor não expuser ferramenta equivalente comprovada. Descobrir ferramentas durante teste de conexão e registrar matriz de capacidades; somente adapters com equivalência de escopo, moeda, período e semântica podem alimentar cartões normalizados do dashboard. Resultados MCP genéricos aparecem no painel/chat como resultados da conexão, com fonte própria; não convertê-los artificialmente em gastos reais.

MCP e API são acessados exclusivamente pelo serviço. Seleção MCP implica chamada MCP real (initialize, tools/list, tools/call); uma chamada REST interna não será rotulada como MCP.

## Área Servidores MCP

Cada cadastro contém nome, serviço/preset, transporte, URL ou executor local predefinido, acesso salvo ou OAuth específico, recurso de destino (audience/scope), contexto de serviço e ferramentas permitidas. Ações: salvar, testar, conectar/desconectar, descobrir ferramentas e selecionar ferramentas de leitura. Status separar cadastrado, autenticado, conectado, testado e indisponível.

Presets:

| Serviço | Conexão proposta | Contexto |
|---|---|---|
| Azure | Azure MCP local stdio oficial; HTTP apontando para instância explicitamente configurada pelo usuário | tenant/subscription e namespaces permitidos |
| Azure Data Explorer | Namespace Kusto do Azure MCP, em conexão específica | cluster URI e database; ferramentas KQL de consulta |
| Microsoft Foundry | HTTP https://mcp.ai.azure.com | conta/projeto/recurso, conforme ferramenta |
| Microsoft Fabric | HTTP https://api.fabric.microsoft.com/v1/mcp/core; opção Fabric MCP local oficial | workspace/item e permissões suportadas |
| Power BI | HTTP https://api.fabric.microsoft.com/v1/mcp/powerbi | workspace/modelo semântico; licença, tenant setting e Build permission quando exigidos |

O identificador io.github.com.microsoft/azure e a URL GitHub são referências de catálogo/código, não endpoints HTTP de execução. Azure MCP HTTP requer URL da instância; não hospedar/deployar automaticamente. A documentação Power BI atual recomenda Fabric IQ para consumo semântico; preservar o endpoint Power BI pedido, com indicação de preview e documentação para futura opção Fabric IQ.

Autenticação é por conexão, não global: tokens ARM, ADX, Foundry e Fabric têm destinatários e permissões diferentes. MCP remoto pode exigir login OAuth delegado mesmo quando custos usam aplicação+Secret. Mostrar apenas métodos documentados/testados pelo preset e não assumir client credentials universal. No caso de aplicação sem suporte no servidor remoto escolhido, informar incompatibilidade; não reutilizar bearer ARM nem enviar Secret ao endpoint MCP.

A matriz serviço/transporte × autenticação de usuário/aplicação é parte da entrega e da interface: cada combinação terá disponível, pendente de validação ou não suportado, com motivo/fonte e data do teste. Mostrar incompatibilidade antes de solicitar credenciais. Autenticação sem login humano é aceite obrigatório dos adapters que suportam aplicação; a presença de um formulário Secret não conta como suporte comprovado.

Para MCP local oficial, processo filho por conexão, versão fixada e sem shell de comandos arbitrários cadastrável pela interface. Credenciais, quando necessárias, em ambiente mínimo do processo filho; stdout exclusivo do protocolo, stderr sanitizado, sem log de ambiente. Encerrar subprocesso ao desconectar/rotacionar/excluir. Integração de usuário deve ter mecanismo documentado para a identidade selecionada; não herdar silenciosamente o login Azure CLI de outra conta. Se transporte/autenticação não puderem ser vinculados com segurança ao acesso selecionado, declarar capacidade indisponível.

HTTP aceita HTTPS por padrão; HTTP somente loopback explicitamente cadastrado. Instâncias privadas corporativas exigem endpoint cadastrado e aprovado localmente. Bloquear redirects com credenciais, metadados de nuvem, credenciais embutidas em URL e resolução para destinos fora do host cadastrado. Descoberta OAuth/MCP pode indicar outro host: mostrar a autoridade e exigir vínculo autorizado antes de enviar tokens; audience validado por conexão. Não aceitar URL de ferramenta fornecida pelo modelo.

## Agentes cadastrados e chat

Área Agentes: criar/editar/duplicar/testar/ativar/excluir. Cadastro: nome, descrição, instruções, provedor de modelo, endpoint, deployment/modelo, credencial do modelo, acessos de dados permitidos, conexões MCP autorizadas, ferramentas de leitura e limites. Testar modelo e testar dados são operações separadas.

Provedor inicial proposto: Azure OpenAI/Foundry com endpoint Azure compatível com Chat Completions v1 e tool calling. Configurar base URL/deployment e autenticação por chave de inferência ou acesso Entra salvo, quando suportado. Chave de inferência e Client Secret são credenciais diferentes, com formulários/tipos próprios. Não cadastrar agente somente com Client ID + Secret e presumir que já existe um modelo. O servidor usa chamadas diretas ao endpoint de modelo; o Secret Azure não entra no prompt.

Aplicar ao endpoint de inferência a mesma política de destinos do MCP: HTTPS, host explicitamente cadastrado e vinculado à credencial, audience correto e bloqueio de redirects com credenciais. Não aceitar URL indicada pelo modelo. Testes devem comprovar que endpoint estranho, redirecionamento ou troca de host não recebem chave/token.

Runtime local independente implementa conversa → seleção de ferramenta → validação pelo serviço → execução API/MCP → resultado → resposta. Somente ferramentas vinculadas ao agente; instruções e schema não concedem permissões. Runtime substituível permitirá futura implementação Foundry gerenciada sem alterar serviços de custos.

Seletor principal do chat: Copilot local ou Agente cadastrado; no segundo, escolher agente salvo. Exibir identidade e conexões ativas. Trocar agente, acesso, fonte ou escopo encerra a execução e limpa contexto financeiro, sem misturar resultados. Copilot conserva configuração restrita e recebe apenas as ferramentas de negócio autorizadas; MCPs são mediados pelo serviço, sem herdar todos os servidores/configurações do notebook.

Limites iniciais: até dez chamadas de ferramenta por pergunta, dois minutos de execução e 8.000 caracteres na resposta; parametrização pode reduzir esses limites, não aumentá-los nesta versão. Limitar contexto e resultado por ferramenta; não enviar tabelas completas desnecessariamente. Tokens de saída limitados no modelo quando suportado. Dados e nomes retornados por ferramenta são conteúdo não confiável, não instruções. Nenhum agente pode escolher identidade, credencial ou endpoint fora dos vínculos definidos pela aplicação.

Configurações persistem; tokens, resultados financeiros e conversas ficam em memória. Explicar envio de dados ao provedor selecionado antes de ativar chat, para Copilot e agente cadastrado. Testes de inferência geram consumo do provedor, identificado ao usuário. Não criar deployment, recurso Foundry ou compras automaticamente.

## Operações permitidas

Esta ampliação é de consulta e configuração local. Não habilitar automaticamente ferramentas de criação, atualização, execução de código, deploy, exclusão ou alteração de permissões só porque foram descobertas. readOnlyHint é indício, não autorização suficiente: usar catálogo/allowlist revisado para ferramentas Microsoft conhecidas, schemas e restrições de recursos. Ferramentas desconhecidas podem ser listadas, mas ficam desabilitadas. KQL/DAX deve ser de consulta e restrito ao cluster/database/modelo cadastrado; não liberar comandos de gerenciamento.

Adapters específicos validam comandos e referências a outros clusters, bancos e modelos, inclusive funções/construções que podem ampliar o escopo. Não confiar apenas em prefixo textual ou no prompt. Recusar construções não suportadas pela política em vez de executá-las e presumir isolamento; testar referências cruzadas, comandos de gerenciamento e funções de acesso externo. RBAC do serviço complementa essas validações.

## Estrutura de interfaces

- Acessos: acessos salvos, modo usuário/aplicação, formulário Secret Value e teste com diagnóstico seguro.
- Servidores MCP: cinco presets, contexto por serviço, autenticação compatível, status e ferramentas.
- Agentes: configuração local do modelo, instruções, conexões e limites.
- Dashboard: seletor de acesso e fonte, preservando áreas Custos/Compromissos/Budgets.
- Chat: seletor Copilot local/Agente cadastrado e identificação das fontes usadas.

Layout segue a interface existente, em português. Estados vazios/falta de credencial/erro de permissão/servidor sem capacidade devem ser distintos. Não mostrar sucesso financeiro somente porque autenticação ocorreu. Identificadores podem ser visíveis; segredos retornam apenas estado configurado e ação substituir/remover.

## Aceites e verificações

1. Salvar/editar/excluir acessos; reiniciar e recuperá-los. Testar DPAPI no Windows real com valor sintético, sem imprimir o segredo. Confirmar ausência em repositório, respostas GET, logs e exportações.
2. Login usuário por popup continua válido com nonce/state/PKCE. Aplicação+Secret obtém token sem popup de usuário e consulta somente escopos autorizados; erro de Secret/tenant/permissão tem diagnóstico sanitizado.
3. Rotação, exclusão, troca de fonte/identidade e logout cancelam operações e invalidam caches/tokens correspondentes.
4. API e MCP executam caminhos diferentes comprovados por fixtures instrumentadas e uma conexão real autorizada; ausência de equivalência não faz fallback silencioso.
5. Cada preset faz teste initialize/tools/list; uma ferramenta permitida deve executar para marcar consulta validada. Recursos/licenças ausentes ficam pendentes, sem conexão simulada aceita como real.
6. Agente local salva modelo/instruções/credenciais/vínculos; uma pergunta percorre o runtime e ferramenta real autorizada. Modelos sem tool calling geram erro de capacidade. Copilot continua funcionando separadamente.
7. Tentar escrita, comando arbitrário, endpoint estranho, tenant não vinculado e prompt injection não amplia permissões nem expõe credenciais. Preservar proteção de loopback/CSRF.
8. Testar interface real no navegador e os dois modos de login; separar testes sintéticos, revisão visual e aceites de serviços reais.
9. Regressões de custos, moedas, budgets e nonce continuam passando. Sem endpoints/modelos/credenciais do usuário, construir e testar isoladamente, mas registrar cada integração como pendente.

## Entrega, evolução e limites

Executar incrementalmente: acessos/SecretStore → identidade de aplicação → cliente MCP e presets → runtime de agente → interface integrada → aceites reais. Essas etapas pertencem à mesma ampliação e têm contratos compartilhados; a ordem será detalhada no plano após aprovação.

Migração futura: substituir armazenamento local por cofre corporativo, sessões por identidade multiusuário, runtime de agente por Foundry e apresentação por Teams/servidor. Exportar metadados sem segredos poderá ser evolução; nenhuma publicação/hospedagem ou mudança de identidade corporativa agora.

## Fontes oficiais conferidas

- https://github.com/microsoft/mcp/blob/main/docs/Authentication.md
- https://github.com/mcp/com.microsoft/azure
- https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/tools/azure-data-explorer
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow
- https://learn.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection
- https://learn.microsoft.com/en-us/rest/api/fabric/articles/mcp-servers/core-remote/get-started-core
- https://github.com/microsoft/mcp/blob/main/servers/Fabric.Mcp.Server/README.md
- https://learn.microsoft.com/pt-br/power-bi/developer/mcp/remote-mcp-server-get-started
- https://learn.microsoft.com/en-us/azure/foundry/mcp/get-started
- https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/model-context-protocol?pivots=python
- https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/chat?view=rest-microsoft-foundry-v1

Fontes descrevem contratos/capacidades; compatibilidade de cada conta, modelo e servidor será validada na implementação. Este documento não declara conexões já implementadas ou aprovadas em produção.

## Revisão de construtibilidade

Revisão independente concluída em 03/11/2026, sem impedimento arquitetural. Incorporadas quatro correções: proteção do endpoint de inferência, validação de referências externas KQL/DAX, configurationVersion para invalidar execuções e matriz de autenticação verificável. Todas devem receber testes negativos no plano de implementação.
