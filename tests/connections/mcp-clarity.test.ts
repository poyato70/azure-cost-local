import { expect, it, vi } from "vitest";
import { manageRequest } from "../../src/web/api.js";
import { describeMcp } from "../../src/shared/mcp-info.js";
it("does not declare an empty DELETE body as JSON", async () => {
  const fetch = vi.fn(
    async (_url: any, _options?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  try {
    await manageRequest("/mcp-connections/test", "DELETE");
    expect(
      new Headers(fetch.mock.calls[0][1]?.headers).has("Content-Type"),
    ).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("distinguishes stdio communication from Azure OAuth and does not invent an HTTP endpoint", () => {
  const rows = describeMcp({
    preset: "azure",
    transport: "stdio",
    authMode: "application",
    resourceContext: { namespace: "advisor" },
  });
  expect(rows).toContainEqual(["Transporte", "stdio"]);
  expect(rows).toContainEqual(["Provider", "Microsoft Azure"]);
  expect(rows.find((r) => r[0] === "Endpoint MCP")?.[1]).toContain(
    "Sem endpoint HTTP",
  );
  expect(rows.find((r) => r[0] === "Autenticação Azure")?.[1]).toContain(
    "Client Credentials",
  );
  expect(rows.find((r) => r[0] === "Grupo de tools")?.[1]).toContain("advisor");
});
