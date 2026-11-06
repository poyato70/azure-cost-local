import { it, expect } from "vitest";
import { buildApp } from "../../src/server/app.js";
import { SessionStore } from "../../src/server/auth/session-store.js";
it("rejects a legacy MCP selection before making any API or model call", async () => {
  const store = new SessionStore(),
    sid = store.create("user", "11111111-1111-4111-8111-111111111111");
  const app = await buildApp({ store });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: {
        host: "localhost:4317",
        cookie: "sid=" + sid,
        "x-csrf-token": store.get(sid)!.csrf,
        "x-data-source": "mcp",
      },
      payload: {
        message: "Quais custos?",
        basis: "ActualCost",
        consent: true,
        runtime: "copilot",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("nenhuma consulta API");
  } finally {
    await app.close();
  }
});
