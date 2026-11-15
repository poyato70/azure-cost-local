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
it("diagnoses AADSTS650052 with safe tenant, resource, app and correlation identifiers", () => {
  const result = authError(
    {
      errorCode: "invalid_client",
      errorMessage:
        'AADSTS650052: The app needs access to a service ("Azure Resource Manager MCP") that your organization has not enabled. Trace ID: 33333333-3333-4333-8333-333333333333 Correlation ID: 44444444-4444-4444-8444-444444444444. access_token=private-token',
    },
    {
      tenantId: "11111111-1111-4111-8111-111111111111",
      resourceName: "Azure Resource Manager MCP",
      resourceAppId: "22bfbae3-f4e7-485f-be43-8cee15065084",
    },
  );
  expect(result).toMatchObject({ code: "auth_resource_unavailable", status: 403 });
  expect(result.message).toContain("Tenant ID: 11111111-1111-4111-8111-111111111111");
  expect(result.message).toContain("Application ID do recurso: 22bfbae3-f4e7-485f-be43-8cee15065084");
  expect(result.message).toContain("Correlation ID: 44444444-4444-4444-8444-444444444444");
  expect(result.message).toContain("Trace ID: 33333333-3333-4333-8333-333333333333");
  expect(result.message).toContain("MCP.Access");
  expect(result.message).not.toContain("private-token");
  expect(result.message).not.toContain("organization");
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
