# Tesseract 2.0 — Marco 1

Workspace local para registrar servidores MCP Streamable HTTP, descobrir tools, inspecionar schemas e executar operações classificadas como read-only. O registry e a trilha de atividade ficam em `data/registry.json`; essa pasta é ignorada pelo Git.

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
- Não há entrada nem persistência de credenciais no marco 1. Autenticação MCP e armazenamento seguro ficam pendentes.
- A classificação read-only usa palavras no nome da ferramenta. MCP não define se uma ferramenta é semanticamente somente leitura; revisar antes de executar. Operações que parecem mutáveis são bloqueadas localmente.
- Estado do binding, descoberta e execuções são gravados localmente com escrita atômica. Dados locais podem conter endpoints e evidências; não adicione `data/` ao Git.
- Integrações Azure, Foundry, GitHub, Kubernetes e Power BI ainda não implementadas.

## Evidência

As respostas de descoberta e execução mostram endpoint, método MCP e instante observado. O log local registra operação, binding, instante e resultado sem guardar argumentos nem payload de resposta.
