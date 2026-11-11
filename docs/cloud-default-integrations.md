# Conectores padrão de nuvem

O catálogo aparece em Conexões → MCPs → Descoberta. Uma entrada acionável abre um fluxo existente ou prepara o cadastro. Entradas de referência sinalizam integração pendente.

| Provedor | Rota prioritária | Cobertura e dependências |
| --- | --- | --- |
| Azure | ARM MCP oficial para Cost Management com OAuth delegado. Advisor pelo Azure MCP STDIO. APIs ARM para dashboard e identidade de aplicação. | Cost Management Query, Forecast e Budgets cobrem custo real e amortizado, agrupamento e previsões. As permissões variam por escopo de assinatura, grupo ou faturamento. Advisor e Consumption fornecem recomendações e dados de compromissos. Azure Monitor fornece tokens de entrada e saída por conta. |
| AWS | Avaliar o MCP Billing and Cost Management do AWS Labs. O conector atual usa Cost Explorer SDK com perfil AWS. | Cost Explorer para gastos, previsões e recomendações de compromissos. AWS Budgets para limites e alertas. Data Exports/CUR para rateio detalhado. Compute Optimizer e Trusted Advisor para otimização. Savings Plans para utilização e cobertura. CloudWatch para métricas Bedrock. |
| GCP | Avaliar Cloud Billing, BigQuery e Recommender MCP oficiais. O conector atual consulta o export de faturamento no BigQuery via ADC. | BigQuery para análise e rateio histórico. Cloud Billing Budgets para alertas. FinOps Hub e Recommender para oportunidades, rightsizing e compromissos. Carbon Footprint via exportação para BigQuery. Vertex AI para métricas de consumo de modelos. |

A identidade Azure delegada e a identidade de aplicativo com Secret seguem os fluxos existentes. Para AWS, use o perfil corporativo configurado com as credenciais ou a cadeia de assume-role autorizada. Para GCP, configure ADC, as permissões de BigQuery e o export de faturamento. Certificado Azure e configuração guiada de IAM, WIF e conta de serviço ainda precisam de implementação e validação.

Chargeback e showback dependem de regras de rateio, centro de custo, etiquetas e tratamento de custos compartilhados. What-if deve usar hipóteses explícitas e reportar estimativa. Custos de IA exigem conciliação com faturamento ou tarifas versionadas. Contagem prévia de tokens, telemetria por usuário/aplicação e consumo faturado são medidas diferentes. Filtros por usuário exigem telemetria da aplicação autorizada pela organização.

O monitor de MCPs deve registrar versão, autenticação anunciada e schemas, comparar snapshots e invalidar aprovações quando o schema mudar. A descoberta existente é interativa. O agendamento, o relatório automático e a exposição de todas as novas capacidades a agentes ainda estão pendentes.

## Fontes oficiais

- [ARM MCP Cost Management e Pricing](https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/CostManagementAndPricingTools.md)
- [Azure OpenAI no Azure Monitor](https://learn.microsoft.com/azure/foundry/openai/monitor-openai-reference)
- [Azure Carbon Optimization](https://learn.microsoft.com/en-us/rest/api/carbon/)
- [AWS Billing and Cost Management MCP](https://awslabs.github.io/mcp/servers/billing-cost-management-mcp-server)
- [Métricas do Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/monitoring-runtime-metrics.html)
- [Servidores MCP do Google Cloud](https://docs.cloud.google.com/mcp/supported-products)
- [Export de faturamento Google Cloud](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery)
- [Google Cloud FinOps Hub](https://docs.cloud.google.com/billing/docs/how-to/finops-hub)
- [Export do Carbon Footprint](https://docs.cloud.google.com/carbon-footprint/docs/export)
