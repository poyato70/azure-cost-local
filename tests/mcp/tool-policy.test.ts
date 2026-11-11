import { it, expect } from "vitest";
import {
  authorizeTool,
  descriptor,
  safeToolResult,
  validateQuery,
} from "../../src/server/mcp/tool-policy.js";
import { capability } from "../../src/server/mcp/presets.js";
it("keeps a bounded Advisor summary when a large MCP response is clipped", () => {
  const recommendations = Array.from({ length: 40 }, () => ({
    properties: {
      impactedValue: "vmss-example",
      impact: "High",
      category: "HighAvailability",
      shortDescription: { solution: "x".repeat(4000) },
      extendedProperties: { secret: "unused-secret" },
    },
  }));
  const result = safeToolResult({
    content: [{ type: "text", text: JSON.stringify({ results: { recommendations } }) }],
  });
  expect(result.partial).toBe(true);
  expect(result.presentation).toMatchObject({ kind: "advisor", count: 40 });
  expect(result.presentation.items).toHaveLength(5);
  expect(result.presentation.items[0]).toMatchObject({
    title: "vmss-example",
    category: "HighAvailability",
    impact: "High",
  });
  expect(result.presentation.items[0].description).toHaveLength(320);
  expect(JSON.stringify(result.presentation)).not.toContain("unused-secret");
});
it("rejects hidden query stages and unbound workspace discovery", () => {
  expect(() =>
    validateQuery("T | take 1 | lookup OtherTable on Key", "adx"),
  ).toThrow();
  const t = descriptor({
    name: "list_workspaces",
    inputSchema: { type: "object" },
  });
  expect(() =>
    authorizeTool(
      {
        preset: "fabric",
        resourceContext: { workspaceId: "only-A" },
        approvedTools: [t],
      } as any,
      t,
      {},
    ),
  ).toThrow();
  expect(() =>
    authorizeTool(
      { preset: "azure", resourceContext: {}, approvedTools: [t] } as any,
      t,
      {},
    ),
  ).toThrow();
});
it("does not authorize writes or unknown tools from hints alone", () => {
  const p = { approvedTools: [], preset: "azure", resourceContext: {} } as any;
  expect(() =>
    authorizeTool(
      p,
      descriptor({
        name: "delete_everything",
        inputSchema: { type: "object" },
        annotations: { readOnlyHint: true },
      }),
      {},
    ),
  ).toThrow();
});
it("rejects external references and management commands in query templates", () => {
  expect(() => validateQuery(".drop table x", "adx")).toThrow();
  expect(() =>
    validateQuery("cluster('other').database('other').T | take 1", "adx"),
  ).toThrow();
  expect(() =>
    validateQuery('externaldata(a:string)[h"https://evil"]', "adx"),
  ).toThrow();
  expect(() => validateQuery("T | take 10", "adx")).not.toThrow();
  expect(() =>
    validateQuery("EVALUATE TOPN(10, Sales)", "powerbi"),
  ).not.toThrow();
});
it("does not claim unsupported auth modes as connected", () => {
  expect(
    capability({
      preset: "foundry",
      transport: "http",
      authMode: "application",
    } as any).status,
  ).toBe("unsupported");
  expect(
    capability({
      preset: "azure",
      transport: "stdio",
      authMode: "application",
    } as any).status,
  ).toBe("pending");
});
