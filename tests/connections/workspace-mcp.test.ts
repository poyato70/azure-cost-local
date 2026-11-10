import { expect, it } from "vitest";
import { mcpInput } from "../../src/shared/connections.js";
import { capability } from "../../src/server/mcp/presets.js";
import {
  descriptor,
  reviewable,
  authorizeTool,
} from "../../src/server/mcp/tool-policy.js";

it("accepts independent HTTP MCPs without an Azure access", () => {
  const p = mcpInput.parse({
    name: "OpenShift",
    preset: "kubernetes",
    transport: "http",
    authMode: "bearer",
    endpoint: "https://mcp.example.net/mcp",
  });
  expect(p.accessId).toBeUndefined();
  expect(capability(p).status).toBe("pending");
});
it("requires explicit schema approval and read hints for custom tools", () => {
  const t = descriptor({
    name: "inspect_namespace",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
  });
  const p: any = {
    preset: "custom",
    resourceContext: {},
    approvedTools: [{ name: t.name, schemaHash: t.schemaHash }],
  };
  expect(reviewable(p, t)).toBe(true);
  expect(() => authorizeTool(p, t, {})).not.toThrow();
  expect(reviewable(p, { ...t, annotations: { readOnlyHint: false } })).toBe(
    false,
  );
  expect(() => authorizeTool(p, { ...t, schemaHash: "changed" }, {})).toThrow();
});
it("never makes a destructive hinted tool eligible", () => {
  const p: any = { preset: "custom" };
  expect(
    reviewable(
      p,
      descriptor({
        name: "inspect",
        annotations: { readOnlyHint: true, destructiveHint: true },
      }),
    ),
  ).toBe(false);
});
