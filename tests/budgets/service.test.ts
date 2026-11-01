import { it, expect } from "vitest";
import { normalizeBudget } from "../../src/server/budgets/service.js";
it("uses currentSpend respecting budget filters; never substitutes subscription total", () => {
  const properties = {
    amount: 100,
    timePeriod: { startDate: "2026-01-01", endDate: "2027-01-01" },
    filter: { tags: { name: "team", values: ["a"] } },
    currentSpend: { amount: 25, unit: "USD" },
    notifications: { one: { threshold: 80 } },
  };
  const b = normalizeBudget({ id: "x", name: "team a", properties });
  expect(b.spent).toBe("25");
  expect(b.percent).toBe("25");
  expect(b.filters).toEqual(properties.filter);
  const absent = normalizeBudget({
    id: "x",
    properties: { ...properties, currentSpend: undefined },
  });
  expect(absent.spent).toBeNull();
  expect(absent.percent).toBeNull();
});
it("separates recurring spend cycle from overall budget validity", () => {
  const r = normalizeBudget({
    properties: {
      timeGrain: "Monthly",
      amount: 100,
      timePeriod: { startDate: "2026-01-01", endDate: "2030-01-01" },
      currentSpend: { amount: 25, unit: "USD" },
    },
  });
  expect(r.timeGrain).toBe("Monthly");
  expect(r.period.toExclusive).toBe("2030-01-01");
  expect(r.spent).toBe("25");
  expect(r.spendPeriodLabel).toContain("mensal");
  const billing = normalizeBudget({
    properties: { timeGrain: "BillingMonth", amount: 100 },
  });
  expect(billing.spendPeriodLabel).toContain("faturamento");
});
