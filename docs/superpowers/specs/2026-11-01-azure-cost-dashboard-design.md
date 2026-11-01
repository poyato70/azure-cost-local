# Dashboard Azure com chat — desenho do MVP

Data: 01/11/2026. Estado: aprovado pelo usuário em 01/11/2026; MVP implementado; validação Azure real pendente.

## Objetivo e decisões do usuário

Aplicação web individual, acessada somente pelo navegador do notebook, com serviço local. Exibir custos reais do Azure, analisar Reservations e Savings Plans, consultar budgets por subscription ou resource group e responder perguntas pelo GitHub Copilot local. A conta Microsoft do usuário autoriza as consultas. Evolução desejada: autenticação corporativa, Copilot corporativo, hospedagem e bot no Teams. O nome da pasta existente não define o nome ou contexto do produto.

## Abordagens consideradas

1. Web com serviço local: dashboard e chat integrados, consultas e cálculos compartilhados. Exige processo local ativo. Escolhida pelo usuário.
2. Dashboard e chat separados no Copilot: menor integração inicial, mas não atende à conversa dentro da aplicação. Descartada na conversa.

## Propostas técnicas do implementador

TypeScript, React com Vite na interface, Node.js com Fastify no serviço, MSAL Node para autenticação e GitHub Copilot SDK para o chat. Fixar versões compatíveis no plano. Em execução normal, interface e API terão a mesma origem, limitadas a loopback. React facilita evoluir para interface no Teams; serviços de domínio independentes permitem trocar autenticação e canal de chat.

Sem banco obrigatório: consultas com cache em memória de cinco minutos, separado por identidade, tenant, escopo, período, moeda e tipo de custo. Reiniciar ou sair elimina dados e conversas em memória controlados pela aplicação. O CLI/SDK pode manter histórico ou logs próprios: configurar e verificar sua persistência antes de prometer eliminação fora da aplicação. Preferências não sensíveis podem persistir. Não armazenar tokens, segredos ou relatórios no workspace sincronizado pelo OneDrive.

## Autenticação e autorização

Botão Entrar com Microsoft abre o navegador no fluxo oficial, com MFA. Proposta: cliente público local registrado no Entra, MSAL e authorization code com PKCE, callback loopback. O Application (Client) ID identifica o aplicativo desde o MVP; não é um segredo e não substitui o login pessoal. Tenant e Client ID serão configuração explícita. Validar redirect URI e permissões delegadas de Azure Resource Manager na preparação. Sem coletar senha, sem Client Secret e sem copiar credenciais de outros aplicativos.

Tokens e cache MSAL em memória no serviço; sessão opaca HttpOnly/SameSite no navegador, state/nonce/PKCE no login, proteção de origem/CSRF em operações de sessão e chat, validação de Host e API não exposta à LAN. APIs Azure e GitHub são chamadas remotas: executar no notebook não significa processamento offline. O chat envia a GitHub Copilot os trechos de dados de custo necessários; explicar isso antes de ativá-lo.

Selecionar um tenant por sessão. Listar subscriptions acessíveis, depois resource groups. Autorização efetiva é a do usuário e do escopo selecionado. Falta de permissão deve aparecer como indisponibilidade, nunca como custo zero. Cost Management Reader é ponto de partida para leitura de custos; inventário, benefícios e billing podem exigir permissões adicionais, conforme contrato. Não conceder funções automaticamente.

O login GitHub ocorre separadamente pelo Copilot CLI oficial; o SDK utiliza esse login. Validar instalação, versão, assinatura e políticas antes de habilitar o chat. Dashboard funciona mesmo com chat indisponível. Nenhuma chave OpenAI é requisito.

## Componentes e dados

Navegador → serviço local → adaptadores de identidade, custos, budgets, benefícios e chat.

- Custos: Azure Cost Management Query API, ActualCost e AmortizedCost.
- Budgets: Microsoft.Consumption/budgets, no escopo selecionado.
- Reservations: recomendações de compra, detalhes de recomendação e dados de utilização/benefício disponíveis para o contrato e escopo.
- Savings Plans: Cost Management benefitRecommendations e dados de benefícios/utilização quando autorizados.
- Preços: Azure Retail Prices, somente como referência pública para simulações.
- Azure MCP Server: adaptador complementar opcional de Pricing/Advisor/Optimization. Não é requisito para entregar custos reais; não instalar ou expor seu catálogo completo por padrão.
- Foundry MCP Server: sem dependência no MVP.

Contratos de domínio: CostQuery, CostResult, BudgetStatus e BenefitAnalysis. Todo resultado inclui escopo, intervalo explícito, tipo de custo, moeda, fonte, horário de consulta e estado completo/parcial/indisponível. Adaptadores preservam paginação, limitações e campos ausentes. Respeitar Retry-After, limitar retentativas e oferecer nova tentativa manual. Cancelar consultas obsoletas ao trocar filtros.

## Dashboard

Interface em português, com seleção de tenant/subscription/resource group e período. Quatro áreas: Custos, Compromissos, Budgets e Chat.

Custos: total, comparação com período anterior equivalente, série diária/mensal e tabela por serviço ou recurso. Alternância entre real e amortizado, com explicação da diferença. Não somar moedas diferentes; exibir grupos separados. Comparação percentual com base zero fica sem percentual. Valores do período aberto são provisórios e podem ser atualizados pelo Azure; horário de consulta não significa fechamento do faturamento.

Budgets: valor configurado, período, consumo, percentual e limites de alerta existentes. Respeitar filtros e base do budget; não comparar um budget filtrado ao total de outro escopo. Sem budget retorna “Nenhum orçamento configurado”, sem criar um. Previsão apenas quando houver fonte ou método explícito e identificado.

Compromissos: duas visões, “Benefícios existentes” e “Simular contratação”. Mostrar prazo de 1/3 anos, escopo, compromisso, cobertura, utilização e economia somente quando fornecidos ou calculáveis a partir de dados adequados. Comparações de pagamento e disponibilidade dependem do produto/contrato. Não combinar economias de Reservations e Savings Plans como se fossem aditivas sobre o mesmo consumo.

Recomendações oficiais são a primeira fonte para cenários. Simulações adicionais devem declarar período-base, consumo elegível, referência de preço, hipótese de estabilidade e compromisso ocioso. Aplicar modelo horário quando necessário; totais mensais sozinhos não comprovam economia de Savings Plans. Se faltarem dados, exibir recomendação disponível e “Simulação detalhada indisponível”, sem inventar retorno. Desconto retail não equivale ao desconto contratual. Sem compra, alteração de infraestrutura ou modificação de budget.

## Chat e ferramentas

Copilot interpreta perguntas e chama ferramentas próprias, tipadas e somente de leitura: consultar custos, comparar períodos, consultar budgets e analisar benefícios. O serviço valida parâmetros e escopos em cada chamada; cálculos monetários usam precisão decimal. Dashboard e chat usam os mesmos serviços.

Não disponibilizar shell, arquivos, navegação arbitrária nem ferramentas padrão de escrita do agente. Verificar como restringir o catálogo do SDK; se a restrição não puder ser comprovada, manter o chat desativado até corrigir. Limitar chamadas por pergunta, tempo e tamanho de resposta; credenciais nunca entram no contexto do modelo. Nomes e dados retornados por ferramentas são dados, não instruções.

“Dois últimos meses” significa, por padrão declarado, os dois meses civis completos anteriores no fuso America/Sao_Paulo; mostrar as datas antes/junto ao resultado e permitir mudar para janela móvel. Em 01/11/2026, setembro e outubro de 2026. Normalizar limites para a semântica de datas da API e verificar inclusão/exclusão para evitar perder dias. Usar RG selecionado; sem seleção, ou com nome ambíguo entre subscriptions, perguntar. A resposta mostra meses separados, total, moeda, variação quando aplicável, base real/amortizada e fonte. Sem dados verificados, não retornar valores estimados como gastos reais.

## Evolução corporativa

Preservar serviços de consulta e trocar adaptadores. Hospedagem exigirá sessões e caches por usuário, configuração Entra corporativa e escolha entre acesso delegado e identidade de aplicação. Client ID isolado não concede acesso. Modelo de autenticação Copilot corporativo dependerá do ambiente, licença e políticas; não pressupor reaproveitamento da sessão local no servidor.

Teams utilizará um adaptador de canal para os mesmos serviços e autorização do solicitante. SharePoint pode apresentar a interface via integração apropriada; o serviço Node precisa de hospedagem própria. Bot e SharePoint ficam fora da implementação do MVP.

## Critérios de aceite e validação

1. Login real, MFA quando exigido, seleção de escopo e saída com invalidação da sessão/cache.
2. Consulta de dois meses completos de um RG: totais do painel e chat iguais à resposta da API e conferidos no portal com mesmos filtros/base/moeda; registrar horário, pois dados podem mudar.
3. Testes significativos de limites de datas, valores decimais, múltiplas moedas, comparação com base zero, cache por identidade e escopo, autorização das ferramentas e budget filtrado.
4. Budgets em subscription e RG: distinguir resultado vazio, falta de permissão e erro.
5. Reservations/Savings Plans: entrega mínima inclui consulta de recomendações oficiais e análise dos benefícios existentes autorizados; validar uma análise com dados reais e documentar lacunas do contrato. Simulação horária própria depende de dados adequados e não é condição de aceite quando indisponíveis; a limitação deve aparecer na interface. Distinguir observação real, recomendação oficial e simulação.
6. Chat funcional com Copilot CLI/SDK e nenhuma ferramenta de shell/arquivo/escrita exposta.
7. Validar login, filtros, gráficos, tabelas, carregamento, erros e chat no navegador; testes automatizados não substituem revisão visual.
8. Modo demonstrativo, se usado no desenvolvimento, sempre identificado e separado. Sem acesso Azure/Copilot, registrar integração pendente, nunca aceite real concluído.

## Pré-requisitos e limites de entrega

Antes da integração real: conta com acesso aos custos, tenant e registro de aplicativo autorizado, Copilot CLI autenticado e assinatura compatível. Não é necessário informar senha neste chat. Inspecionar dependências locais durante o plano, sem ler caches de credenciais. Modelo de contrato Azure e disponibilidade das APIs serão detectados na conexão; capacidades indisponíveis aparecem por área.

Documento aprovado pelo usuário em 01/11/2026. Próximas etapas: plano de implementação, verificação de pré-requisitos, construção e testes. Sem publicação, criação de registro Entra ou concessão de permissões automática nesta etapa. Pasta atual sem repositório Git identificado; documento salvo localmente, sem commit.

## Fontes oficiais verificadas em 01/11/2026

- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage
- https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/understand-cost-mgt-data
- https://learn.microsoft.com/en-us/rest/api/consumption/budgets
- https://learn.microsoft.com/en-us/rest/api/cost-management/benefit-recommendations/list
- https://github.com/github/copilot-sdk
- https://github.com/github/copilot-sdk/blob/main/docs/auth/authenticate.md
- https://github.com/microsoft/mcp/tree/main/tools/Azure.Mcp.Tools.Optimization

As fontes sustentam os componentes; a stack, o cache e as escolhas de interface são propostas de projeto. Suporte ponta a ponta da conta do usuário ainda não foi testado.

## Revisão do desenho

Revisão independente de construtibilidade concluída em 01/11/2026: sem lacunas bloqueantes para planejar. Incorporadas correções sobre a entrega mínima de Compromissos e o alcance da limpeza de conversas controladas pela aplicação.


