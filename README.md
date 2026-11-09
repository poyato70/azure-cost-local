# TESSERACT — FinOps multicloud

Workspace local para o time FinOps cadastrar acessos, conexões MCP Microsoft e agentes, consultar dados e conversar com GitHub Copilot ou modelo configurado. Interface em português, custos reais/amortizados, budgets, recomendações de Reservations/Savings Plans e consultas em linguagem natural.

**Versão 0.3.0:** identidade própria, navegação por tarefas e **Visão multicloud** com Azure, AWS Cost Explorer, GCP Cloud Billing/BigQuery e alocação Kubernetes/OpenShift via OpenCost. Resultados em gráfico, tabela e JSON; moedas/bases e alocação são separadas para evitar dupla contagem. [Configuração, pré-requisitos e limites](docs/multicloud-guide.md).

```powershell
npm ci
npm run build
npm start
```

Abra http://localhost:4317 e configure os dois identificadores do seu aplicativo público Entra. Senha e MFA são informados somente à Microsoft.

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
