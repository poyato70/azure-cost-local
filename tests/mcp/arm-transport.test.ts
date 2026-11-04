import { it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { descriptor } from "../../src/server/mcp/tool-policy.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
let fixtureUrl = "";
vi.mock("../../src/server/security/endpoint-policy.js", async (original) => {
  const real = await original<any>();
  return {
    ...real,
    validateEndpoint: (url: string) =>
      real.validateEndpoint(url, false, async () => [
        { address: "150.171.110.38", family: 4 },
      ]),
    fetchBound: async (url: string, init: any) => {
      if (new URL(url).origin !== "https://mcp.management.azure.com")
        throw Error("unexpected target");
      return real.fetchBound(fixtureUrl, init, true);
    },
  };
});
it("negotiates ARM MCP over HTTP with CostManagement header and delegated resource token", async () => {
  const scope = "/subscriptions/11111111-1111-4111-8111-111111111111";
  let header = "",
    auth = "",
    calls = 0;
  const tool = {
    name: "query_costs",
    inputSchema: {
      type: "object",
      properties: { scope: { type: "string" } },
      required: ["scope"],
      additionalProperties: false,
    },
  };
  const server = createServer(async (req, res) => {
    header = String(req.headers["x-mcp-toolset"]);
    auth = String(req.headers.authorization);
    let text = "";
    for await (const c of req) text += c;
    const m = text ? JSON.parse(text) : {};
    if (m.id == null) {
      res.writeHead(202);
      res.end();
      return;
    }
    let result: any;
    if (m.method === "initialize")
      result = {
        protocolVersion: m.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "ARM fixture", version: "1" },
      };
    else if (m.method === "tools/list") result = { tools: [tool] };
    else if (m.method === "tools/call") {
      calls++;
      result = { content: [{ type: "text", text: "synthetic cost response" }] };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  fixtureUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  const access = { id: "a", tenantId: "t", configurationVersion: 1 };
  const profile = {
    id: "m",
    name: "ARM",
    preset: "arm",
    endpoint: "https://mcp.management.azure.com",
    transport: "http",
    authMode: "delegated",
    accessId: "a",
    configurationVersion: 1,
    resourceContext: { scope },
    approvedTools: [
      { name: tool.name, schemaHash: descriptor(tool).schemaHash },
    ],
  };
  const store: any = {
    read: async () => ({
      accessProfiles: [access],
      mcpProfiles: [profile],
      agentProfiles: [],
    }),
  };
  const getToken = vi.fn(async () => "synthetic"),
    appToken = vi.fn();
  const registry = new McpRegistry(
    store,
    {} as any,
    { get: async () => access } as any,
    new Invalidation(store),
    { getToken, applications: { token: appToken } } as any,
  );
  const ctx = {
    sessionId: "s",
    tenantId: "t",
    userId: "u",
    accessId: "a",
    principalKind: "user" as const,
    signal: new AbortController().signal,
  };
  try {
    await registry.tools(ctx, "m");
    const r = await registry.call(ctx, "m", "query_costs", { scope });
    expect(calls).toBe(1);
    expect(header).toBe("CostManagement");
    expect(auth).toBe("Bearer synthetic");
    expect(getToken).toHaveBeenCalledWith(
      ctx,
      "api://22bfbae3-f4e7-485f-be43-8cee15065084",
    );
    expect(appToken).not.toHaveBeenCalled();
    expect(r.warnings?.length).toBeGreaterThan(0);
    await expect(
      registry.call(ctx, "m", "query_costs", { scope: "/subscriptions/other" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(calls).toBe(1);
  } finally {
    await registry.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}, 15000);
