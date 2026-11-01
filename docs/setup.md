# Executar no notebook

## Início

Requer Node.js 24 e npm. No diretório do projeto:

```powershell
npm ci
npm run build
npm start
```

Abra http://localhost:4317. Ctrl+C encerra o serviço. `scripts/start.ps1` oferece início em segundo plano e abre o navegador; `scripts/stop.ps1` encerra somente o processo criado por esse script. Não exponha a porta na rede. Não há dados fictícios na execução normal.

## Microsoft Entra

Use um registro de aplicativo que você esteja autorizado a configurar:

1. Para o MVP, aplicativo público de desktop/mobile, com redirect URI `http://localhost:4317/api/auth/callback`. Não use plataforma Web confidencial que exija Client Secret. Fluxo authorization code com PKCE.
2. Configure permissão delegada de Azure Service Management `user_impersonation`, conforme as políticas de consentimento do tenant. Autentique com uma conta com acesso às subscriptions. MFA ocorre na página Microsoft.
3. Digite Tenant ID e Application (Client) ID na tela. São identificadores, não credenciais secretas. Ficam na memória desta execução. Opcionalmente configure variáveis de ambiente `AZURE_TENANT_ID` e `AZURE_CLIENT_ID` antes de iniciar; a aplicação não lê arquivos de credenciais.
4. Clique Entrar com Microsoft. O login abre em uma janela separada; permita pop-ups para localhost. O dashboard permanece aberto, acompanha o resultado e se atualiza automaticamente. A janela de conclusão tenta fechar sozinha; se o navegador impedir, use Fechar janela. Depois escolha subscription e, se desejado, resource group. Contas pessoais precisam ter acesso ao tenant/subscription correspondente, inclusive como convidadas quando aplicável.
5. Leitura de custos normalmente requer Cost Management Reader no escopo. Inventário e recomendações podem exigir permissões de Reader e de billing específicas do contrato. A aplicação não concede permissões.

Se o tenant bloquear consentimento ou registro público, o administrador deve autorizar a configuração adequada. Client ID isolado não concede acesso. Não informe senha, segredo ou token no chat nem salve esses dados neste diretório OneDrive.

Se o retorno de login falhar, a aplicação volta ao dashboard e apresenta o código Microsoft/MSAL reconhecido, sem copiar a URL ou o código de autorização. Inicie uma nova tentativa pelo botão Entrar; não reutilize uma URL antiga de callback. AADSTS7000218 indica incompatibilidade de cliente confidencial/público: confira se o URI está cadastrado na plataforma de desktop/mobile, e não como Web confidencial. Não adicione um Client Secret como contorno para este MVP público. Outros códigos devem ser diagnosticados pela mensagem específica.

Porta configurável por `PORT`; atualize o redirect URI do aplicativo e use `http://localhost:<porta>`. O serviço escuta somente 127.0.0.1, usando localhost como origem canônica. A tela mostra callback padrão 4317; em porta personalizada, siga esta configuração.

## Copilot

O Copilot CLI é uma instalação separada do chat de VS Code. Abra `copilot` no terminal e efetue o login GitHub pelo fluxo oficial, caso necessário. A assinatura e as políticas corporativas precisam permitir os modelos e o uso via SDK.

Na tela Chat, selecione o escopo, marque o consentimento de envio de contexto e consulte “Verificar Copilot”. O serviço usa a instalação do PATH e o diretório padrão `~/.copilot`, sem copiar ou ler manualmente credenciais. `COPILOT_CLI_PATH` permite selecionar o caminho absoluto de outra instalação autorizada.

O SDK opera no modo empty, sem descoberta de configuração, memória ou ferramentas built-in/MCP. Antes de cada pergunta, o catálogo efetivo precisa conter somente `azure_query`; caso contrário, a consulta é recusada. Sem shell, arquivos ou alterações no Azure. Até dez consultas por pergunta, dois minutos e resposta de até 8.000 caracteres. Cada pergunta cria sessão efêmera e tenta excluí-la após uso. Logs internos do CLI/GitHub seguem suas políticas; sair limpa os dados controlados pela aplicação, sem promessa de apagar registros remotos.

Valores, nomes e contexto necessários podem ser enviados ao GitHub Copilot, mesmo que a interface seja local. O dashboard funciona independentemente do chat. Perguntas referem-se ao escopo selecionado; troque o filtro antes de perguntar sobre outro RG. O chat não mantém histórico contextual entre perguntas nesta versão, embora a conversa da tela fique visível até trocar filtros/sair.

## Custos e limites

- “Dois últimos meses”: dois meses civis completos anteriores, America/Sao_Paulo. Datas de API representam dias de faturamento Azure, sem deslocar uso para fuso local. Fim exibido na seleção é exclusivo.
- Comparação: período civil anterior equivalente quando os limites são inícios de mês; nos demais casos, mesma quantidade de dias.
- Moedas nunca são somadas nem convertidas automaticamente. Gráficos são indicativos; totais usam aritmética decimal.
- Budgets usam currentSpend do próprio orçamento e seus filtros. Ausência de currentSpend permanece indisponível.
- Benefícios existentes representam custos amortizados atribuídos ao escopo no mês completo anterior, não inventário de todos os pedidos da conta.
- Cenários são recomendações oficiais. Sem série horária/preços contratuais, simulação independente detalhada não é entregue. Métricas ausentes não são presumidas.
- Cache de consultas em memória por cinco minutos; sair invalida sessão e cache. Nenhum dado financeiro é persistido pela aplicação.
- Apenas Azure público é implementado neste MVP. Teams, SharePoint, multiusuário e hospedagem são evolução futura.

## Desenvolvimento e testes

`npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. Os e2e usam Microsoft Edge instalado. As respostas financeiras dos testes são simuladas explicitamente; elas nunca são inseridas na execução normal. Para alterar a interface, refaça o build e reinicie o serviço. `npm run dev` acompanha alterações de backend, depois de um build da interface.

Fontes: [MSAL Node](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests), [Cost Management](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage), [Copilot SDK](https://github.com/github/copilot-sdk).
