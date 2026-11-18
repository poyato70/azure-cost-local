import { describe, expect, it } from "vitest";
import type { CostResult } from "../../src/shared/contracts.js";
import {
  aggregateCostsByDate,
  aggregateCostsByDimension,
} from "../../src/shared/cost-presentation.js";

const result: CostResult = {
  meta: {
    scope: {
      tenantId: "11111111-1111-4111-8111-111111111111",
      subscriptionId: "22222222-2222-4222-8222-222222222222",
    },
    period: {
      from: "2026-10-01",
      toExclusive: "2026-11-01",
      timeZone: "America/Sao_Paulo",
    },
    source: "Azure Cost Management Query API",
    fetchedAt: "2026-11-18T12:00:00.000Z",
    status: "complete",
    warnings: [],
  },
  basis: "ActualCost",
  rows: [
    {
      date: "2026-10-01",
      dimension: "Compute",
      amount: "0.1",
      currency: "BRL",
    },
    {
      date: "2026-10-01",
      dimension: "Storage",
      amount: "0.2",
      currency: "BRL",
    },
    {
      date: "2026-10-02",
      dimension: "Compute",
      amount: "1.25",
      currency: "BRL",
    },
    { date: "2026-10-01", dimension: "Compute", amount: "99", currency: "USD" },
  ],
  totals: [
    { currency: "BRL", amount: "1.55" },
    { currency: "USD", amount: "99" },
  ],
};

describe("FinOps result presentation", () => {
  it("aggregates decimal values by day without mixing currencies", () => {
    expect(aggregateCostsByDate(result, "BRL")).toEqual([
      { date: "2026-10-01", amount: 0.3 },
      { date: "2026-10-02", amount: 1.25 },
    ]);
    expect(aggregateCostsByDate(result, "USD")).toEqual([
      { date: "2026-10-01", amount: 99 },
    ]);
  });

  it("aggregates dimensions using decimal arithmetic", () => {
    expect(aggregateCostsByDimension(result, "BRL")).toEqual([
      { dimension: "Compute", amount: "1.35" },
      { dimension: "Storage", amount: "0.2" },
    ]);
  });
});
