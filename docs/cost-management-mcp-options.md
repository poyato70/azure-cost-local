# Cost Management: API direta, ARM MCP oficial ou MCP próprio

Verificado em 04/11/2026. Esta nota corrige o alcance da análise anterior, que se concentrou em Azure MCP Server (`@azure/mcp`) e seus presets locais. A configuração pricing atual não é um conector de gasto real. Não se deve concluir, a partir disso, que a Microsoft não tenha outro MCP com Cost Management.

## Descoberta confirmada

Existe o projeto oficial separado [Azure Resource Manager MCP](https://github.com/Azure/Azure-Resource-Manager-MCP). Sua documentação descreve endpoint remoto `https://mcp.management.azure.com`, consulta `query_costs` e toolset opcional `CostManagement`, habilitado por header `x-mcp-toolset: CostManagement`. Esse toolset inclui previsão, budgets e análises de benefícios. Fonte: [Cost Management & Pricing tools](https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/CostManagementAndPricingTools.md).

O README identifica preview e clientes Copilot Chat/CLI. Há guia para outros clientes com registro Entra, permissão delegada e login; um Secret nesse exemplo é credencial do cliente OAuth e não prova client_credentials/app-only. Não presumir que o perfil aplicação com Secret atual funcione nesse endpoint. Fontes: [README](https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/README.md), [Other client support](https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/OtherClientSupport.md).

O documento do toolset registra limites de linhas e diferenças de escopo entre operações. Ao integrar, devemos conferir schemas reais, truncamento, agregações, suporte por contrato e contexto de tenant. Não assumir que uma resposta limitada represente o total financeiro. O servidor também oferece escrita; nossa aplicação deverá liberar apenas leituras revisadas, não criar budgets/deployments automaticamente.

## Melhor alternativa para a aplicação atual — recomendação técnica

| Caminho | Quando faz sentido | Trabalho necessário |
|---|---|---|
| APIs diretas | Dashboard atual, identidade de aplicação e controle dos dados | Preservar serviços existentes; implementar Forecast separadamente, pois ainda não foi entregue |
| ARM MCP oficial | Testar conversa com Cost Management no Copilot e validar o fluxo delegado suportado | Novo preset, autenticação/audience corretas, header do toolset, allowlist de leitura e adapters para resultados; não basta trocar a URL |
| MCP próprio local | Expor os mesmos serviços financeiros a clientes MCP, especialmente com identidade de aplicação e regras próprias | Servidor MCP com schemas de negócio, autenticação explícita, autorização, diagnósticos e tratamento financeiro; reutilizar o núcleo existente |

Para o dashboard, manteria as APIs diretas como base. Se o requisito for padronizar o acesso MCP sem login de usuário, recomendo avaliar um MCP local próprio sobre esses serviços. Para Copilot com usuário, faria primeiro uma prova de conceito do ARM MCP oficial antes de reconstruir capacidades já oferecidas.

## É possível criar um MCP próprio?

Sim. O MCP seria uma interface sobre as APIs e regras do serviço, não uma nova fonte financeira. MVP proposto: `query_costs`, `forecast_costs`, `list_budgets`, `get_budget` e leituras de benefícios conforme o contrato. Começar com stdio local e operações de leitura; HTTP remoto exige autenticação de entrada própria, separada dos tokens usados para chamar Azure.

Os serviços de custos/budgets/benefícios, identidades salvas, controle de escopo e cálculos já implementados podem ser reutilizados. Forecast precisará de implementação e testes próprios. Nem Client ID/Secret nem MCP concedem permissões: o principal ativo precisa dos acessos Azure adequados por operação/escopo. A criação desse servidor não foi autorizada como implementação nesta pergunta e não foi realizada.

Referências de APIs: [Query](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage), [Forecast](https://learn.microsoft.com/en-us/rest/api/cost-management/forecast/usage?view=rest-cost-management-2026-06-01), [Budgets / Microsoft.Consumption](https://learn.microsoft.com/en-us/rest/api/consumption/budgets/list?view=rest-consumption-2024-08-01). Fatura/documentos de cobrança não devem ser tratados como sinônimos dos agregados de uso; definir separadamente quais operações de billing serão necessárias.

## Estado da aplicação

O ARM MCP oficial ainda não está integrado aos presets, à autenticação ou aos cartões desta aplicação. O Azure MCP local em pricing continua sendo usado apenas para preços. Esta análise não executou consulta real nem concedeu permissões no tenant. A pequena correção de UI solicitada foi entregue: o resultado de Testar Secret agora aparece abaixo dos botões do acesso, como a confirmação de conexão.
