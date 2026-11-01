import { it, expect } from "vitest";
import { normalizeRecommendation } from "../../src/server/benefits/service.js";
it("preserves official terms and unknown currencies without claiming simulation", () => {
  const r = normalizeRecommendation(
    {
      properties: {
        term: "P1Y",
        recommendationDetails: { savingsAmount: 20, coveragePercentage: 50 },
      },
    },
    "savingsPlan",
  );
  expect(r.source).toBe("official");
  expect(r.currency).toBeNull();
  expect(r.estimatedSavings).toBe("20");
  expect(r.coverage).toBe(50);
});
it("handles modern monetary objects and preserves product identity", () => {
  const r = normalizeRecommendation(
    {
      id: "rec1",
      location: "brazilsouth",
      sku: "Standard_D4s_v5",
      properties: {
        term: "P1Y",
        recommendedQuantity: 3,
        netSavings: { value: 50, currency: "BRL" },
        costWithNoReservedInstances: { value: 100, currency: "BRL" },
        totalCostWithReservedInstances: { value: 50, currency: "BRL" },
      },
    },
    "reservation",
  );
  expect(r.estimatedSavings).toBe("50");
  expect(r.currency).toBe("BRL");
  expect(r.costWithout).toBe("100");
  expect(r.costWith).toBe("50");
  expect(r.sku).toBe("Standard_D4s_v5");
  expect(r.location).toBe("brazilsouth");
  expect(r.quantity).toBe("3");
  expect(r.id).toBe("rec1");
});
