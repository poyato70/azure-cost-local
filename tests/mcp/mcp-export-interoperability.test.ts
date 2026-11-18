import { afterEach, expect, it } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { vscodeConfig } from "../../src/web/components/mcp-export.js";

const clients: Client[] = [];
let closeFixture: (() => Promise<void>) | undefined;

afterEach(async () => {
  for (const client of clients.splice(0)) await client.close().catch(() => {});
  await closeFixture?.();
  closeFixture = undefined;
});

it("connects through the URL in exported VS Code JSON and discovers MCP capabilities", async () => {
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  const server = createServer(async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? sessions.get(sessionId) : undefined;
    if (!transport && sessionId) return void res.writeHead(404).end();
    if (!transport) {
      const mcp = new McpServer(
        { name: "ux04-portability-fixture", version: "1.0.0" },
        { capabilities: { tools: {}, resources: {}, prompts: {} } },
      );
      mcp.registerTool(
        "fixture_lookup",
        {
          description: "Fixture only; required and optional schema fields.",
          inputSchema: {
            scope: z.string(),
            includeOptional: z.boolean().optional(),
          },
        },
        async () => ({ content: [{ type: "text", text: "not invoked" }] }),
      );
      mcp.registerResource(
        "fixture_resource",
        "fixture://ux04/resource",
        { description: "Local fixture resource", mimeType: "text/plain" },
        async (uri) => ({ contents: [{ uri: uri.href, text: "fixture" }] }),
      );
      mcp.registerPrompt(
        "fixture_prompt",
        {
          description: "Fixture prompt",
          argsSchema: {
            requiredTopic: z.string(),
            optionalStyle: z.string().optional(),
          },
        },
        async ({ requiredTopic }) => ({
          messages: [
            { role: "user", content: { type: "text", text: requiredTopic } },
          ],
        }),
      );
      let created!: StreamableHTTPServerTransport;
      created = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, created);
        },
      });
      created.onclose = () => {
        if (created.sessionId) sessions.delete(created.sessionId);
      };
      await mcp.connect(created);
      transport = created;
    }
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  closeFixture = async () => {
    for (const transport of sessions.values())
      await transport.close().catch(() => {});
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture did not bind TCP port");

  const exported = JSON.parse(
    vscodeConfig({
      name: "UX04 local fixture",
      transport: "http",
      endpoint: `http://127.0.0.1:${address.port}/mcp`,
    })!,
  );
  expect(exported.mcpServers.tesseractMcp).toEqual({
    type: "http",
    url: `http://127.0.0.1:${address.port}/mcp`,
  });
  const client = new Client({ name: "ux04-fixture-client", version: "1.0.0" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(
      new URL(exported.mcpServers.tesseractMcp.url),
    ),
    { timeout: 15000 },
  );

  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toContain("fixture_lookup");
  expect(tools[0].inputSchema.required).toContain("scope");
  expect(tools[0].inputSchema.required).not.toContain("includeOptional");
  expect(
    (await client.listResources()).resources.map((item) => item.name),
  ).toContain("fixture_resource");
  expect(
    (await client.listPrompts()).prompts.map((item) => item.name),
  ).toContain("fixture_prompt");
}, 30000);
