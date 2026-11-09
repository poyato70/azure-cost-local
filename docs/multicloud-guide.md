# Tesseract 0.3 — consultas multicloud

## Uso

Abra **Visão multicloud**, escolha período (fim exclusivo) e marque as fontes desejadas. Cada fonte consulta de forma independente; uma falha não transforma seu custo em zero nem oculta resultados das demais. Cancelar interrompe as requisições locais; cancelamento remoto BigQuery é solicitado, mas trabalho já processado pode ser cobrado.

O resumo agrupa somente mesmo período, moeda, base e camada. AWS UnblendedCost, Azure ActualCost e GCP NetCostIncludingCredits são bases diferentes: não há total geral que finja equivalência. OpenCost fica na camada de alocação, separada das faturas, para prevenir dupla contagem. Não há conversão cambial.

Cada resultado tem **Gráfico**, **Tabela** pesquisável e **JSON** sanitizado. Gráfico mostra até 12 maiores serviços/namespace por moeda e usa números para visualização; tabela/JSON preservam valores decimais. Totais exibidos no cartão usam duas casas; tabela e resumo mantêm a precisão recebida. JSON ainda contém nomes de recursos e informações financeiras: revise antes de compartilhar. Remoção de credenciais não anonimiza dados de negócio.

## AWS

1. Configure previamente um perfil AWS local autorizado. Para SSO, execute o login no terminal protegido do notebook, por exemplo `aws sso login --profile finops`.
2. No cartão AWS, informe o nome desse perfil. O SDK usa configuração local; não cadastre Access Key/Secret na aplicação.
3. Conta vinculada é opcional; quando informada, deve ter 12 dígitos. Sem filtro, o retorno é o escopo de billing autorizado ao perfil, potencialmente incluindo contas da organização.
4. Habilite Cost Explorer e autorize `ce:GetCostAndUsage` conforme a governança da empresa. O endpoint usa `us-east-1`; outras partições AWS não foram implementadas.

Consulta diária por serviço, métrica UnblendedCost e paginação até 100 páginas. Valores marcados Estimated pela AWS recebem aviso. A API pode gerar cobrança. Não inclui análise de compromissos AWS nesta versão.

Fonte: [GetCostAndUsage](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_GetCostAndUsage.html).

## GCP

1. Habilite exportação Cloud Billing para BigQuery; o histórico depende de quando e onde a exportação foi habilitada.
2. Configure Application Default Credentials (ADC) localmente, por exemplo `gcloud auth application-default login`, com as permissões corporativas adequadas. Não copie arquivo de credenciais para o repositório.
3. Informe projeto que executa a consulta, tabela completa `projeto.dataset.tabela` e localização real do dataset.
4. Requer criar jobs no projeto e ler a tabela autorizada. A tabela deve expor o schema da exportação padrão/detalhada com `usage_start_time`, `service.description`, `currency`, `cost` e `credits`. FOCUS tem outro schema e não é aceito por este conector.
5. Informe limite de bytes faturados (padrão 1 GB, máximo 10 GB) e marque autorização da consulta. Não é uma tarifa nem previsão de valor financeiro. A execução pode gerar cobrança dentro dos limites do BigQuery.

Consulta parametrizada por data UTC; custo líquido = cost + créditos. Até 10 mil linhas agregadas por dia/serviço/moeda. Não equivale necessariamente ao fechamento da fatura por mês de invoice. Exportação ausente, atrasada ou limitada deve ser conciliada com Cloud Billing.

Fonte: [Schema da exportação Cloud Billing](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/standard-usage).

## Kubernetes / OpenShift

Requer instância compatível de **OpenCost** implantada e autorizada no cluster. Isto não implementa a API nativa Red Hat Cost Management nem comprova compatibilidade de qualquer instalação OpenShift.

Informe a URL base OpenCost e a moeda configurada no serviço. Para loopback/rede privada, marque explicitamente a autorização. HTTP fica restrito a loopback; serviço remoto usa HTTPS com validação de certificado. Não desabilite TLS para contornar erros.

Quando aplicável, encaminhe o serviço localmente pelo procedimento autorizado do cluster, como `kubectl -n opencost port-forward deployment/opencost 9003`. Isso não instala OpenCost. Portas, namespace, política OpenShift/SCC e ingress devem ser ajustados pelo administrador do ambiente.

A consulta usa `/allocation`, janela UTC e agregação por namespace. O valor pode vir de preços de lista e depende da configuração e da retenção do OpenCost. **Não somar ao custo Azure/AWS/GCP do mesmo cluster.** O período informado é da consulta; cobertura efetiva de retenção deve ser confirmada no servidor. Para histórico longo, reduza a janela se necessário.

Autenticação Bearer admite referência de segredo **já existente** no cofre local. É uma opção avançada; esta versão não oferece cadastro específico de token OpenCost. Não coloque token na URL, no campo de referência ou no Git. Sem referência, o endpoint deve permitir leitura conforme a sua configuração de acesso.

Fonte: [API OpenCost](https://opencost.io/docs/integrations/api/).

## Execução e limites

As consultas AWS/GCP/OpenCost usam SDKs/APIs no serviço local; não passam pelo Copilot nem adicionam automaticamente tools multicloud aos agentes/MCPs cadastrados. Azure mantém os canais existentes. O chat multicloud é evolução posterior.

Formulário e resultados multicloud permanecem em memória ao navegar entre abas e são limpos ao recarregar a página. Credenciais AWS/ADC continuam administradas pelas ferramentas oficiais no perfil Windows. A sessão local e o token CSRF são necessários mesmo sem login Microsoft; login Azure não é requisito para consultar outros provedores.

Validação técnica com fixtures não comprova credenciais reais, rede corporativa, permissão de billing, qualidade do dataset, retenção ou precisão da fatura. Antes de usar valores em decisões, concilie cada fonte com o provedor e registre período/moeda/base.
