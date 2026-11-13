# Tesseract 2.0 — Marco 1

Workspace local para registrar servidores MCP Streamable HTTP e stdio, descobrir ferramentas, inspecionar schemas e executar operações classificadas como read-only. O registry e a trilha de atividade ficam em `data/registry.json`; essa pasta é ignorada pelo Git.

## Executar

Requer Node.js 20+.

```powershell
npm install
npm run build
npm start
```

Abra <http://127.0.0.1:4317>. Para desenvolvimento: `npm run dev` (a interface precisa de `npm run build` após alterações visuais).

## Segurança e limites

- O servidor escuta somente em loopback.
- Endpoints MCP exigem HTTPS; HTTP só é aceito para `localhost` e `127.0.0.1`.
- O Tesseract não coleta nem armazena segredos. O transporte stdio herda variáveis de ambiente do usuário; use autenticação local interativa, como Azure CLI. Não passe tokens em argumentos de comando.
- A classificação read-only usa palavras no nome da ferramenta. MCP não define se uma ferramenta é semanticamente somente leitura; revisar antes de executar. Operações que parecem mutáveis são bloqueadas localmente.
- Estado do binding, descoberta e execuções são gravados localmente com escrita atômica. Dados locais podem conter endpoints e evidências; não adicione `data/` ao Git.
- Presets disponíveis: Azure MCP local (`npx -y @azure/mcp@latest server start`), Azure Resource Manager (`https://mcp.management.azure.com`), Microsoft Foundry (`https://mcp.ai.azure.com`) e Microsoft Learn (`https://learn.microsoft.com/api/mcp`). Presets são configurações; conexão e autenticação só ficam validadas após descoberta bem-sucedida.
- Azure Advisor é acessado pelas ferramentas do Azure MCP, não como servidor separado.

## Evidência

As respostas de descoberta e execução mostram endpoint, método MCP e instante observado. O log local registra operação, binding, instante e resultado sem guardar argumentos nem payload de resposta.
