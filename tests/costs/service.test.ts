import { it, expect } from "vitest";
import {
  lastCompleteMonths,
  previousPeriod,
} from "../../src/server/costs/periods.js";
import {
  totals,
  compareCosts,
  AzureCosts,
} from "../../src/server/costs/service.js";
import { ArmHttp } from "../../src/server/azure/http.js";
it("resolves complete months in Sao Paulo including leap and year boundaries", () => {
  expect(lastCompleteMonths(new Date("2026-11-01T12:00Z"), 2)).toMatchObject({
    from: "2026-09-01",
    toExclusive: "2026-11-01",
  });
  expect(lastCompleteMonths(new Date("2026-11-01T01:00Z"), 2)).toMatchObject({
    from: "2026-08-01",
    toExclusive: "2026-10-01",
  });
  expect(lastCompleteMonths(new Date("2024-03-01T12:00Z"), 1)).toMatchObject({
    from: "2024-02-01",
    toExclusive: "2024-03-01",
  });
  expect(lastCompleteMonths(new Date("2026-01-01T12:00Z"), 2)).toMatchObject({
    from: "2025-11-01",
    toExclusive: "2026-01-01",
  });
  expect(
    previousPeriod({
      from: "2026-09-01",
      toExclusive: "2026-11-01",
      timeZone: "America/Sao_Paulo",
    }),
  ).toMatchObject({ from: "2026-07-01", toExclusive: "2026-09-01" });
});
it("adds decimals per currency and does not divide by zero", () => {
  expect(
    totals([
      { amount: "0.1", currency: "USD" },
      { amount: "0.2", currency: "USD" },
      { amount: "4", currency: "BRL" },
    ]),
  ).toEqual([
    { currency: "USD", amount: "0.3" },
    { currency: "BRL", amount: "4" },
  ]);
  expect(
    compareCosts(
      { totals: [{ currency: "USD", amount: "2" }] } as any,
      { totals: [{ currency: "USD", amount: "0" }] } as any,
    )[0].percent,
  ).toBeNull();
});
it("suppresses comparisons against incomplete data", () => {
  expect(
    compareCosts(
      {
        meta: { status: "complete" },
        totals: [{ currency: "USD", amount: "100" }],
      } as any,
      {
        meta: { status: "partial" },
        totals: [{ currency: "USD", amount: "5" }],
      } as any,
    ),
  ).toEqual([]);
});
it("refuses off-origin pagination before sending a credential", async () => {
  let calls = 0;
  const http = new ArmHttp(
    async () => "secret",
    async () => {
      calls++;
      return Response.json({
        value: [{ id: "ok" }],
        nextLink: "https://evil.test/steal",
      });
    },
  );
  const result = await http.list({} as any, "/subscriptions?api-version=x");
  expect(calls).toBe(1);
  expect(result.partial).toBe(true);
  expect(result.items).toHaveLength(1);
});
it("honors Retry-After, stops after three attempts and preserves forbidden", async () => {
  const waits: number[] = [];
  let calls = 0;
  const http = new ArmHttp(
    async () => "secret",
    async () => {
      calls++;
      return new Response("", { status: 429, headers: { "Retry-After": "2" } });
    },
    async (ms) => {
      waits.push(ms);
    },
  );
  await expect(http.request({} as any, "/subscriptions")).rejects.toMatchObject(
    { code: "throttled" },
  );
  expect(calls).toBe(3);
  expect(waits).toEqual([2000, 2000]);
  const denied = new ArmHttp(
    async () => "secret",
    async () => new Response("", { status: 403 }),
  );
  await expect(
    denied.request({} as any, "/subscriptions"),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("maps cost columns by name and sends inclusive last day, with isolated cache", async () => {
  let calls = 0;
  let body: any;
  const http = new ArmHttp(
    async () => "secret",
    async (_u, o) => {
      calls++;
      body = JSON.parse(o!.body as string);
      return Response.json({
        properties: {
          columns: [
            { name: "Currency" },
            { name: "ServiceName" },
            { name: "Cost" },
            { name: "UsageDate" },
          ],
          rows: [
            ["USD", "Compute", 0.1, 20260901],
            ["USD", "Compute", 0.2, 20260902],
          ],
        },
      });
    },
  );
  const costs = new AzureCosts(http);
  const controller = new AbortController();
  const ctx = {
    sessionId: "a",
    userId: "u",
    tenantId: "t",
    signal: controller.signal,
  };
  const query = {
    scope: { tenantId: "t", subscriptionId: "s" },
    period: {
      from: "2026-09-01",
      toExclusive: "2026-11-01",
      timeZone: "America/Sao_Paulo",
    },
    basis: "ActualCost",
    groupBy: "ServiceName",
    granularity: "Daily",
  } as any;
  expect((await costs.queryCosts(ctx, query)).totals[0].amount).toBe("0.3");
  expect(body.timePeriod.to).toBe("2026-10-31T23:59:59Z");
  await costs.queryCosts(ctx, query);
  expect(calls).toBe(1);
  await costs.queryCosts({ ...ctx, sessionId: "b" }, query);
  expect(calls).toBe(2);
  controller.abort();
  await expect(costs.queryCosts(ctx, query)).rejects.toBeDefined();
});
