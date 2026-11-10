export function describeMcp(p: {
  preset: string;
  transport: string;
  authMode: string;
  endpoint?: string;
  resourceContext?: Record<string, string>;
}): [string, string][] {
  const microsoft = ["azure", "adx", "arm", "foundry"].includes(p.preset);
  const provider = microsoft
    ? "Microsoft Azure"
    : ["fabric", "powerbi"].includes(p.preset)
      ? "Microsoft Fabric / Power BI"
      : p.preset === "kubernetes"
        ? "Kubernetes / OpenShift"
        : "Servidor personalizado";
  const local = p.transport === "stdio";
  const rows: [string, string][] = [
    ["Provider", provider],
    ["Transporte", local ? "stdio" : "Streamable HTTP"],
    [
      "Execução",
      local
        ? "Local (localhost / host do Tesseract)"
        : "Servidor no endpoint informado",
    ],
    [
      "Endpoint MCP",
      local
        ? "Sem endpoint HTTP — comunicação por stdin/stdout"
        : p.endpoint || "Informe o endpoint MCP",
    ],
    [
      local ? "Autenticação Azure" : "Autenticação MCP",
      p.authMode === "application"
        ? "OAuth 2.0 · Client Credentials (identidade de aplicação)"
        : p.authMode === "delegated"
          ? "OAuth 2.0 · login de usuário"
          : p.authMode === "bearer"
            ? "Token Bearer do servidor MCP"
            : "Sem autenticação no endpoint MCP",
    ],
  ];
  if (local) {
    rows.push([
      "Pacote",
      p.preset === "fabric"
        ? "@microsoft/fabric-mcp@1.7.0"
        : "@azure/mcp@3.0.0",
    ]);
    rows.push([
      "Destino dos dados",
      p.preset === "fabric" ? "APIs Microsoft Fabric" : "APIs Microsoft Azure",
    ]);
  }
  if (p.resourceContext?.namespace)
    rows.push(["Grupo de tools", p.resourceContext.namespace]);
  return rows;
}
