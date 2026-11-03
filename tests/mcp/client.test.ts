import { it, expect } from "vitest";
import { createServer } from "node:http";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { descriptor } from "../../src/server/mcp/tool-policy.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
it("uses actual MCP initialize/list/call and rejects a changed tool schema", async () => {
  let failed = false;
  let changed = false,
    calls = 0;
  const schema = () => ({
    type: "object",
    properties: changed
      ? { sku: { type: "number" } }
      : { sku: { type: "string" } },
  });
  const tool = () => ({
    name: "pricing_get",
    inputSchema: schema(),
    annotations: { readOnlyHint: true },
  });
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
        serverInfo: { name: "fixture", version: "1" },
      };
    else if (msg.method === "tools/list") result = { tools: [tool()] };
    else if (msg.method === "tools/call") {
      calls++;
      result = {
        isError: failed,
        content: [{ type: "text", text: "synthetic MCP result" }],
      };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  const access = {
    id: "a",
    tenantId: "t",
    clientId: "c",
    configurationVersion: 1,
    credentialVersion: 1,
  };
  const profile = {
    id: "m",
    name: "fixture",
    preset: "azure",
    transport: "http",
    endpoint: `http://127.0.0.1:${port}`,
    accessId: "a",
    audience: "api://11111111-1111-4111-8111-111111111111",
    authMode: "application",
    allowPrivateNetwork: true,
    resourceContext: {},
    approvedTools: [
      { name: "pricing_get", schemaHash: descriptor(tool()).schemaHash },
    ],
    configurationVersion: 1,
  } as any;
  const snapshot = {
    schemaVersion: 1,
    accessProfiles: [access],
    mcpProfiles: [profile],
    agentProfiles: [],
  };
  const store = { read: async () => snapshot } as any;
  const registry = new McpRegistry(
    store,
    {} as any,
    { get: async () => access } as any,
    new Invalidation(store),
    {
      applications: { token: async () => "synthetic-token" },
      getToken: async () => "synthetic-token",
    } as any,
  );
  const ctx = {
    sessionId: "s",
    userId: "u",
    tenantId: "t",
    accessId: "a",
    signal: new AbortController().signal,
  };
  try {
    expect((await registry.tools(ctx, "m"))[0].name).toBe("pricing_get");
    const r = await registry.call(ctx, "m", "pricing_get", { sku: "test" });
    expect(r.source).toBe("mcp");
    expect(calls).toBe(1);
    failed = true;
    await expect(
      registry.call(ctx, "m", "pricing_get", {}),
    ).rejects.toMatchObject({ code: "mcp_tool_failed" });
    failed = false;
    changed = true;
    await expect(
      registry.call(ctx, "m", "pricing_get", { sku: "test" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(calls).toBe(2);
  } finally {
    await registry.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}, 15000);
