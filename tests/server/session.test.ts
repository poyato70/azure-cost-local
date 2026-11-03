import { describe, it, expect } from "vitest";
import { SessionStore } from "../../src/server/auth/session-store.js";
import { buildApp } from "../../src/server/app.js";
import { ArmHttp } from "../../src/server/azure/http.js";
describe("local boundary", () => {
  it("sets an HttpOnly callback-compatible cookie and requires CSRF for changes", async () => {
    const app = await buildApp();
    const boot = await app.inject({
      url: "/api/bootstrap",
      headers: { host: "localhost:4317" },
    });
    const cookie = String(boot.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(boot.json()).not.toHaveProperty("accessToken");
    const without = await app.inject({
      method: "POST",
      url: "/api/config",
      headers: { host: "localhost:4317", cookie: cookie.split(";")[0] },
      payload: {
        tenantId: "11111111-1111-4111-8111-111111111111",
        clientId: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(without.statusCode).toBe(403);
    const valid = await app.inject({
      method: "POST",
      url: "/api/config",
      headers: {
        host: "localhost:4317",
        cookie: cookie.split(";")[0],
        "x-csrf-token": boot.json().csrf,
      },
      payload: {
        tenantId: "11111111-1111-4111-8111-111111111111",
        clientId: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(valid.statusCode).toBe(200);
    await app.close();
  });
  it("refuses external Host and Origin and requires session", async () => {
    const app = await buildApp();
    expect(
      (
        await app.inject({
          url: "/api/subscriptions",
          headers: { host: "localhost:4317" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ url: "/api/health", headers: { host: "evil.test" } }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { host: "localhost:4317", origin: "https://evil.test" },
        })
      ).statusCode,
    ).toBe(403);
    await app.close();
  });
  it("invalidates session and aborts work on logout", () => {
    const store = new SessionStore();
    const id = store.create("user", "tenant");
    const session = store.get(id)!;
    store.remove(id);
    expect(store.get(id)).toBeUndefined();
    expect(session.controller.signal.aborted).toBe(true);
  });
  it("cancels upstream calls when the browser disconnects", async () => {
    const store = new SessionStore(),
      id = store.create("user", "tenant");
    let started!: () => void, aborted!: () => void;
    const start = new Promise<void>((r) => (started = r)),
      stop = new Promise<void>((r) => (aborted = r));
    const http = new ArmHttp(
      async () => "test",
      async (_url, options) => {
        started();
        return new Promise<Response>((_resolve, reject) => {
          options!.signal!.addEventListener(
            "abort",
            () => {
              aborted();
              reject(new Error("aborted"));
            },
            { once: true },
          );
        });
      },
    );
    const config = {
      port: 4317,
      origin: "http://localhost:4317",
      tenantId: "tenant",
      clientId: "",
    };
    const app = await buildApp({ store, http, config });
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    config.port = Number(new URL(address).port);
    const controller = new AbortController();
    const pending = fetch(address + "/api/subscriptions", {
      headers: { cookie: "sid=" + id },
      signal: controller.signal,
    }).catch(() => {});
    try {
      await start;
      controller.abort();
      await stop;
      expect(controller.signal.aborted).toBe(true);
    } finally {
      controller.abort();
      await pending;
      await app.close();
    }
  });
});
