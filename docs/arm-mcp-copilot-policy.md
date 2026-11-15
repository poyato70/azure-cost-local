# ARM MCP: conexão, catálogo e política Copilot

Verificação de 10/11/2026. O [repositório público do ARM MCP](https://github.com/Azure/Azure-Resource-Manager-MCP) documenta a conexão Streamable HTTP em `https://mcp.management.azure.com`. Não foi localizado um manifesto público de descoberta nem `managed-settings.json` nesse repositório. As buscas `com.microsoft/arm`, `azure-resource-manager` e `mcp.management.azure.com` no Registry oficial não retornaram entradas; isso não comprova ausência em todos os catálogos.

| Finalidade | Configuração |
| --- | --- |
| Conectar o servidor | Use o endpoint HTTP. No Tesseract, selecione o preset ARM, login de usuário e escopo autorizado. |
| Habilitar tools adicionais de custos | A [configuração oficial](https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/CostManagementAndPricingTools.md) documenta o header `x-mcp-toolset: CostManagement`. |
| Descoberta por registro | O administrador indica a [URL-base de um Registry compatível](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-mcp-registry) que publique a entrada. O endpoint do ARM MCP não é uma URL-base documentada de Registry. |
| Permissão direta no Copilot | O administrador edita sua própria [política gerenciada](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-enterprise-allowlist), em cliente compatível. |

Exemplo do fragmento para uma política gerenciada que já use allowlist:

```json
{
  "allowedMcpServers": [
    { "serverUrl": "https://mcp.management.azure.com" }
  ]
}
```

Acrescente a entrada à lista existente. Substituir a lista inteira pode bloquear outros servidores. A política não cadastra o MCP no cliente, não fornece credenciais e não concede permissões Azure. Outras restrições empresariais continuam aplicáveis. Nenhuma política corporativa foi alterada.

## AADSTS650052 durante o login do ARM MCP

Esse erro do Microsoft Entra indica que o tenant não tem o recurso solicitado habilitado/provisionado ou não encontra o service principal correspondente. Ele não indica senha errada, não prova falta de RBAC na subscription e não é corrigido trocando silenciosamente para outra conta ou tenant.

O administrador do tenant deve conferir o service principal da aplicação de recurso indicada no diagnóstico, se o serviço está disponível para a organização e se o aplicativo cliente tem a permissão delegada `MCP.Access` e o consentimento exigido pela política corporativa. A configuração do ARM MCP para clientes OAuth próprios documenta registro do aplicativo cliente e permissão delegada [neste guia oficial Microsoft](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-resource-manager-mcp-other-clients). Os IDs do recurso e da permissão podem depender da versão publicada; confira o guia e a origem oficial antes de configurar.

Compartilhe com o suporte somente Tenant ID, nome/Application ID do recurso, código AADSTS, Correlation ID e Trace ID mostrados na mensagem. Nunca envie access tokens, refresh tokens, códigos OAuth ou URLs de callback. O Tesseract apenas explica os dados devolvidos pelo Entra; não cria service principals, concede consentimento administrativo nem altera políticas corporativas. Depois da autenticação, o acesso aos recursos Azure continua dependendo de RBAC e do escopo escolhido.
