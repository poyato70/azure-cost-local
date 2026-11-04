import { assertArmChatScope } from "../../src/server/mcp/arm-policy.js";
import { it, expect } from "vitest";
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
