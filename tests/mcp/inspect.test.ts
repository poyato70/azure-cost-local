import { it, expect, vi } from "vitest";
import { McpRegistry } from "../../src/server/mcp/registry.js";
function registry() {
  const client = {
    getServerCapabilities: () => ({ resources: {}, prompts: {} }),
    getServerVersion: () => ({ name: "fixture", version: "1" }),
    listResources: async () => ({
      resources: [{ uri: "resource://allowed", name: "Allowed" }],
    }),
    listPrompts: async () => ({ prompts: [{ name: "summary" }] }),
    readResource: vi.fn(async () => ({
      contents: [{ uri: "resource://allowed", text: "Bearer synthetic-token" }],
    })),
    getPrompt: vi.fn(async () => ({ messages: [] })),
  };
  const r: any = Object.create(McpRegistry.prototype);
  r.connect = async () => ({
    client,
    profile: { name: "fixture" },
    controller: new AbortController(),
  });
  return { r, client };
}
it("refuses unlisted resource URIs before contacting the resource method", async () => {
  const { r, client } = registry();
  await expect(
    r.inspect({ signal: new AbortController().signal }, "x", {
      kind: "resource",
      name: "file:///private",
    }),
  ).rejects.toMatchObject({ code: "forbidden" });
  expect(client.readResource).not.toHaveBeenCalled();
});
it("reads an explicitly listed resource and sanitizes reflected Bearer values", async () => {
  const { r } = registry();
  const result = await r.inspect(
    { signal: new AbortController().signal },
    "x",
    { kind: "resource", name: "resource://allowed" },
  );
  expect(JSON.stringify(result)).not.toContain("synthetic-token");
});
it("does not publish a listed prompt response after revocation", async () => {
  const { r, client } = registry();
  const c = new AbortController();
  client.getPrompt.mockImplementation(async () => {
    c.abort();
    return { messages: [] };
  });
  await expect(
    r.inspect({ signal: c.signal }, "x", { kind: "prompt", name: "summary" }),
  ).rejects.toBeDefined();
});
