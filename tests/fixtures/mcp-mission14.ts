import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

export async function startMission14Fixtures() {
  const handles: Array<{ http: Server; sessions: Map<string, any> }> = [];
  const counts = { costs: 0, inventory: 0 };
  const period = { from: "2026-10-01", toExclusive: "2026-11-01" };
  const start = async (kind: "costs" | "inventory") => {
    const sessions = new Map<string, any>();
    const http = createServer(async (req, res) => {
      let active = req.headers["mcp-session-id"]
        ? sessions.get(String(req.headers["mcp-session-id"]))
        : undefined;
      if (!active && req.headers["mcp-session-id"])
        return void res.writeHead(404).end();
      if (!active) {
        const server = new McpServer(
          { name: `m14-${kind}-synthetic`, version: "1.0" },
          { capabilities: { tools: {} } },
        );
        server.registerTool(
          kind === "costs" ? "list_costs" : "list_inventory",
          {
            inputSchema: {
              scope: z.string(),
              from: z.string(),
              toExclusive: z.string(),
            },
            annotations: { readOnlyHint: true },
            _meta:
              kind === "inventory"
                ? { "tesseract/approval": "each-call" }
                : undefined,
          },
          async () => {
            counts[kind]++;
            return {
              content: [{ type: "text", text: `Synthetic ${kind} fixture` }],
              structuredContent:
                kind === "costs"
                  ? {
                      rows: [
                        {
                          lineId: "cost-1",
                          provider: "azure",
                          scope: "sub-01",
                          resourceId: "vm-01",
                          period,
                          currency: "USD",
                          amount: "10.10",
                          classification: "usage",
                          evidenceRef: "cost://cost-1",
                        },
                        {
                          lineId: "cost-2",
                          provider: "azure",
                          scope: "sub-01",
                          resourceId: "vm-01",
                          period,
                          currency: "USD",
                          amount: "0.20",
                          classification: "usage",
                          evidenceRef: "cost://cost-2",
                        },
                        {
                          lineId: "shared-1",
                          provider: "azure",
                          scope: "sub-01",
                          resourceId: null,
                          period,
                          currency: "USD",
                          amount: "2.00",
                          classification: "shared",
                          evidenceRef: "cost://shared-1",
                        },
                        {
                          lineId: "unmatched-1",
                          provider: "azure",
                          scope: "sub-01",
                          resourceId: "vm-missing",
                          period,
                          currency: "USD",
                          amount: "3.00",
                          classification: "usage",
                          evidenceRef: "cost://unmatched-1",
                        },
                      ],
                    }
                  : {
                      rows: [
                        {
                          inventoryId: "inv-1",
                          provider: "azure",
                          scope: "sub-01",
                          resourceId: "vm-01",
                          resourceType: "compute",
                          name: "Synthetic VM",
                          evidenceRef: "inventory://inv-1",
                        },
                        {
                          inventoryId: "inv-2",
                          provider: "azure",
                          scope: "sub-02",
                          resourceId: "vm-01",
                          resourceType: "compute",
                          name: "Other scope VM",
                          evidenceRef: "inventory://inv-2",
                        },
                      ],
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
        active = { transport, server };
      }
      await active.transport.handleRequest(req, res);
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    handles.push({ http, sessions });
    return `http://127.0.0.1:${(http.address() as import("node:net").AddressInfo).port}/mcp`;
  };
  const endpoints = await Promise.all([start("costs"), start("inventory")]);
  return {
    endpoints,
    counts,
    async close() {
      for (const handle of handles) {
        for (const { transport, server } of handle.sessions.values()) {
          await transport.close().catch(() => {});
          await server.close().catch(() => {});
        }
        await new Promise<void>((resolve) =>
          handle.http.close(() => resolve()),
        );
      }
    },
  };
}
