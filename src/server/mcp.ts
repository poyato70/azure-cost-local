import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpBinding } from "./registry.js";

export async function withMcp<T>(binding: McpBinding, fn: (client: Client) => Promise<T>) {
  const url = new URL(binding.endpoint);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Endpoint MCP não permitido.");
  const client = new Client({ name: "tesseract-local", version: "2.0.0-alpha.1" });
  const transport = new StreamableHTTPClientTransport(url);
  try { await client.connect(transport, { timeout: 10000 }); return await fn(client); }
  finally { await client.close().catch(() => {}); }
}

export function isReadOnlyTool(name: string) {
  return !/(create|delete|remove|write|update|patch|put|post|apply|deploy|execute|run|restart|scale|stop|start|approve|revoke|assign|set|mutate)/i.test(name);
}
