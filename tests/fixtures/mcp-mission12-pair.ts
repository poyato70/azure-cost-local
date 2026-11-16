import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";

async function launch(role: "a" | "b") {
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();
  const http = createServer(async (req, res) => {
    let session = req.headers["mcp-session-id"]
      ? sessions.get(String(req.headers["mcp-session-id"]))
      : undefined;
    if (!session && req.headers["mcp-session-id"])
      return void res.writeHead(404).end();
    if (!session) {
      const server = new McpServer(
        { name: `mission12-${role}-fixture`, version: "1.0.0" },
        { capabilities: { tools: {} } },
      );
      if (role === "a")
        server.registerTool(
          "m12_synthetic_cost",
          {
            description: "Dados sintéticos M12",
            inputSchema: { scope: z.string() },
            annotations: { readOnlyHint: true },
          },
          async () => {
            if (process.env.M12_FIXTURE_CALLS)
              await appendFile(process.env.M12_FIXTURE_CALLS, "a\n");
            if (
              process.env.M12_A_DELAY_FILE &&
              existsSync(process.env.M12_A_DELAY_FILE)
            )
              await new Promise((resolve) => setTimeout(resolve, 5000));
            return {
              content: [{ type: "text", text: "M12_SYNTHETIC_COST" }],
              structuredContent: {
                marker: "M12_SYNTHETIC_COST",
                amount: 42.5,
                currency: "USD",
                period: "2026-10",
              },
            };
          },
        );
      else
        server.registerTool(
          "m12_summarize_cost",
          {
            description: "Resumo sintético M12",
            inputSchema: {
              amount: z.number(),
              currency: z.string(),
              period: z.string(),
            },
            annotations: { readOnlyHint: true },
            _meta: { "tesseract/approval": "each-call" },
          },
          async (args) => {
            if (process.env.M12_FIXTURE_CALLS)
              await appendFile(process.env.M12_FIXTURE_CALLS, "b\n");
            return {
              content: [{ type: "text", text: "M12_SYNTHETIC_SUMMARY" }],
              structuredContent: {
                marker: "M12_SYNTHETIC_SUMMARY",
                total: args.amount,
                currency: args.currency,
                period: args.period,
              },
            };
          },
        );
      let transport!: StreamableHTTPServerTransport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      session = { transport, server };
    }
    await session.transport.handleRequest(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(0, "127.0.0.1", resolve);
  });
  return {
    http,
    sessions,
    port: (http.address() as import("node:net").AddressInfo).port,
  };
}

if (
  process.argv[1]?.endsWith("mcp-mission12-pair.ts") &&
  process.argv.includes("--http-pair")
) {
  const [a, b] = await Promise.all([launch("a"), launch("b")]);
  process.stdout.write(JSON.stringify({ a: a.port, b: b.port }) + "\n");
  const close = async () => {
    for (const fixture of [a, b]) {
      for (const { transport, server } of fixture.sessions.values()) {
        await transport.close().catch(() => {});
        await server.close().catch(() => {});
      }
      await new Promise<void>((resolve) => fixture.http.close(() => resolve()));
    }
  };
  process.once("SIGTERM", () => void close().finally(() => process.exit(0)));
  process.once("SIGINT", () => void close().finally(() => process.exit(0)));
}
