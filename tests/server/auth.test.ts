import { it, expect } from "vitest";
import { LoginFlows } from "../../src/server/auth/msal-provider.js";
import { createHash } from "node:crypto";
it("binds PKCE to single-use state, session and expiration", () => {
  const flows = new LoginFlows();
  const f = flows.start("session");
  expect(f.challenge).toBe(
    createHash("sha256").update(f.verifier).digest("base64url"),
  );
  expect(() => flows.consume(f.state, "other")).toThrow();
  const next = flows.start("session");
  expect(flows.consume(next.state, "session").verifier).toBe(next.verifier);
  expect(() => flows.consume(next.state, "session")).toThrow();
});
