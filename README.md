# Azure Cost Local

Dashboard pessoal de custos Azure com serviço local, chat GitHub Copilot ou agente cadastrado, acessos salvos e conexões MCP Microsoft. Interface em português, custos reais/amortizados, budgets, recomendações de Reservations/Savings Plans e consultas em linguagem natural.

```powershell
npm ci
npm run build
npm start
```

Abra http://localhost:4317 e configure os dois identificadores do seu aplicativo público Entra. Senha e MFA são informados somente à Microsoft.

[Migração Windows e Copilot](docs/migration-windows.md) · [Conexões e validação](docs/connections-validation.md) · [Configuração e operação](docs/setup.md) · [Capacidades de benefícios](docs/benefits-capabilities.md) · [Validação](docs/validation.md).

O modo normal usa APIs reais. Sem login, nenhuma despesa é inventada. Integração Azure e conciliação com o portal ainda dependem da conta do usuário.

[Análise de viabilidade: FinOps Toolkit e Awesome Copilot](docs/finops-toolkit-awesome-copilot-feasibility.md). Proposta de evolução, sem integração instalada.
