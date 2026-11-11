export type CloudDefault = {
  name: string;
  provider: "Azure" | "AWS" | "GCP";
  connectionType: "Remote MCP" | "MCP STDIO" | "API";
  transport: "HTTP" | "stdio";
  status: "Default";
  supports: string[];
  target?: string;
  prerequisite: string;
};

const arm = "Login delegado, assinatura ou grupo e permissões Azure.";
const aws = "Perfil AWS local com permissões para a conta de faturamento.";
const gcp = "ADC, projeto de consulta e tabela de exportação Cloud Billing.";
const entries: [
  CloudDefault["provider"],
  string,
  CloudDefault["connectionType"],
  string[],
  string,
  string?,
][] = [
  [
    "Azure",
    "Azure Cost Management",
    "Remote MCP",
    ["Custos reais e amortizados", "Previsão", "Leitura de orçamentos"],
    arm,
    "arm",
  ],
  [
    "Azure",
    "Azure Billing",
    "API",
    ["Faturas e perfis de faturamento"],
    "Escopo e permissões de faturamento Azure.",
  ],
  [
    "Azure",
    "Azure Advisor",
    "MCP STDIO",
    ["Recomendações de otimização"],
    "Acesso de aplicação Azure com permissão de leitura.",
    "advisor",
  ],
  [
    "Azure",
    "Azure Consumption",
    "API",
    ["Histórico de custos e análise por tag"],
    "Acesso Azure com permissões Cost Management.",
    "costs",
  ],
  [
    "Azure",
    "Azure OpenAI Usage",
    "API",
    ["Tokens de entrada e saída", "Série diária"],
    "Acesso Azure com leitura das métricas da conta OpenAI.",
    "azure-ai",
  ],
  [
    "Azure",
    "Azure Reservations",
    "API",
    ["Análise de benefícios de reservas"],
    "Acesso Azure ao escopo dos benefícios.",
    "benefits",
  ],
  [
    "Azure",
    "Azure Savings Plans",
    "API",
    ["Análise de benefícios de Savings Plans"],
    "Acesso Azure ao escopo dos benefícios.",
    "benefits",
  ],
  [
    "AWS",
    "AWS Cost Explorer",
    "API",
    ["Histórico de custos"],
    aws,
    "multicloud",
  ],
  ["AWS", "AWS Budgets", "MCP STDIO", ["Orçamentos e alertas"], aws],
  ["AWS", "AWS Billing", "MCP STDIO", ["Dados de faturamento"], aws],
  [
    "AWS",
    "AWS Compute Optimizer",
    "MCP STDIO",
    ["Recomendações de rightsizing"],
    aws,
  ],
  [
    "AWS",
    "AWS Trusted Advisor",
    "API",
    ["Recomendações Trusted Advisor"],
    "Permissões Trusted Advisor e plano elegível.",
  ],
  [
    "AWS",
    "AWS Savings Plans",
    "MCP STDIO",
    ["Inventário e utilização de compromissos"],
    aws,
  ],
  [
    "AWS",
    "Amazon Bedrock Usage",
    "API",
    ["Métricas CloudWatch por modelo e região"],
    "Perfil AWS e leitura CloudWatch.",
  ],
  [
    "GCP",
    "Cloud Billing",
    "API",
    ["Histórico de custos exportado para BigQuery"],
    gcp,
    "multicloud",
  ],
  [
    "GCP",
    "FinOps Hub",
    "Remote MCP",
    ["Recomendações via Recommender"],
    "Conta de faturamento e permissão Recommender.",
  ],
  [
    "GCP",
    "Recommender API",
    "Remote MCP",
    ["Recomendações de otimização e compromissos"],
    "OAuth Google e escopo IAM do recomendador.",
  ],
  [
    "GCP",
    "Budgets",
    "API",
    ["Orçamentos e configuração de alertas"],
    "Credencial Google e permissões Cloud Billing Budgets.",
  ],
  [
    "GCP",
    "Vertex AI Usage",
    "API",
    ["Métricas de consumo por modelo"],
    "ADC, projeto Vertex AI e leitura Cloud Monitoring.",
  ],
];

export const cloudDefaults: CloudDefault[] = entries.map(
  ([provider, name, connectionType, supports, prerequisite, target]) => ({
    provider,
    name,
    connectionType,
    transport: connectionType === "MCP STDIO" ? "stdio" : "HTTP",
    status: "Default",
    supports,
    prerequisite,
    target,
  }),
);
