import { it, expect } from "vitest";
import { RegistryDiscovery } from "../../src/server/mcp/discovery.js";
it("queries the official registry and exposes real transports without auto trusting or installing", async () => {
  let url = "";
  const discovery = new RegistryDiscovery(async (u: any) => {
    url = String(u);
    return new Response(
      JSON.stringify({
        servers: [
          {
            server: {
              name: "com.microsoft/azure",
              version: "3.0.0",
              description: "Azure",
              packages: [
                {
                  registryType: "npm",
                  identifier: "@azure/mcp",
                  version: "3.0.0",
                  transport: { type: "stdio" },
                },
              ],
            },
            _meta: {
              "io.modelcontextprotocol.registry/official": {
                status: "active",
                isLatest: true,
              },
            },
          },
        ],
        metadata: { nextCursor: "opaque:cursor" },
      }),
    );
  });
  const result = await discovery.search(
    { query: "com.microsoft/azure" },
    new AbortController().signal,
  );
  expect(url).toContain("version=latest");
  expect(result.servers[0].packages[0].transport).toBe("stdio");
  expect(result.nextCursor).toBe("opaque:cursor");
});
it("refuses unbounded input and handles registry failure clearly", async () => {
  const discovery = new RegistryDiscovery(
    async () => new Response("unavailable", { status: 503 }),
  );
  await expect(
    discovery.search({ query: "azure" }, new AbortController().signal),
  ).rejects.toMatchObject({ code: "registry_unavailable" });
});
