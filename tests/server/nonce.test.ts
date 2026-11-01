import { it, expect } from "vitest";
import { MicrosoftIdentity } from "../../src/server/auth/msal-provider.js";
import { SessionStore } from "../../src/server/auth/session-store.js";
it("passes the original nonce to MSAL during code exchange and rotates the session", async () => {
  const store = new SessionStore(),
    identity = new MicrosoftIdentity(store, {
      tenantId: "tenant",
      clientId: "client",
      port: 4317,
      origin: "http://localhost:4317",
    }),
    id = store.create("", "tenant");
  const flow = identity.flows.start(id);
  let request: any;
  store.get(id)!.pca = {
    acquireTokenByCode: async (input: any) => {
      request = input;
      if (input.nonce !== flow.nonce) throw { errorCode: "nonce_mismatch" };
      return {
        account: { homeAccountId: "user" },
        tenantId: "tenant",
        idTokenClaims: { nonce: flow.nonce },
      };
    },
  } as any;
  const nextId = await identity.finish(id, flow.state, "synthetic-code");
  expect(request.nonce).toBe(flow.nonce);
  expect(request.codeVerifier).toBe(flow.verifier);
  expect(store.get(id)).toBeUndefined();
  expect(store.get(nextId)?.userId).toBe("user");
});
it("continues to reject a token with a different nonce", async () => {
  const store = new SessionStore(),
    identity = new MicrosoftIdentity(store, {
      tenantId: "tenant",
      clientId: "client",
      port: 4317,
      origin: "http://localhost:4317",
    }),
    id = store.create("", "tenant");
  const flow = identity.flows.start(id);
  store.get(id)!.pca = {
    acquireTokenByCode: async () => ({
      account: { homeAccountId: "user" },
      tenantId: "tenant",
      idTokenClaims: { nonce: "wrong" },
    }),
  } as any;
  await expect(
    identity.finish(id, flow.state, "synthetic-code"),
  ).rejects.toMatchObject({ code: "unauthenticated" });
  expect(store.get(id)?.userId).toBe("");
});
