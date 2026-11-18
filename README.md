# Tesseract 2.1 — candidato de avaliação (RC)

> Estado: candidato RC em revisão, ainda sem aprovação, tag ou GitHub Release. O advisory transitivo `GHSA-fc5q-39xc-vjpf` foi retirado pelo GitHub em 18/11/2026 e a auditoria local atual não reporta vulnerabilidades; CI remota, instalação corporativa e validação de proxy ainda são necessárias antes de uma release estável.

## Instalação do Tesseract 2.1 no Windows

### Pré-requisitos

- Windows 64 bits e PowerShell autorizado pela política local.
- Node.js 22.21 ou superior na linha 22, ou 24.6 ou superior na linha 24, com npm 9+.
- Git para clonar e para usar `update.ps1`.
- Acesso ao registry npm já aprovado/configurado pela organização. Proxy e certificados devem ser provisionados pela infraestrutura; os scripts não os alteram.
- Espaço para dependências, build e perfil local. Nenhuma permissão administrativa é requerida quando essas condições e políticas já permitem a instalação.

A faixa de Node inclui suporte do runtime às variáveis de proxy padrão usado pelo serviço. Não use Node fora das versões LTS aprovadas pela empresa.

### Clone, diagnóstico e instalação

```powershell
git clone https://github.com/poyato70/azure-cost-local.git
Set-Location azure-cost-local
.\preflight.ps1 -Port 4317 -ExportReport
.\install.ps1 -Port 4317
```

`preflight.ps1` verifica versões, execução básica de Node, políticas PowerShell, TLS, registry npm, conectividade sem autenticação, capacidade de escrita no checkout, espaço, porta e presença (sem leitura de conteúdo) do diretório de dados. O suporte de proxy do Node cobre clientes baseados no `fetch`/HTTP global; alguns conectores HTTP/MCP usam transporte próprio com DNS fixado para proteção SSRF e não são roteados pelo proxy nesta edição. Valide cada caminho na rede corporativa antes da implantação. O relatório sanitizado pode ser encaminhado à infraestrutura. O preflight comum faz requisições `HEAD` sem credenciais ao registry npm configurado, endpoints públicos de login/ARM Azure e MCP Registry opcional. Para diagnóstico local sem testar endpoints Azure: `.\preflight.ps1 -Port 4317 -SkipAzureEndpointChecks`. Isso não é um modo de instalação aprovado.

`install.ps1` executa o preflight, verifica se há serviço deste checkout ativo, instala exatamente o lockfile via `npm ci`, compila e confirma artefatos e carregamento do componente nativo. O instalador não instala servidores MCP, não solicita credenciais e não modifica proxy, TLS, ExecutionPolicy nem permissões. `-SkipAzureEndpointChecks` pode ser passado somente em avaliação isolada que exige ausência de requisições Azure, por exemplo `.\install.ps1 -Port 4317 -SkipAzureEndpointChecks`.

Se scripts estiverem bloqueados por política corporativa, ou a instalação de um componente nativo for impedida, pare e encaminhe o diagnóstico à equipe responsável. Não aplique `ExecutionPolicy Bypass`, não desative validação TLS e não instale certificados sem aprovação corporativa.

### Iniciar, verificar e parar

```powershell
.\start.ps1 -Port 4317 -StartupTimeoutSeconds 60
.\status.ps1 -Port 4317
.\stop.ps1 -Port 4317
```

Abra <http://127.0.0.1:4317>. O servidor vincula somente ao loopback. Use a mesma porta nos três comandos. Se a porta estiver ocupada, escolha outra entre 1024 e 65535. O start compila por padrão; `-SkipBuild` usa artefatos previamente compilados. O serviço não exige MCP externo cadastrado para iniciar.

PID/metadados e logs ficam em `%LOCALAPPDATA%\AzureCostLocal\instances\<identificador-do-checkout>\`. Logs rotacionam a partir de 5 MiB. Não compartilhe logs ou respostas que contenham dados corporativos sem revisão.

### Atualização

`update.ps1` requer clone Git na branch `main` sem alterações locais. Ele recusa atualizar se encontrar um processo Node que esteja usando o entrypoint deste checkout, busca `origin/main`, aceita apenas fast-forward, valida instalação/build numa worktree temporária, atualiza, reinstala o lockfile e recompila. Não migra nem exporta segredos, sessões ou dados operacionais. Faça backup conforme os procedimentos corporativos antes da atualização; atualização entre versões e reversão operacional ainda devem ser aprovadas no ambiente de avaliação.

### Configuração Azure e MCPs

A inicialização não requer acesso Azure. Para consultar Azure, cadastre ou selecione uma identidade pela interface autenticada e conceda somente as permissões de leitura exigidas pela operação e pelo escopo. A autenticação delegada e Service Principal têm requisitos diferentes. Um perfil cadastrado não prova autorização. Credenciais protegidas pelo DPAPI CurrentUser pertencem ao usuário/estação e não são portáveis por cópia para outro computador ou conta.

MCPs são opcionais, configurados separadamente e iniciados sob demanda conforme transporte/política. Não são baixados automaticamente. Avalie cada endpoint, executável, schema e operação com a segurança corporativa antes de cadastrar ou executar.

### Logs e troubleshooting

- Falha de pré-flight: exporte o `tesseract-preflight-*.txt` e encaminhe à infraestrutura. O texto não contém endpoint completo, caminho pessoal, token ou certificado.
- Falha de build/start: consulte `service.err.log` e `service.out.log` no diretório acima; sanitize antes de compartilhar.
- Porta ocupada: use outra porta ou peça à equipe para identificar o processo; Tesseract não encerra processo alheio.
- Registry/proxy/TLS: confirme com a equipe os valores oficiais de proxy, `NO_PROXY`, CA corporativa e registry. O pré-flight não envia Authorization ao destino e não deve ser usado para validar autenticação corporativa.
- Processo ativo sem health: `status.ps1` preserva o processo. Revise logs antes de parar.
- Para recuperação, pare o serviço normalmente e siga o procedimento aprovado pela organização para preservar `%LOCALAPPDATA%\AzureCostLocal`; não apague histórico ou backup para tentar resolver falha.

## MCP Inspector

O aplicativo inicia sem servidores MCP cadastrados e sem instalar MCPs externos. Abra **Conexões → MCPs → Integração** para adicionar um servidor HTTP Streamable ou stdio. MCPs individuais são conectados sob demanda e falhas de um servidor são apresentadas como erros daquela integração.

Em **Conexões → MCPs → Análise**, selecione um perfil e liste capabilities, tools, prompts e resources. A tela mostra schemas e metadados, oferece argumentos de prompt, formulários derivados do schema das tools, retorno e diagnóstico. A execução de tools exige que cada operação seja explicitamente revisada/aprovada na conexão. O retorno do servidor continua sendo dado externo não confiável.

Se o Microsoft Entra retornar `AADSTS650052` ao autorizar o ARM MCP, confira a mensagem diagnóstica e peça ao administrador do tenant para verificar o service principal do recurso, sua disponibilidade e o consentimento/permissão delegada `MCP.Access`. Isso não concede RBAC às subscriptions; nenhuma identidade, tenant ou política é trocada automaticamente. Veja [guia ARM MCP](docs/arm-mcp-copilot-policy.md).

Presets guiam o cadastro, mas não provam permissões nem instalam software de terceiros. HTTP usa a autenticação configurada para aquele servidor; Bearer próprio é guardado no cofre local e não é enviado a outros hosts. stdio restringe executáveis e parâmetros por política do servidor. Parâmetros read-only são uma classificação conservadora da aplicação, não garantia semântica de que a operação não altere dados.

## Dados e segurança

Configuração operacional fica no diretório local do usuário; `.env`, dados e logs locais não são publicados. Revise JSON exportado e remova valores sensíveis antes de compartilhar. Diagnóstico evita registrar credenciais; respostas MCP podem conter informação de negócio. O servidor local usa sessão e validação de origem/CSRF para rotas de gerenciamento. Não exponha a porta na rede sem controles próprios.

Não use credenciais reais em testes. Acesso Azure requer identidade e permissões apropriadas. Descobrir uma tool não demonstra acesso aos dados nem autorização no provedor. No Azure OpenAI Usage, forneça um Resource ID completo ou uma URL HTTPS do `portal.azure.com` aberta em uma página de recurso que o Tesseract reconheça; outras URLs do portal ou de hosts externos não são parseadas. O período é UTC e o fim é exclusivo.

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
