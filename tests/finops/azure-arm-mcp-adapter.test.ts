import { describe, expect, it } from "vitest";
import {
  adaptAzureArmCostResult,
  adaptAzureArmInventoryResult,
  buildAzureCostQueryArguments,
  buildAzureInventoryArguments,
  buildAzureResourceGraphQuery,
  isBoundedAzureResourceGraphCall,
} from "../../src/server/finops/azure-arm-mcp-adapter.js";
import { correlateFinOps } from "../../src/server/finops/correlation.js";

const scope = "/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/finops-rg";
const resourceId = `${scope}/providers/Microsoft.Compute/virtualMachines/vm-01`;
const period = { from: "2026-10-01", toExclusive: "2026-11-01" };
const costSchema = {
  type: "object",
  properties: {
    scope: { type: "string" }, from: { type: "string" }, to: { type: "string" },
    groupBy: { type: "array", items: { type: "string", enum: ["ResourceId", "ServiceName"] } },
    metric: { type: "string", enum: ["ActualCost", "AmortizedCost"] },
    top: { type: "integer", minimum: 1, maximum: 5000 },
  },
  required: ["scope", "from", "to", "groupBy", "metric"],
};
const inventorySchema = {
  type: "object", properties: {
    query: { type: "string" },
    options: { type: "object", properties: { "$top": { type: "integer" }, "$skipToken": { type: "string" } } },
  }, required: ["query"],
};

describe("Azure ARM MCP FinOps contract adapter", () => {
  it("builds cost arguments from the currently discovered schema with exact scope, period, metric and bounded rows", () => {
    expect(buildAzureCostQueryArguments({ scope, period, metric: "ActualCost" }, costSchema)).toEqual({
      scope, from: period.from, to: period.toExclusive, groupBy: ["ResourceId"], metric: "ActualCost", top: 100,
    });
  });

  it("fails closed when the discovered contract cannot express the selected financial metric or resource identity", () => {
    expect(() => buildAzureCostQueryArguments({ scope, period, metric: "AmortizedCost" }, {
      ...costSchema, properties: { ...costSchema.properties, metric: { type: "string", enum: ["ActualCost"] } },
    })).toThrow(/métrica financeira/);
    expect(() => buildAzureCostQueryArguments({ scope, period, metric: "ActualCost" }, {
      ...costSchema, properties: { ...costSchema.properties, groupBy: { type: "string", enum: ["ServiceName"] } },
    })).toThrow(/ResourceId/);
    expect(() => buildAzureCostQueryArguments({ scope, period, metric: "ActualCost" }, {
      ...costSchema, properties: { ...costSchema.properties, metric: { type: "string" } },
    })).toThrow(/métrica financeira/);
  });

  it("generates one deterministic Resource Graph projection bound to subscription and resource group", () => {
    expect(buildAzureResourceGraphQuery(scope)).toBe(
      "Resources | where subscriptionId =~ '11111111-1111-4111-8111-111111111111' | where resourceGroup =~ 'finops-rg' | project id, name, type, location, resourceGroup, subscriptionId | order by id asc",
    );
    const args = buildAzureInventoryArguments(scope, inventorySchema);
    expect(args.options).toEqual({ "$top": 250 });
    expect(isBoundedAzureResourceGraphCall(scope, args)).toBe(true);
    expect(isBoundedAzureResourceGraphCall(scope, { ...args, query: `${args.query} | take 999` })).toBe(false);
    expect(isBoundedAzureResourceGraphCall(scope, { ...args, options: { "$top": 251 } })).toBe(false);
  });

  it("adapts a Cost Management Query API table without using binary floating point or guessing a source total", () => {
    const result = adaptAzureArmCostResult({
      payload: { properties: {
        columns: [{ name: "ResourceId", type: "String" }, { name: "PreTaxCost", type: "Number" }, { name: "Currency", type: "String" }],
        rows: [[resourceId, "10.10", "USD"]],
      } },
      scope, period, metric: "ActualCost", serverId: "arm-profile",
    });
    expect(result.status).toBe("complete");
    expect(result.reportedTotal).toBeUndefined();
    expect(result.rows[0]).toMatchObject({
      provider: "Azure", scope, amount: "10.1", currency: "USD", classification: "unclassified",
      period, resourceId: resourceId.toLowerCase(), originalResourceId: resourceId,
    });
  });

  it("matches Azure resource IDs case-insensitively while retaining the source spelling", () => {
    const upper = resourceId.toUpperCase();
    const costs = adaptAzureArmCostResult({
      payload: { rows: [{ resourceId: upper, amount: "3.25", currency: "USD" }] },
      scope, period, metric: "ActualCost", serverId: "arm-profile",
    });
    const inventory = adaptAzureArmInventoryResult({
      payload: { rows: [{ id: upper, name: "vm-01", type: "Microsoft.Compute/virtualMachines", resourceGroup: "FINOPS-RG", subscriptionId: "11111111-1111-4111-8111-111111111111" }] },
      scope, serverId: "arm-profile",
    });
    expect(costs.rows[0]).toMatchObject({ resourceId: resourceId.toLowerCase(), originalResourceId: upper });
    expect(inventory.rows[0]).toMatchObject({ resourceId: upper, canonicalResourceId: resourceId.toLowerCase() });
    const correlation = correlateFinOps({
      correlationId: "case-insensitive-azure-id", requestedScope: scope, requestedPeriod: period,
      sources: {
        costs: { serverId: "arm-profile", tool: "query_costs", executionId: "costs-1" },
        inventory: { serverId: "arm-profile", tool: "execute_query", executionId: "inventory-1" },
      }, costRows: costs.rows, inventoryRows: inventory.rows,
    });
    expect(correlation.associations).toHaveLength(1);
    expect(correlation.associations[0].normalizedResourceId).toBe(resourceId.toLowerCase());
    expect(correlation.associations[0].originalResourceIds).toEqual([upper]);
  });

  it("marks a continuation as partial and never claims the first page is a complete reconciliation", () => {
    const result = adaptAzureArmCostResult({
      payload: { rows: [{ resourceId, amount: "1.00", currency: "USD" }], nextLink: "opaque" },
      scope, period, metric: "ActualCost", serverId: "arm-profile",
    });
    expect(result.status).toBe("partial");
    expect(result.reasons.join(" ")).toMatch(/continuação ou truncamento/);
  });

  it("deduplicates identical grouped cost rows and rejects conflicting duplicates", () => {
    const make = (amount: string) => ({ rows: [
      { resourceId, amount: "1.00", currency: "USD" },
      { resourceId, amount, currency: "USD" },
    ] });
    const identical = adaptAzureArmCostResult({ payload: make("1.00"), scope, period, metric: "ActualCost", serverId: "arm-profile" });
    expect(identical.rows).toHaveLength(1);
    expect(identical.status).toBe("partial");
    expect(identical.reasons.join(" ")).toMatch(/duplicada exata/);
    const conflict = adaptAzureArmCostResult({ payload: make("2.00"), scope, period, metric: "ActualCost", serverId: "arm-profile" });
    expect(conflict.status).toBe("partial");
    expect(conflict.rejectedRows).toBe(1);
  });

  it("keeps malformed costs visible as invalid rows instead of silently dropping them", () => {
    const result = adaptAzureArmCostResult({
      payload: { rows: [{ resourceId, amount: "NaN", currency: "USD" }] },
      scope, period, metric: "ActualCost", serverId: "arm-profile",
    });
    expect(result.status).toBe("partial");
    expect(result.rejectedRows).toBe(1);
    expect(result.rows).toEqual([{ lineId: "azure-row-1" }]);
  });

  it("adapts only inventory inside the configured scope and identifies skipToken as partial", () => {
    const result = adaptAzureArmInventoryResult({
      payload: {
        data: [{ id: "/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/finops-rg/providers/Microsoft.Compute/virtualMachines/vm-01", name: "vm-01", type: "Microsoft.Compute/virtualMachines", location: "eastus", resourceGroup: "finops-rg", subscriptionId: "11111111-1111-4111-8111-111111111111" }],
        skipToken: "page-2",
      },
      scope, serverId: "arm-profile",
    });
    expect(result.status).toBe("partial");
    expect(result.rows[0]).toMatchObject({ provider: "Azure", scope, name: "vm-01", resourceId: expect.stringContaining("virtualMachines/vm-01") });
    expect(result.reasons.join(" ")).toMatch(/continuação ou truncamento/);
  });

  it("refuses an undocumented envelope rather than calling it an empty result", () => {
    expect(() => adaptAzureArmCostResult({ payload: { value: [] }, scope, period, metric: "ActualCost", serverId: "arm-profile" }))
      .toThrow(/contrato de linhas/);
    expect(() => adaptAzureArmInventoryResult({ payload: { value: [] }, scope, serverId: "arm-profile" }))
      .toThrow(/contrato de inventário/);
  });
});
