# Tesseract 2.0 — MCP Workspace

Workspace local para conectar, inspecionar e executar servidores MCP, com capacidades FinOps multicloud, Azure, agentes e conhecimento mantidos no produto existente. Esta consolidação preserva os recursos do `azure-cost-local` 0.5.2 enquanto atualiza a instalação e a operação das Missões 04 e 05.

## Instalação e operação (Windows / PowerShell)

Requisitos: Node.js LTS com npm e Git para atualização automática. O app escuta somente em `127.0.0.1`; a porta padrão é 4317.

```powershell
git clone https://github.com/poyato70/azure-cost-local.git
cd azure-cost-local
.\install.ps1
.\start.ps1
.\status.ps1
.\stop.ps1
```

`install.ps1` usa `npm ci` e compila o app. `start.ps1` inicia o processo Node separado do terminal, confirma `/api/health` e mostra o PID. `status.ps1` verifica a identidade do processo registrado e o health check. `stop.ps1` só encerra o PID se ele corresponder ao servidor deste checkout. `update.ps1` aceita somente branch `main` limpa e atualização fast-forward; instala e compila numa worktree temporária antes de atualizar o checkout. O PID de operação compartilhado fica em `%LOCALAPPDATA%\AzureCostLocal\service.pid`; rode uma instalação por usuário/checkout por vez para evitar conflito nesse marcador.

Alternativa manual: `npm ci`, `npm run build`, `npm start`. `PORT` pode ser configurada no ambiente; seu padrão é `4317`. `AZURE_TENANT_ID` e `AZURE_CLIENT_ID` são opcionais para iniciar o workspace e habilitar conectores Azure. Consulte [.env.example](.env.example).

## MCP Inspector

O aplicativo inicia sem servidores MCP cadastrados e sem instalar MCPs externos. Abra **Conexões → MCPs → Integração** para adicionar um servidor HTTP Streamable ou stdio. MCPs individuais são conectados sob demanda e falhas de um servidor são apresentadas como erros daquela integração.

Em **Conexões → MCPs → Análise**, selecione um perfil e liste capabilities, tools, prompts e resources. A tela mostra schemas e metadados, oferece argumentos de prompt, formulários derivados do schema das tools, retorno e diagnóstico. A execução de tools exige que cada operação seja explicitamente revisada/aprovada na conexão. O retorno do servidor continua sendo dado externo não confiável.

Presets guiam o cadastro, mas não provam permissões nem instalam software de terceiros. HTTP usa a autenticação configurada para aquele servidor; Bearer próprio é guardado no cofre local e não é enviado a outros hosts. stdio restringe executáveis e parâmetros por política do servidor. Parâmetros read-only são uma classificação conservadora da aplicação, não garantia semântica de que a operação não altere dados.

## Dados e segurança

Configuração operacional fica no diretório local do usuário; `.env`, dados e logs locais não são publicados. Revise JSON exportado e remova valores sensíveis antes de compartilhar. Diagnóstico evita registrar credenciais; respostas MCP podem conter informação de negócio. O servidor local usa sessão e validação de origem/CSRF para rotas de gerenciamento. Não exponha a porta na rede sem controles próprios.

Não use credenciais reais em testes. Acesso Azure requer identidade e permissões apropriadas. Descobrir uma tool não demonstra acesso aos dados nem autorização no provedor.

## Produto FinOps

O workspace mantém os fluxos existentes de custos, compromissos, previsão, budgets, FinOps Hub, chat, agentes, conhecimento e conectores multicloud. A disponibilidade de cada provedor depende de configuração e credenciais; dados de custos reais não são inventados. Veja [guia de MCP e diagnóstico](docs/mcp-usability-diagnostics.md), [operação do workspace](docs/workspace-v0.5.md), [política ARM MCP e Copilot](docs/arm-mcp-copilot-policy.md) e [guia multicloud](docs/multicloud-guide.md).

Licenças e atribuições de terceiros permanecem nos arquivos de licença e documentação correspondentes. Histórico detalhado de versões continua disponível nos documentos vinculados abaixo.

**Versão 0.5.1:** correções de exclusão, identidade/transporte explícitos, separação Integração/Análise e busca online no MCP Registry. [Guia e teste de aceite](docs/mcp-clarity-v0.5.1.md).

**Versão 0.5.0:** workspace local orientado a conexões, exploração/teste de tools, agentes e conhecimento versionado. MCPs HTTP Kubernetes/OpenShift e personalizados usam Bearer próprio protegido ou nenhuma autenticação no endpoint, sem exigir acesso Azure. Skills/referências Markdown públicas do GitHub podem ser importadas por commit e vinculadas ao runtime local. Análises financeiras e Chat Azure/Copilot preservados.

[Operação e limites 0.5](docs/workspace-v0.5.md) · [Checklist de aceite 0.5](docs/checklist-v0.5.0.md) · [Versão visual anterior](docs/command-center-v0.4.md).

**Versão 0.3.0:** identidade própria, navegação por tarefas e **Visão multicloud** com Azure, AWS Cost Explorer, GCP Cloud Billing/BigQuery e alocação Kubernetes/OpenShift via OpenCost. Resultados em gráfico, tabela e JSON; moedas/bases e alocação são separadas para evitar dupla contagem. [Configuração, pré-requisitos e limites](docs/multicloud-guide.md).

```powershell
npm ci
npm run build
npm start
```

Abra http://localhost:4317. Comece pelo cadastro e exploração de MCPs; conexões independentes não exigem acesso Azure. Para serviços Microsoft, configure os identificadores Entra e a identidade compatível com o conector. Senha e MFA são informados somente à Microsoft.

[Migração Windows e Copilot](docs/migration-windows.md) · [Conexões e validação](docs/connections-validation.md) · [Configuração e operação](docs/setup.md) · [Capacidades de benefícios](docs/benefits-capabilities.md) · [Validação](docs/validation.md).

O modo normal usa APIs reais. Sem login, nenhuma despesa é inventada. Integração Azure e conciliação com o portal ainda dependem da conta do usuário.

[Análise de viabilidade: FinOps Toolkit e Awesome Copilot](docs/finops-toolkit-awesome-copilot-feasibility.md). Proposta de evolução, sem integração instalada.

[Analista FinOps e consulta Hub: uso e limites](docs/finops-hub-guide.md). Inclui comparação informativa com Cost Management e benefícios conforme datasets disponíveis.

[MCP: formulário de tools, busca de subscriptions e diagnóstico](docs/mcp-usability-diagnostics.md).

[Cost Management: ARM MCP oficial, APIs e opção de MCP próprio](docs/cost-management-mcp-options.md) — análise de 04/11/2026.

[Forecast e ARM MCP: operação e limites](docs/forecast-arm-operation.md). Previsão oficial separada do realizado; preset ARM delegado preparado para login e teste de leitura. Inclui avaliação de MCP local com identidade de aplicação.

[Checklist de testes e aceite](docs/checklist-testes.md) — instalação, autenticação, dados financeiros, MCPs, chat, Hub, segurança e migração Windows.

[Identidade visual TESSERACT](docs/tesseract-identity.md) — paleta, símbolo, critérios visuais e limites.

[Teste preliminar de 06/11/2026](docs/teste-preliminar-2026-11-06.md) — evidências relatadas, dúvidas e prioridades ainda pendentes.

[Roteiro de apresentação e correções do teste preliminar](docs/apresentacao-tesseract.md). Inclui limites atuais, operação e uso dos provedores.
