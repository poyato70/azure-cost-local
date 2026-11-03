import { it, expect, vi } from "vitest";
import { HubService } from "../../src/server/hubs/service.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import { fetchBound } from "../../src/server/security/endpoint-policy.js";
vi.mock("../../src/server/security/endpoint-policy.js", () => ({
  validateEndpoint: async (u: string) => ({ url: new URL(u) }),
  fetchBound: vi.fn(),
}));
const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  subscriptionId: "22222222-2222-4222-8222-222222222222",
  resourceGroup: "rg-test",
};
const hub = {
  id: "h",
  accessId: "a",
  transport: "api",
  endpoint: "https://test.westeurope.kusto.windows.net",
  database: "Hub",
  schemaVersion: "v1_2",
  configurationVersion: 1,
};
function fixture() {
  const snapshot: any = {
    accessProfiles: [{ id: "a", configurationVersion: 1 }],
    mcpProfiles: [],
    agentProfiles: [],
    hubProfiles: [hub],
  };
  const store: any = { read: async () => snapshot };
  const gate = new Invalidation(store),
    token = vi.fn(async () => "synthetic");
  const costs = vi.fn(async () => ({
    basis: "ActualCost",
    rows: [],
    totals: [{ currency: "BRL", amount: "1" }],
    meta: { status: "complete" },
  }));
  const service = new HubService(
    store,
    gate,
    { getToken: token } as any,
    {} as any,
    {
      inventory: { authorize: async () => {} },
      costs: { queryCosts: costs },
    } as any,
  );
  const ctx = {
    accessId: "a",
    sessionId: "s",
    userId: "u",
    tenantId: scope.tenantId,
    signal: new AbortController().signal,
  };
  return { service, gate, ctx, token, costs, store };
}
function response() {
  return new Response(
    JSON.stringify({
      Tables: [
        {
          TableName: "PrimaryResult",
          Columns: [
            "Month",
            "BillingCurrency",
            "BilledCost",
            "EffectiveCost",
            "Records",
          ].map((ColumnName) => ({ ColumnName })),
          Rows: [["2026-09-01T00:00:00Z", "BRL", "1.02", "0.81", 1]],
        },
      ],
    }),
  );
}
it("queries a bound cluster and preserves monetary strings with explicit period", async () => {
  vi.mocked(fetchBound).mockResolvedValueOnce(response());
  const f = fixture();
  const r = await f.service.run(
    f.ctx,
    "h",
    scope,
    "ActualCost",
    "costs",
    new Date("2026-11-03"),
  );
  expect(r.totals).toEqual([{ currency: "BRL", amount: "1.02" }]);
  expect(r.meta.status).toBe("partial");
  expect(f.token).toHaveBeenCalledWith(expect.anything(), hub.endpoint);
  const req = vi.mocked(fetchBound).mock.calls.at(-1)!;
  expect(req[0]).toBe(hub.endpoint + "/v1/rest/query");
  expect(JSON.parse(req[1]!.body as string).csl).toContain("rg-test");
});
it("rejects another identity before acquiring a token", async () => {
  const f = fixture();
  await expect(
    f.service.run({ ...f.ctx, accessId: "other" }, "h", scope, "ActualCost"),
  ).rejects.toMatchObject({ code: "forbidden" });
  expect(f.token).not.toHaveBeenCalled();
});
it("rejects an in-flight result after hub changes", async () => {
  const f = fixture();
  let release!: (r: Response) => void;
  vi.mocked(fetchBound).mockImplementationOnce(
    () => new Promise((r) => (release = r)),
  );
  const p = f.service.run(
    f.ctx,
    "h",
    scope,
    "ActualCost",
    "costs",
    new Date("2026-11-03"),
  );
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  f.gate.changed("hub:h");
  release(response());
  await expect(p).rejects.toMatchObject({ code: "unauthenticated" });
});
it("keeps Hub results when Cost Management fails and does not fallback silently", async () => {
  const f = fixture();
  f.costs.mockRejectedValueOnce(new Error("synthetic"));
  vi.mocked(fetchBound).mockResolvedValueOnce(response());
  const r = await f.service.run(
    f.ctx,
    "h",
    scope,
    "ActualCost",
    "reconcile",
    new Date("2026-11-03"),
  );
  expect(r.hub.totals[0].amount).toBe("1.02");
  expect(r.comparison.status).toBe("partial");
});
it("returns unavailable datasets without inventing zero utilization", async () => {
  const f = fixture();
  vi.mocked(fetchBound).mockResolvedValue(
    new Response("failure", { status: 403 }),
  );
  const r = await f.service.run(
    f.ctx,
    "h",
    scope,
    "ActualCost",
    "savingsPlans",
  );
  expect(r.utilization).toBeNull();
  expect(r.datasets.every((d: any) => d.status === "unavailable")).toBe(true);
});

it("rejects a profile read before a concurrent revision change before network", async () => {
  const f = fixture();
  let reads = 0;
  f.store.read = async () => ({
    accessProfiles: [{ id: "a", configurationVersion: 1 }],
    mcpProfiles: [],
    agentProfiles: [],
    hubProfiles: [{ ...hub, configurationVersion: ++reads === 1 ? 1 : 2 }],
  });
  await expect(
    f.service.run(f.ctx, "h", scope, "ActualCost"),
  ).rejects.toMatchObject({ code: "configuration_changed" });
  expect(f.token).not.toHaveBeenCalled();
});
it("preserves ARM when Hub fails during reconciliation", async () => {
  const f = fixture();
  vi.mocked(fetchBound).mockResolvedValueOnce(
    new Response("", { status: 403 }),
  );
  const r = await f.service.run(
    f.ctx,
    "h",
    scope,
    "ActualCost",
    "reconcile",
    new Date("2026-11-03"),
  );
  expect(r.arm.totals[0].amount).toBe("1");
  expect(r.comparison.status).toBe("partial");
});
