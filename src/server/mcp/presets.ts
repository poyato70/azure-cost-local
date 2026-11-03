import { AppError } from "../errors.js";
import type { McpProfile, CapabilityRecord } from "../../shared/connections.js";
export const presets = [
  {
    id: "azure",
    name: "Microsoft Azure",
    endpoint: "",
    namespace: "",
    package: "@azure/mcp@3.0.0",
    bin: "azmcp",
    audience: "https://management.azure.com",
  },
  {
    id: "adx",
    name: "Azure Data Explorer",
    endpoint: "",
    namespace: "kusto",
    package: "@azure/mcp@3.0.0",
    bin: "azmcp",
    audience: "https://management.azure.com",
  },
  {
    id: "foundry",
    name: "Microsoft Foundry",
    endpoint: "https://mcp.ai.azure.com",
    namespace: "",
    audience: "https://mcp.ai.azure.com",
  },
  {
    id: "fabric",
    name: "Microsoft Fabric",
    endpoint: "https://api.fabric.microsoft.com/v1/mcp/core",
    namespace: "",
    package: "@microsoft/fabric-mcp@1.7.0",
    bin: "fabmcp",
    audience: "https://api.fabric.microsoft.com",
  },
  {
    id: "powerbi",
    name: "Power BI",
    endpoint: "https://api.fabric.microsoft.com/v1/mcp/powerbi",
    namespace: "",
    audience: "https://api.fabric.microsoft.com",
  },
];
export function capability(
  p: Pick<McpProfile, "preset" | "transport" | "authMode">,
): CapabilityRecord {
  let status: CapabilityRecord["status"] = "pending",
    reason =
      "Requer teste de autenticação, descoberta e chamada de ferramenta no seu ambiente.";
  if (
    p.transport === "stdio" &&
    (!["azure", "adx", "fabric"].includes(p.preset) ||
      p.authMode !== "application")
  ) {
    status = "unsupported";
    reason =
      "Este preset local requer identidade de aplicação vinculada; não herda logins do Azure CLI.";
  }
  if (p.preset === "foundry" && p.authMode === "application") {
    status = "unsupported";
    reason =
      "O Foundry MCP remoto usa fluxo delegado/OBO; Client Secret não é presumido como suporte a autenticação app-only.";
  }
  if (p.authMode === "none") {
    status = "unsupported";
    reason = "Este preset Microsoft requer autenticação.";
  }
  return {
    service: p.preset,
    transport: p.transport,
    authMode: p.authMode,
    status,
    reason,
    sourceUrl:
      p.preset === "foundry"
        ? "https://learn.microsoft.com/en-us/azure/foundry/mcp/get-started"
        : p.preset === "powerbi"
          ? "https://learn.microsoft.com/pt-br/power-bi/developer/mcp/remote-mcp-server-get-started"
          : "https://github.com/microsoft/mcp",
    checkedAt: new Date().toISOString(),
  };
}

export function httpAudience(
  p: Pick<McpProfile, "preset" | "endpoint" | "audience">,
) {
  const preset = presets.find((x) => x.id === p.preset)!;
  if (["azure", "adx"].includes(p.preset)) {
    if (
      !/^api:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        p.audience || "",
      )
    )
      throw new AppError(
        "forbidden",
        "MCP HTTP próprio requer audience api://ID do aplicativo do servidor; tokens ARM não são enviados a hosts personalizados.",
        403,
      );
    return p.audience!;
  }
  if (
    new URL(p.endpoint!).href !== new URL(preset.endpoint).href ||
    (p.audience && p.audience !== preset.audience)
  )
    throw new AppError(
      "forbidden",
      "Este preset requer seu endpoint oficial e audience correspondente.",
      403,
    );
  return preset.audience;
}
