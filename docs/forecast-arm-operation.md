# Previsão de custos e ARM MCP oficial

## Dashboard e chat por API

A aba **Forecast** consulta a API oficial Azure Cost Management Forecast. Selecione acesso, subscription, RG opcional e período. **Mês atual** preenche um período útil para a previsão. O fim é exclusivo, como nos demais filtros. A opção de incluir realizados apresenta esses valores em uma coluna/total separado; nunca soma previsão e realizado como se fossem uma fatura. Moedas permanecem separadas.

Sem previsão disponível, a tela informa indisponibilidade, sem inventar zero. Falhas de permissão e retornos parciais devem ser examinados em **Diagnóstico**. Uma previsão depende de histórico, suporte do escopo e permissões efetivas; não garante a cobrança final.

O chat por APIs também dispõe de `azure_query`, operação `forecast`. Quando a pergunta não informa período, essa operação usa o mês atual. Evidência de previsão aparece separada da evidência de custos realizados.

Referência: [Forecast API 2025-03-01](https://learn.microsoft.com/en-us/rest/api/cost-management/forecast/usage?view=rest-cost-management-2025-03-01).

## Teste do ARM MCP com usuário

Este é o servidor remoto [Azure Resource Manager MCP](https://github.com/Azure/Azure-Resource-Manager-MCP), distinto do Azure MCP local utilizado para Pricing. O dashboard continua usando APIs diretas; selecionar MCP não converte automaticamente os cartões para chamadas MCP.

1. Atualize o navegador e reconecte o acesso, se a sessão tiver terminado após o reinício.
2. Em **MCPs**, crie uma conexão com serviço `arm`, transporte HTTP e autenticação de usuário/delegada. Vincule o acesso Entra autorizado.
3. Em **Recursos autorizados**, preencha `scope`: `/subscriptions/SEU-ID` ou `/subscriptions/SEU-ID/resourceGroups/SEU-RG`. Não é necessário inserir Secret.
4. Salve e clique **Autorizar recurso**. Conclua o login Microsoft no popup. O token para esse recurso é separado do token das APIs do dashboard.
5. Clique **Testar / descobrir**. A lista mostra as tools efetivamente retornadas pelo servidor. Descoberta comprova comunicação e catálogo; uma chamada de dados ainda pode falhar por RBAC, escopo, histórico ou configuração.
6. Revise e aprove apenas as leituras necessárias. Escolha a tool no formulário gerado a partir do schema e use o mesmo `scope` cadastrado. Execute e confira retorno e diagnóstico.
7. No chat, selecione essa conexão e o mesmo escopo nos filtros. A aplicação rejeita divergências de subscription/RG antes de enviar uma consulta.

O serviço fixa `https://mcp.management.azure.com`, audience `api://22bfbae3-f4e7-485f-be43-8cee15065084`, permissão delegada `MCP.Access` e header `x-mcp-toolset: CostManagement`. A descoberta pública do servidor confirmou esse recurso. O aplicativo Entra precisa estar autorizado e permitir o fluxo de login usado pela aplicação. Não alteramos registro Entra nem RBAC automaticamente.

Leituras elegíveis nesta versão: `query_costs`, `forecast_costs`, `list_budgets`, `get_budget` e `list_dimensions`, quando presentes no catálogo e aprovadas pelo usuário. Ferramentas de escrita são bloqueadas. Argumentos que redirecionem escopo/destino ou tragam comandos/consultas arbitrárias são recusados. A aprovação está vinculada ao schema retornado.

Retornos genéricos ARM podem limitar linhas: não trate uma soma de linhas truncadas como total financeiro completo. A aplicação acrescenta esse aviso e preserva o retorno como evidência, sem alimentar automaticamente os cartões. Consulte o [catálogo Cost Management](https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/CostManagementAndPricingTools.md) e as [orientações para outros clientes](https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/OtherClientSupport.md).

## Identidade de aplicação com Secret: avaliação de MCP local

É viável criar um MCP local próprio reutilizando os serviços existentes de custos, Forecast, budgets e benefícios. Nesta entrega há análise e preparação; esse servidor próprio ainda não foi implementado.

Desenho recomendado para a próxima etapa:

- Processo local `stdio`, usando o SDK MCP já instalado. Canal separado dos logs: stdout apenas para o protocolo, stderr para diagnóstico seguro.
- Tools específicas de leitura: consultar custos, consultar previsão, listar budgets e consultar benefícios disponíveis. Schemas com escopo, período e base de custo; nenhum endpoint ou comando livre.
- Seleção explícita de um acesso salvo por identificador local. O serviço resolve a identidade e o Secret no cofre DPAPI; Secret/token nunca entram em argumentos, prompts, respostas ou configuração global do Copilot.
- Reutilizar provedor de identidade de aplicação e serviços de domínio, com validação de escopo/RBAC, cancelamento, limites de paginação, totais por moeda e evidência de origem. Extrair dependências hoje vinculadas à sessão web para um contexto local explícito; não reutilizar cookies do navegador.
- Credencial obtida não comprova acesso financeiro. Validar cada tool com uma leitura real no escopo autorizado. Usar permissões mínimas compatíveis com as APIs consultadas.
- Se futuramente houver transporte HTTP ou hospedagem, acrescentar autenticação de entrada, isolamento entre usuários e proteção do armazenamento; a credencial Azure de saída não autentica quem chama o MCP.

O preset ARM remoto desta entrega aceita somente usuário/delegação. Não se presume suporte app-only por Client Secret. A opção Secret das APIs diretas continua independente desse preset.

## Evidência e limites desta entrega

Em 04/11/2026, sem credenciais: descoberta `/.well-known/oauth-protected-resource` retornou HTTP 200 com `MCP.Access`; inicialização anônima retornou 401, conforme desafio de autenticação. Um servidor HTTP de teste verificou inicialização, catálogo, chamada, header e validação de escopo. Isso não comprova consulta autenticada à Azure.

O usuário informou que o aplicativo já está autorizado e pode concluir o popup. Login ARM, catálogo real autenticado, Forecast real e conciliação de valores com o portal ainda precisam dessa validação. Não foram simulados como sucesso.
