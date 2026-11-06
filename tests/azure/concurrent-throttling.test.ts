import { it, expect, vi } from "vitest";
import { ArmHttp } from "../../src/server/azure/http.js";
it("does not clear a live cooldown when an older concurrent request succeeds", async () => {
  const ctx = {
    sessionId: "s",
    tenantId: "t",
    userId: "u",
    signal: new AbortController().signal,
  };
  let finish!: (r: Response) => void;
  const later = new Promise<Response>((r) => (finish = r));
  let calls = 0;
  const http = new ArmHttp(
    async () => "secret",
    async () =>
      ++calls === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "45" } })
        : later,
  );
  const first = http.request(
    ctx,
    "/subscriptions/sub/providers/Microsoft.CostManagement/query",
    {},
  );
  const second = http.request(
    ctx,
    "/subscriptions/sub/providers/Microsoft.CostManagement/query",
    {},
  );
  await expect(first).rejects.toMatchObject({ code: "throttled" });
  finish(Response.json({ ok: true }));
  await second;
  await expect(
    http.request(
      ctx,
      "/subscriptions/sub/providers/Microsoft.CostManagement/query",
      {},
    ),
  ).rejects.toMatchObject({ code: "throttled" });
  expect(calls).toBe(2);
});
it("preserves a longer cooldown when a concurrent 429 returns a shorter delay", async () => {
  const ctx = {
    sessionId: "s",
    tenantId: "t",
    userId: "u",
    signal: new AbortController().signal,
  };
  let finish!: (r: Response) => void;
  const later = new Promise<Response>((r) => (finish = r));
  let calls = 0;
  const http = new ArmHttp(
    async () => "secret",
    async () =>
      ++calls === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "45" } })
        : later,
  );
  const first = http.request(
    ctx,
    "/subscriptions/sub/providers/Microsoft.CostManagement/query",
    {},
  );
  const second = http.request(
    ctx,
    "/subscriptions/sub/providers/Microsoft.CostManagement/query",
    {},
  );
  await expect(first).rejects.toMatchObject({ code: "throttled" });
  finish(new Response("", { status: 429, headers: { "Retry-After": "8" } }));
  await expect(second).rejects.toThrow(/4[45] segundo/);
  await expect(
    http.request(
      ctx,
      "/subscriptions/sub/providers/Microsoft.CostManagement/query",
      {},
    ),
  ).rejects.toThrow(/4[45] segundo/);
  expect(calls).toBe(2);
});
