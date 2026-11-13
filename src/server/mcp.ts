import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpBinding } from "./registry.js";

export async function withMcp<T>(binding: McpBinding, fn: (client: Client) => Promise<T>) {
  const client = new Client({ name: "tesseract-local", version: "2.0.0-alpha.1" });
  const transport = binding.transport === "stdio"
    ? new StdioClientTransport({ command: binding.command!, args: binding.args ?? [], env: Object.fromEntries(Object.entries({ ...process.env, ...binding.env }).filter((entry) => typeof entry[1] === "string")) as Record<string, string> })
    : (() => { const url = new URL(binding.endpoint!); if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Endpoint MCP não permitido."); return new StreamableHTTPClientTransport(url); })();
  try { await client.connect(transport, { timeout: 10000 }); return await fn(client); }
  finally { await client.close().catch(() => {}); }
}

export function isReadOnlyTool(name: string, args?: Record<string, unknown>): boolean {
  if (name === "foundry") {
    if (args?.learn === true) return true;
    return typeof args?.command === "string" && isReadOnlyTool(args.command);
  }
  return !/(create|delete|remove|write|update|patch|put|post|apply|deploy|execute|run|restart|scale|stop|start|approve|revoke|assign|set|mutate)/i.test(name);
}
