import { it, expect } from "vitest";
import { mcpHubRows } from "../../src/server/hubs/results.js";
it("accepts Azure MCP CommandResponse results.items and rejects failed command status", () => {
  expect(
    mcpHubRows({
      status: 200,
      results: { items: [{ BilledCost: "42.1", BillingCurrency: "BRL" }] },
    }),
  ).toEqual([{ BilledCost: "42.1", BillingCurrency: "BRL" }]);
  expect(() => mcpHubRows({ status: 500, results: { items: [] } })).toThrow();
});
