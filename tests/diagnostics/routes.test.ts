import { it, expect } from "vitest";
import { buildApp } from "../../src/server/app.js";
import { SessionStore } from "../../src/server/auth/session-store.js";
import { ArmHttp } from "../../src/server/azure/http.js";
it("records safe upstream Azure codes and isolates diagnostic readback by session", async () => {
  const store = new SessionStore(),
    sid = store.create("u", "11111111-1111-4111-8111-111111111111");
  const http = new ArmHttp(
    async () => "synthetic-token",
    async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "AuthorizationFailed",
            message: "Do not log this raw private provider message",
          },
        }),
        { status: 403 },
      ),
  );
  const app = await buildApp({ store, http });
  const headers = {
    host: "localhost:4317",
    cookie: "sid=" + sid,
    "x-csrf-token": store.get(sid)!.csrf,
  };
  try {
    await app.inject({
      method: "POST",
      url: "/api/budgets/query",
      headers,
      payload: {
        tenantId: "11111111-1111-4111-8111-111111111111",
        subscriptionId: "22222222-2222-4222-8222-222222222222",
      },
    });
    const r = await app.inject({ url: "/api/diagnostics", headers });
    expect(r.statusCode).toBe(200);
    expect(
      r
        .json()
        .some(
          (x: any) =>
            x.source === "Azure Resource Manager" && x.status === "403",
        ),
    ).toBe(true);
    expect(r.body).toContain("AuthorizationFailed");
    expect(r.body).not.toContain("synthetic-token");
    expect(r.body).not.toContain("raw private provider");
    const other = store.create("", "");
    const empty = await app.inject({
      url: "/api/diagnostics",
      headers: { host: "localhost:4317", cookie: "sid=" + other },
    });
    expect(empty.json()).toEqual([]);
  } finally {
    await app.close();
  }
});
