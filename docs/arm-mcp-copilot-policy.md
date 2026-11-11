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
