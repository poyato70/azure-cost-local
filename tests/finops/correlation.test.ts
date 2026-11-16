import { describe, expect, it } from "vitest";
import {
  correlateFinOps,
  projectFinOpsCostRows,
} from "../../src/server/finops/correlation.js";

const period = { from: "2026-10-01", toExclusive: "2026-11-01" };
const sources = {
  costs: {
    serverId: "mcp-costs",
    tool: "list_costs",
    executionId: "exec-costs",
  },
  inventory: {
    serverId: "mcp-inventory",
    tool: "list_resources",
    executionId: "exec-inventory",
  },
};

describe("correlateFinOps", () => {
  it("projects persisted cost rows to approved contract fields only", () => {
    const projected = projectFinOpsCostRows([
      cost(),
      { lineId: "bad-line", secret: "SHOULD_NOT_PERSIST", amount: "1e99" },
    ]);

    expect(projected[0]).toEqual(cost());
    expect(projected[1]).toEqual({ lineId: "bad-line" });
    expect(JSON.stringify(projected)).not.toContain("SHOULD_NOT_PERSIST");
  });

  it("associates exact provider-scope-resource identities and sums decimal lines", () => {
    const result = correlateFinOps({
      correlationId: "correlation-001",
      requestedPeriod: period,
      requestedScope: "scope-a",
      sources,
      costRows: [
        {
          lineId: "line-001",
          provider: "synthetic",
          scope: "scope-a",
          resourceId: "vm-01",
          period,
          currency: "USD",
          amount: "0.10",
          classification: "usage",
          evidenceRef: "cost://line-001",
        },
        {
          lineId: "line-002",
          provider: "synthetic",
          scope: "scope-a",
          resourceId: "vm-01",
          period,
          currency: "USD",
          amount: "0.20",
          classification: "usage",
          evidenceRef: "cost://line-002",
        },
      ],
      inventoryRows: [
        {
          inventoryId: "inv-001",
          provider: "synthetic",
          scope: "scope-a",
          resourceId: "vm-01",
          canonicalResourceId: "vm-01",
          resourceType: "compute",
          name: "Demo VM",
          evidenceRef: "inventory://inv-001",
        },
      ],
    });

    expect(result.associations).toHaveLength(1);
    expect(result.associations[0]).toMatchObject({
      provider: "synthetic",
      scope: "scope-a",
      resourceId: "vm-01",
      normalizedResourceId: "vm-01",
      inventoryIds: ["inv-001"],
      costLineIds: ["line-001", "line-002"],
      currency: "USD",
      amount: "0.3",
      period,
    });
    expect(result.totals).toEqual([{ currency: "USD", amount: "0.3", period }]);
  });
});

const cost = (values: Record<string, unknown> = {}) => ({
  lineId: "line-default",
  provider: "synthetic",
  scope: "scope-a",
  resourceId: "vm-01",
  period,
  currency: "USD",
  amount: "1.00",
  classification: "usage",
  evidenceRef: "cost://line-default",
  ...values,
});
const resource = (values: Record<string, unknown> = {}) => ({
  inventoryId: "inv-default",
  provider: "synthetic",
  scope: "scope-a",
  resourceId: "vm-01",
  resourceType: "compute",
  name: "Demo VM",
  evidenceRef: "inventory://inv-default",
  ...values,
});
const run = (costRows: unknown[], inventoryRows: unknown[]) =>
  correlateFinOps({
    correlationId: "correlation-test",
    requestedPeriod: period,
    requestedScope: "scope-a",
    sources,
    costRows,
    inventoryRows,
  });

describe("correlateFinOps discrepancy handling", () => {
  it("rejects cost rows outside the requested scope before adding totals", () => {
    const result = run(
      [cost({ scope: "scope-other", amount: "999.00" })],
      [resource()],
    );

    expect(result.totals).toEqual([]);
    expect(result.invalidCosts).toContainEqual({
      rowIndex: 0,
      lineId: "line-default",
      reason: "scope_mismatch",
    });
  });
  it("does not associate case-different or cross-scope resource IDs", () => {
    const result = run(
      [cost({ amount: "2.00" })],
      [
        resource({ scope: "scope-b", inventoryId: "inv-other-scope" }),
        resource({ resourceId: "VM-01", inventoryId: "inv-case-diff" }),
      ],
    );

    expect(result.associations).toEqual([]);
    expect(result.unassociated).toMatchObject([
      { costLineIds: ["line-default"], reason: "no_exact_identity" },
    ]);
    expect(result.totals).toEqual([{ currency: "USD", amount: "2", period }]);
  });

  it("marks duplicate inventory identities as ambiguous instead of choosing one", () => {
    const result = run(
      [cost({ amount: "4.25" })],
      [
        resource({ inventoryId: "inv-a", name: "First candidate" }),
        resource({ inventoryId: "inv-b", name: "Second candidate" }),
      ],
    );

    expect(result.associations).toEqual([]);
    expect(result.ambiguous).toMatchObject([
      {
        costLineIds: ["line-default"],
        inventoryIds: ["inv-a", "inv-b"],
        amount: "4.25",
        reason: "multiple_exact_identities",
      },
    ]);
    expect(result.totals).toEqual([
      { currency: "USD", amount: "4.25", period },
    ]);
  });

  it("keeps shared costs in totals without assigning them to a resource", () => {
    const result = run(
      [cost({ resourceId: null, classification: "shared", amount: "3.75" })],
      [resource()],
    );

    expect(result.nonAllocatable).toMatchObject([
      { costLineIds: ["line-default"], amount: "3.75", currency: "USD" },
    ]);
    expect(result.associations).toEqual([]);
    expect(result.totals).toEqual([
      { currency: "USD", amount: "3.75", period },
    ]);
  });

  it("includes explicit credits as negative Decimal amounts", () => {
    const result = run(
      [
        cost({ lineId: "charge", amount: "10.10" }),
        cost({ lineId: "credit", amount: "-0.30", classification: "credit" }),
      ],
      [resource()],
    );

    expect(result.totals).toEqual([{ currency: "USD", amount: "9.8", period }]);
    expect(result.associations).toMatchObject([
      { amount: "9.8", costLineIds: ["charge", "credit"] },
    ]);
  });

  it("deduplicates identical cost line IDs before aggregation", () => {
    const row = cost({ amount: "0.50" });
    const result = run([row, { ...row }], [resource()]);

    expect(result.duplicates).toMatchObject([
      { lineId: "line-default", kind: "exact_duplicate", occurrences: 2 },
    ]);
    expect(result.associations).toMatchObject([
      { amount: "0.5", costLineIds: ["line-default"] },
    ]);
    expect(result.totals).toEqual([{ currency: "USD", amount: "0.5", period }]);
  });

  it("excludes conflicting duplicate line IDs from totals", () => {
    const result = run(
      [cost({ amount: "1.00" }), cost({ amount: "2.00" })],
      [resource()],
    );

    expect(result.invalidCosts).toMatchObject([
      { lineId: "line-default", reason: "conflicting_duplicate_line_id" },
    ]);
    expect(result.associations).toEqual([]);
    expect(result.totals).toEqual([]);
  });

  it("reports the original row index for conflicting duplicate line IDs", () => {
    const result = run(
      [
        cost({ lineId: "other" }),
        cost({ amount: "2.00" }),
        cost({ amount: "3.00" }),
      ],
      [resource()],
    );

    expect(result.invalidCosts).toContainEqual({
      lineId: "line-default",
      rowIndex: 1,
      reason: "conflicting_duplicate_line_id",
    });
  });

  it("retains source row indexes when invalid cost rows precede duplicate conflicts", () => {
    const result = run(
      [
        cost({ amount: "bad" }),
        cost({ amount: "2.00" }),
        cost({ amount: "3.00" }),
      ],
      [resource()],
    );

    expect(result.invalidCosts).toContainEqual({
      lineId: "line-default",
      rowIndex: 1,
      reason: "conflicting_duplicate_line_id",
    });
  });

  it("matches only a source-declared canonical ID and preserves both IDs", () => {
    const result = run(
      [cost({ resourceId: "canonical-vm" })],
      [
        resource({
          resourceId: "inventory-local-7",
          canonicalResourceId: "canonical-vm",
        }),
      ],
    );

    expect(result.associations[0]).toMatchObject({
      resourceId: "canonical-vm",
      normalizedResourceId: "canonical-vm",
      rule: "exact-provider-scope-source-canonical-id",
      resources: [
        {
          resourceId: "inventory-local-7",
          canonicalResourceId: "canonical-vm",
        },
      ],
    });
  });

  it("separates currencies and rejects cost lines outside the requested period", () => {
    const result = run(
      [
        cost({ lineId: "usd", amount: "10.10" }),
        cost({ lineId: "eur", currency: "EUR", amount: "5.25" }),
        cost({
          lineId: "old-period",
          period: { from: "2026-09-01", toExclusive: "2026-10-01" },
          amount: "99.00",
        }),
      ],
      [resource(), resource({ inventoryId: "inv-eur", resourceId: "vm-01" })],
    );

    expect(result.totals).toEqual([
      { currency: "EUR", amount: "5.25", period },
      { currency: "USD", amount: "10.1", period },
    ]);
    expect(result.invalidCosts).toMatchObject([
      { lineId: "old-period", reason: "period_mismatch" },
    ]);
  });

  it("reports invalid monetary values without including them in totals", () => {
    const result = run([cost({ amount: "not-money" })], [resource()]);

    expect(result.invalidCosts).toMatchObject([
      { lineId: "line-default", reason: "invalid_cost_row" },
    ]);
    expect(result.totals).toEqual([]);
  });

  it("lists inventory resources with no associated valid cost rows", () => {
    const result = run(
      [cost({ resourceId: "vm-01" })],
      [
        resource(),
        resource({ inventoryId: "inv-unused", resourceId: "vm-02" }),
      ],
    );

    expect(result.inventoryWithoutCosts).toMatchObject([
      { inventoryId: "inv-unused", resourceId: "vm-02", name: "Demo VM" },
    ]);
  });

  it("includes execution provenance and both original source references", () => {
    const result = run([cost()], [resource()]);

    expect(result.provenance).toEqual({
      correlationId: "correlation-test",
      costs: sources.costs,
      inventory: sources.inventory,
      matchingRule:
        "exact-provider-scope-resource-id-or-source-declared-canonical-id",
    });
    expect(result.associations[0].evidenceRefs).toEqual([
      "cost://line-default",
      "inventory://inv-default",
    ]);
  });
});
