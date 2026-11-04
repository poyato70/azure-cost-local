import { it, expect } from "vitest";
import { Diagnostics } from "../../src/server/diagnostics/service.js";
it("isolates sessions and bounds records without exposing token-shaped credentials", () => {
  const d = new Diagnostics();
  d.record("a", {
    source: "Login",
    operation: "callback",
    status: "error",
    detail:
      "Bearer synthetic-token access_token=secret code=authcode state=state",
  });
  expect(JSON.stringify(d.list("a"))).not.toContain("synthetic-token");
  expect(JSON.stringify(d.list("a"))).not.toContain("=secret");
  expect(d.list("b")).toEqual([]);
  for (let i = 0; i < 200; i++)
    d.record("a", {
      source: "MCP",
      operation: "list",
      status: "200",
      detail: String(i),
    });
  expect(d.list("a")).toHaveLength(150);
  d.clear("a");
  expect(d.list("a")).toEqual([]);
});
