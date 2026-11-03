import { it, expect } from "vitest";
import { createServer } from "node:http";
import { HubService } from "../../src/server/hubs/service.js";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import { descriptor } from "../../src/server/mcp/tool-policy.js";
it("executes registered Hub template through real MCP HTTP while rejecting free KQL", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111",
    subscriptionId = "22222222-2222-4222-8222-222222222222";
  const tool = {
    name: "kusto_query",
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(
        ["query", "cluster-uri", "database", "tenant", "subscription"].map(
          (k) => [k, { type: "string" }],
        ),
      ),
      required: ["query", "cluster-uri", "database", "tenant", "subscription"],
      additionalProperties: false,
    },
  };
  let received = "";
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const c of req) text += c;
    const msg = text ? JSON.parse(text) : {};
    if (msg.id == null) {
      res.writeHead(202);
      res.end();
      return;
    }
    let result: any;
    if (msg.method === "initialize")
      result = {
        protocolVersion: msg.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "hub-fixture", version: "1" },
      };
    if (msg.method === "tools/list") result = { tools: [tool] };
    if (msg.method === "tools/call") {
      received = msg.params.arguments.query;
      result = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: 200,
              results: {
                items: [
                  {
                    Month: "2026-09-01T00:00:00Z",
                    BillingCurrency: "BRL",
                    BilledCost: "42.10",
                    EffectiveCost: "41.20",
                    Records: 3,
                  },
                ],
              },
            }),
          },
        ],
      };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const access = { id: "a", tenantId, configurationVersion: 1 };
  const hub = {
    id: "h",
    name: "synthetic",
    accessId: "a",
    endpoint: "https://test.westeurope.kusto.windows.net",
    database: "Hub",
    schemaVersion: "v1_2",
    transport: "mcp",
    mcpConnectionId: "m",
    configurationVersion: 1,
  };
  const m = {
    id: "m",
    preset: "adx",
    transport: "http",
    endpoint: `http://127.0.0.1:${(server.address() as any).port}`,
    audience: "api://11111111-1111-4111-8111-111111111111",
    accessId: "a",
    authMode: "application",
    allowPrivateNetwork: true,
    configurationVersion: 1,
    resourceContext: {
      clusterUri: hub.endpoint,
      database: "Hub",
      tenant: tenantId,
      subscription: subscriptionId,
    },
    approvedTools: [
      { name: tool.name, schemaHash: descriptor(tool).schemaHash },
    ],
  };
  const snapshot: any = {
    accessProfiles: [access],
    hubProfiles: [hub],
    mcpProfiles: [m],
    agentProfiles: [],
  };
  const store: any = { read: async () => snapshot },
    gate = new Invalidation(store),
    identity: any = {
      applications: { token: async () => "synthetic" },
      getToken: async () => "synthetic",
    };
  const registry = new McpRegistry(
    store,
    {} as any,
    { get: async () => access } as any,
    gate,
    identity,
  );
  const hubs = new HubService(store, gate, identity, registry, {
    inventory: { authorize: async () => {} },
  } as any);
  const ctx = {
    sessionId: "s",
    accessId: "a",
    tenantId,
    userId: "u",
    principalKind: "application" as const,
    signal: new AbortController().signal,
  };
  try {
    const result = await hubs.run(
      ctx,
      "h",
      { tenantId, subscriptionId, resourceGroup: "rg-test" },
      "ActualCost",
      "costs",
      new Date("2026-11-03"),
    );
    expect(result.totals).toEqual([{ currency: "BRL", amount: "42.1" }]);
    expect(received).toContain("Costs_v1_2()");
    await expect(
      registry.call(ctx, "m", "kusto_query", {
        "cluster-uri": hub.endpoint,
        database: "Hub",
        tenant: tenantId,
        subscription: subscriptionId,
        query: received,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  } finally {
    await registry.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}, 15000);
