import { it, expect } from "vitest";
import { assertApiSelection } from "../../src/server/connections/data-provider.js";
it("does not silently replace unavailable MCP costs with REST", () => {
  expect(() =>
    assertApiSelection({ source: "mcp", accessId: "a", mcpConnectionId: "m" }),
  ).toThrow(/MCP/);
  expect(() =>
    assertApiSelection({ source: "api", accessId: "a" }),
  ).not.toThrow();
});
