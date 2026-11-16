import { assertArmChatScope, authorizeArmScope } from "../../src/server/mcp/arm-policy.js";
import { it, expect } from "vitest";
import { buildAzureResourceGraphQuery } from "../../src/server/finops/azure-arm-mcp-adapter.js";
import { httpAudience, capability } from "../../src/server/mcp/presets.js";
import { authorizeTool, descriptor } from "../../src/server/mcp/tool-policy.js";
import { resourceScopes } from "../../src/server/auth/resource-scopes.js";
const endpoint = "https://mcp.management.azure.com",
  audience = "api://22bfbae3-f4e7-485f-be43-8cee15065084";
it("pins ARM endpoint and requests its exact delegated scope", () => {
  expect(httpAudience({ preset: "arm", endpoint } as any)).toBe(audience);
  expect(() =>
    httpAudience({ preset: "arm", endpoint: "https://evil.example" } as any),
  ).toThrow();
  expect(resourceScopes(audience)).toEqual([audience + "/MCP.Access"]);
  expect(
    capability({
      preset: "arm",
      transport: "http",
      authMode: "application",
    } as any).status,
  ).toBe("unsupported");
});
it("accepts only read operations at the configured ARM scope", () => {
  const scope =
    "/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/rg-test";
  const t = descriptor({
    name: "query_costs",
    inputSchema: { type: "object" },
  });
  const p: any = {
    preset: "arm",
    resourceContext: { scope },
    approvedTools: [t],
  };
  expect(() =>
    authorizeTool(p, t, { request: { scope, groupBy: ["ServiceName"] } }),
  ).not.toThrow();
  expect(() =>
    authorizeTool(p, t, { scope: "/subscriptions/other" }),
  ).toThrow();
  expect(() => authorizeTool(p, t, {})).toThrow();
  const write = descriptor({ name: "create_budget", inputSchema: {} });
  expect(() =>
    authorizeTool({ ...p, approvedTools: [write] }, write, { scope }),
  ).toThrow();
});

it("binds the chat selection to the ARM scope", () => {
  expect(() =>
    assertArmChatScope("/subscriptions/11111111-1111-4111-8111-111111111111", {
      tenantId: "t",
      subscriptionId: "11111111-1111-4111-8111-111111111111",
      resourceGroup: "other",
    }),
  ).toThrow();
});

it("allows only the bounded server-generated Resource Graph query", () => {
  const scope = "/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/rg-test";
  const query = buildAzureResourceGraphQuery(scope);
  expect(() => authorizeArmScope(scope, { query })).not.toThrow();
  expect(() => authorizeArmScope(scope, { query: `${query} | take 10` })).toThrow();
  expect(() => authorizeArmScope(scope, { query, options: { "$top": 251 } })).toThrow();
  expect(() => authorizeArmScope(scope, { query, uri: "https://example.invalid" })).toThrow();
});

it("marks execute_query reviewable for ARM and keeps its execution bound to the current approved schema", () => {
  const scope = "/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/rg-test";
  const t = descriptor({ name: "execute_query", inputSchema: { type: "object", properties: { query: { type: "string" } } } });
  const p: any = { preset: "arm", resourceContext: { scope }, approvedTools: [{ name: t.name, schemaHash: t.schemaHash }] };
  expect(() => authorizeTool(p, t, { query: buildAzureResourceGraphQuery(scope) })).not.toThrow();
  expect(() => authorizeTool({ ...p, approvedTools: [] }, t, { query: buildAzureResourceGraphQuery(scope) })).toThrow(/não aprovada/);
  const unknown = descriptor({ name: "execute_query_custom", inputSchema: {} });
  expect(() => authorizeTool({ ...p, approvedTools: [unknown] }, unknown, { query: "Resources" })).toThrow(/não aprovada/);
});
