import { it, expect } from "vitest";
import {
  executeQuestionTool,
  restrictedSessionConfig,
  ensureQuestionScope,
} from "../../src/server/chat/tools.js";
const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  subscriptionId: "22222222-2222-4222-8222-222222222222",
  resourceGroup: "rg-a",
};
it("pins tools to selected scope and asks for missing scope rather than choosing", async () => {
  const calls: any[] = [];
  const services = {
    costs: {
      queryCosts: async (_c: any, q: any) => {
        calls.push(q);
        return { totals: [{ currency: "USD", amount: "42" }] };
      },
    },
    inventory: { authorize: async () => {} },
  } as any;
  const ctx = {
    tenantId: scope.tenantId,
    signal: new AbortController().signal,
  } as any;
  await expect(
    executeQuestionTool(services, ctx, undefined, "ActualCost", {
      operation: "costs",
    }),
  ).rejects.toMatchObject({ code: "invalid_request" });
  const r = await executeQuestionTool(
    services,
    ctx,
    scope,
    "ActualCost",
    { operation: "costs" },
    new Date("2026-11-01T12:00Z"),
  );
  expect(r.totals[0].amount).toBe("42");
  expect(calls[0].scope).toEqual(scope);
  expect(calls[0].period.from).toBe("2026-09-01");
  await expect(
    executeQuestionTool(
      services,
      { ...ctx, tenantId: "other" },
      scope,
      "ActualCost",
      { operation: "costs" },
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("clarifies resource group intent when only subscription is selected", () => {
  expect(() =>
    ensureQuestionScope(
      "Quanto gastei no resource group nos dois últimos meses?",
      { ...scope, resourceGroup: undefined },
    ),
  ).toThrow(/Selecione/);
  expect(() =>
    ensureQuestionScope("Quanto gastei nesta subscription?", {
      ...scope,
      resourceGroup: undefined,
    }),
  ).not.toThrow();
});
it("excludes all builtins, discovery and refuses permission requests", async () => {
  const cfg = restrictedSessionConfig([]);
  expect(cfg.availableTools).toEqual(["custom:azure_query"]);
  expect(cfg.excludedTools).toContain("builtin:*");
  expect(cfg.enableConfigDiscovery).toBe(false);
  expect(await cfg.onPermissionRequest!({} as any, {} as any)).toMatchObject({
    kind: "reject",
  });
});
