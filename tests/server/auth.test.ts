import { it, expect } from "vitest";
import {
  LoginFlows,
  MicrosoftIdentity,
} from "../../src/server/auth/msal-provider.js";
import { SessionStore } from "../../src/server/auth/session-store.js";
import { buildApp } from "../../src/server/app.js";
import { createHash } from "node:crypto";
import { authError } from "../../src/server/auth/auth-errors.js";
it("retains safe MSAL and Node cause identifiers outside the old whitelist", () => {
  expect(
    authError({
      errorCode: "token_parsing_error",
      message: "code=private-value",
    }).message,
  ).toContain("token_parsing_error");
  expect(
    authError({
      name: "TypeError",
      cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
      message: "https://private.test?code=secret",
    }).message,
  ).toContain("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
  expect(
    authError({ errorCode: "https://private.test?code=secret" }).message,
  ).not.toContain("private.test");
});
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
it("reports token exchange configuration errors without leaking the upstream payload", async () => {
  const store = new SessionStore();
  const identity = new MicrosoftIdentity(store, {
    tenantId: "tenant",
    clientId: "client",
    origin: "http://localhost:4317",
    port: 4317,
  });
  const id = store.create("", "tenant");
  const flow = identity.flows.start(id);
  store.get(id)!.pca = {
    acquireTokenByCode: async () => {
      throw {
        errorCode: "invalid_client",
        errorMessage:
          "AADSTS7000218: client_secret required. code=synthetic-private-value",
      };
    },
  } as any;
  await expect(
    identity.finish(id, flow.state, "synthetic-code"),
  ).rejects.toMatchObject({
    code: "auth_configuration",
    status: 400,
    message: expect.stringContaining("AADSTS7000218"),
  });
  try {
    const f = identity.flows.start(id);
    await identity.finish(id, f.state, "synthetic-code");
  } catch (e) {
    expect((e as Error).message).not.toContain("synthetic-private-value");
    expect((e as Error).message).toContain("desktop");
  }
});
it("reports network failures without copying URLs or credentials", async () => {
  const store = new SessionStore(),
    id = store.create("", "tenant");
  const identity = new MicrosoftIdentity(store, {
    tenantId: "tenant",
    clientId: "client",
    origin: "http://localhost:4317",
    port: 4317,
  });
  const f = identity.flows.start(id);
  store.get(id)!.pca = {
    acquireTokenByCode: async () => {
      throw {
        errorCode: "post_request_failed",
        errorMessage: "private-url?code=do-not-echo",
      };
    },
  } as any;
  await expect(
    identity.finish(id, f.state, "synthetic-code"),
  ).rejects.toMatchObject({
    code: "auth_network",
    message: expect.stringContaining("conexão"),
  });
});
it("redirects failed callbacks to dashboard and only exposes safe error text", async () => {
  const app = await buildApp();
  const r = await app.inject({
    url: "/api/auth/callback?state=synthetic-state&code=synthetic-secret",
    headers: { host: "localhost:4317" },
  });
  expect(r.statusCode).toBe(302);
  expect(r.headers.location).toBe("/auth/complete");
  expect(r.body).not.toContain("synthetic-secret");
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  const b = await app.inject({
    url: "/api/bootstrap",
    headers: { host: "localhost:4317", cookie },
  });
  expect(b.json().loginError.message).toContain("Login expirado");
  expect(JSON.stringify(b.json())).not.toContain("synthetic-secret");
  await app.close();
});
