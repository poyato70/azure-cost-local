import { it, expect } from "vitest";
import {
  authorizeTool,
  descriptor,
  validateQuery,
} from "../../src/server/mcp/tool-policy.js";
import { capability } from "../../src/server/mcp/presets.js";
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
