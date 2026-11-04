import { it, expect } from "vitest";
import { ForecastService } from "../../src/server/forecast/service.js";
const ctx = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  sessionId: "s",
  userId: "u",
  signal: new AbortController().signal,
};
const q = {
  scope: {
    tenantId: ctx.tenantId,
    subscriptionId: "22222222-2222-4222-8222-222222222222",
  },
  basis: "ActualCost" as const,
  includeActual: true,
  period: {
    from: "2026-11-01",
    toExclusive: "2026-12-01",
    timeZone: "America/Sao_Paulo" as const,
  },
};
it("separates actual and forecast per currency and sends an exclusive end", async () => {
  let body: any;
  const s = new ForecastService({
    request: async (_c: any, _p: any, b: any) => {
      body = b;
      return {
        properties: {
          columns: ["Cost", "UsageDate", "CostStatus", "Currency"].map(
            (name) => ({ name }),
          ),
          rows: [
            ["0.1", 20261101, "Actual", "BRL"],
            ["0.2", 20261105, "Forecast", "BRL"],
            ["3", 20261105, "Forecast", "USD"],
          ],
        },
      };
    },
  } as any);
  const r = await s.query(ctx, q);
  expect(r.forecastTotals).toEqual([
    { currency: "BRL", amount: "0.2" },
    { currency: "USD", amount: "3" },
  ]);
  expect(r.actualTotals).toEqual([{ currency: "BRL", amount: "0.1" }]);
  expect(body.timePeriod.to).toBe("2026-11-30T23:59:59Z");
  expect(r.meta.warnings.length).toBeGreaterThan(0);
});
it("does not call missing data zero or infer an unknown status", async () => {
  const s = new ForecastService({ request: async () => ({}) } as any);
  expect((await s.query(ctx, q)).meta.status).toBe("unavailable");
  const bad = new ForecastService({
    request: async () => ({
      properties: {
        columns: ["Cost", "UsageDate", "CostStatus", "Currency"].map(
          (name) => ({ name }),
        ),
        rows: [["3", 20261105, "Unknown", "USD"]],
      },
    }),
  } as any);
  await expect(bad.query(ctx, q)).rejects.toMatchObject({
    code: "forecast_schema",
  });
});
it("rejects external pagination before touching that endpoint", async () => {
  let calls = 0;
  const s = new ForecastService({
    request: async () => {
      calls++;
      return { properties: { rows: [], nextLink: "https://evil.example" } };
    },
  } as any);
  const r = await s.query(ctx, q);
  expect(calls).toBe(1);
  expect(r.meta.status).toBe("partial");
});
