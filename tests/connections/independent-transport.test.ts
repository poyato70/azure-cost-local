import { it, expect } from "vitest";
import { createServer } from "node:http";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
it("discovers and executes a schema-approved MCP without Azure; binds credentials to endpoint", async () => {
  let auth = "",
    calls = 0;
  let tool: any = {
    name: "namespaces_list",
    description: "echo controlled-token",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", additionalProperties: false },
  };
  const server = createServer(async (req, res) => {
    auth = String(req.headers.authorization || "");
    let body = "";
    for await (const c of req) body += c;
    const msg = body ? JSON.parse(body) : {};
    if (msg.id == null) {
      res.writeHead(202).end();
      return;
    }
    let result: any;
    if (msg.method === "initialize")
      result = {
        protocolVersion: msg.params.protocolVersion,
        capabilities: { tools: {}, prompts: {}, resources: {} },
        serverInfo: { name: "controlled-kube", version: "1" },
      };
    if (msg.method === "tools/list") result = { tools: [tool] };
    if (msg.method === "prompts/list")
      result = {
        prompts: [{ name: "sample", description: "controlled-token" }],
      };
    if (msg.method === "resources/list")
      result = {
        resources: [{ uri: "fixture://read", name: "controlled-token" }],
      };
    if (msg.method === "prompts/get")
      result = {
        messages: [
          { role: "user", content: { type: "text", text: "controlled-token" } },
        ],
      };
    if (msg.method === "tools/call") {
      calls++;
      result = {
        content: [
          {
            type: "text",
            text: "namespace: finops; echoed credential controlled-token",
          },
        ],
      };
    }
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const snapshot: any = {
    schemaVersion: 1,
    accessProfiles: [],
    mcpProfiles: [],
    agentProfiles: [],
  };
  const store: any = {
    read: async () => structuredClone(snapshot),
    mutate: async (fn: any) => fn(snapshot),
  };
  const values = new Map<string, string>();
  const vault: any = {
    put: async (v: string) => {
      values.set("ref", v);
      return "ref";
    },
    read: async (ref: string) => values.get(ref),
    remove: async (ref: string) => values.delete(ref),
  };
  const registry = new McpRegistry(
    store,
    vault,
    {} as any,
    new Invalidation(store),
    {} as any,
  );
  const ctx: any = {
    sessionId: "local",
    userId: "",
    tenantId: "",
    requestId: "test-correlation",
    signal: new AbortController().signal,
  };
  try {
    const saved = await registry.save({
      name: "kube",
      preset: "kubernetes",
      transport: "http",
      endpoint: `http://127.0.0.1:${(server.address() as any).port}/mcp`,
      allowPrivateNetwork: true,
      authMode: "bearer",
      tokenAction: { kind: "replace", value: "controlled-token" },
    });
    expect(saved).not.toHaveProperty("tokenRef");
    expect(saved.tokenConfigured).toBe(true);
    const tools = await registry.tools(ctx, saved.id);
    expect((await registry.list(ctx.sessionId))[0].connected).toBe(true);
    expect((await registry.list("another-session"))[0].connected).toBe(false);
    expect(tools[0].approved).toBe(false);
    expect(JSON.stringify(tools)).not.toContain("controlled-token");
    expect(JSON.stringify(await registry.catalog(ctx, saved.id))).not.toContain(
      "controlled-token",
    );
    expect(
      JSON.stringify(
        await registry.inspect(ctx, saved.id, {
          kind: "prompt",
          name: "sample",
        }),
      ),
    ).not.toContain("controlled-token");
    await expect(
      registry.call(ctx, saved.id, tool.name, {}),
    ).rejects.toMatchObject({ code: "forbidden" });
    await registry.approve(ctx, saved.id, [tool.name]);
    const result = await registry.call(ctx, saved.id, tool.name, {});
    expect(JSON.stringify(result)).not.toContain("controlled-token");
    expect(result.requestId).toBe("test-correlation");
    expect(auth).toBe("Bearer controlled-token");
    expect(calls).toBe(1);
    tool = { ...tool, annotations: { readOnlyHint: false } };
    await expect(
      registry.call(ctx, saved.id, tool.name, {}),
    ).rejects.toMatchObject({ code: "forbidden" });
    const profile = await registry.get(saved.id);
    const { tokenRef, configurationVersion, ...fields } = profile;
    await expect(
      registry.save({
        ...fields,
        endpoint: profile.endpoint + "/changed",
        expectedVersion: profile.configurationVersion,
      }),
    ).rejects.toMatchObject({ code: "credential_binding" });
    expect(values.get("ref")).toBe("controlled-token");
    const connection = await registry.connect(ctx, saved.id);
    await connection.client.close();
    expect((await registry.list(ctx.sessionId))[0].connected).toBe(false);
  } finally {
    await registry.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}, 15000);
