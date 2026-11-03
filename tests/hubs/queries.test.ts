import { it, expect } from "vitest";
import { buildHubQuery } from "../../src/server/hubs/queries.js";
import { reconcile } from "../../src/server/hubs/reconcile.js";
const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  subscriptionId: "22222222-2222-4222-8222-222222222222",
  resourceGroup: "rg-test",
};
const period = {
  from: "2026-09-01",
  toExclusive: "2026-11-01",
  timeZone: "America/Sao_Paulo" as const,
};
it("fixes scope, exclusive period and currencies in the registered query", () => {
  const q = buildHubQuery("costs", scope, period);
  expect(q).toContain("Costs_v1_2()");
  expect(q).toContain("rg-test");
  expect(q).toContain("BillingCurrency");
  expect(q).toContain("< datetime(2026-11-01)");
  expect(() =>
    buildHubQuery("costs", { ...scope, resourceGroup: "x'); evil" }, period),
  ).toThrow();
});
it("does not certify unknown coverage or merge currencies", () => {
  const h = {
    totals: [{ currency: "BRL", amount: "10" }],
    meta: { status: "complete" },
    coverageConfirmed: false,
  };
  const a = {
    totals: [{ currency: "USD", amount: "10" }],
    meta: { status: "complete" },
  };
  const r = reconcile(h as any, a as any);
  expect(r.status).toBe("not_comparable");
  expect(r.rows).toHaveLength(2);
  expect(r.rows[0].difference).toBeNull();
});
it("preserves decimal differences and zero denominator", () => {
  const result = (amount: string) => ({
    totals: [{ currency: "BRL", amount }],
    meta: { status: "complete" },
  });
  const r = reconcile(
    { ...result("0.02"), coverageConfirmed: true } as any,
    result("0") as any,
  );
  expect(r.rows[0].difference).toBe("0.02");
  expect(r.rows[0].percent).toBeNull();
  expect(r.status).toBe("not_comparable");
});
