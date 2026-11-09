import { it, expect, vi } from "vitest";
import { buildApp } from "../../src/server/app.js";
import { SessionStore } from "../../src/server/auth/session-store.js";
import { ArmHttp } from "../../src/server/azure/http.js";
it("rejects MCP-selected budget tag reads before contacting Azure", async () => {
  const store = new SessionStore(),
    id = store.create("user", "11111111-1111-4111-8111-111111111111");
  const send = vi.fn();
  const app = await buildApp({
    store,
    http: new ArmHttp(async () => "synthetic", send),
  });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/budgets/locks",
      headers: {
        host: "localhost:4317",
        cookie: `sid=${id}`,
        "x-csrf-token": store.get(id)!.csrf,
        "x-data-source": "mcp",
      },
      payload: {
        scope: {
          tenantId: "11111111-1111-4111-8111-111111111111",
          subscriptionId: "22222222-2222-4222-8222-222222222222",
        },
        showAll: false,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
it("requires session and CSRF before any multicloud operation", async () => {
  const app = await buildApp();
  try {
    const q = {
      provider: "aws",
      profile: "default",
      from: "2026-09-01",
      toExclusive: "2026-11-01",
    };
    const denied = await app.inject({
      method: "POST",
      url: "/api/multicloud/query",
      headers: { host: "localhost:4317" },
      payload: q,
    });
    expect(denied.statusCode).toBe(401);
    const b = await app.inject({
      url: "/api/bootstrap",
      headers: { host: "localhost:4317" },
    });
    const cookie = String(b.headers["set-cookie"]).split(";")[0];
    const noCsrf = await app.inject({
      method: "POST",
      url: "/api/multicloud/query",
      headers: { host: "localhost:4317", cookie },
      payload: q,
    });
    expect(noCsrf.statusCode).toBe(403);
    const invalid = await app.inject({
      method: "POST",
      url: "/api/multicloud/query",
      headers: {
        host: "localhost:4317",
        cookie,
        "x-csrf-token": b.json().csrf,
      },
      payload: { ...q, profile: "../../credentials" },
    });
    expect(invalid.statusCode).toBe(400);
  } finally {
    await app.close();
  }
});
