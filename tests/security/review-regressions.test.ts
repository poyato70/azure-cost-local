import { it, expect, vi } from "vitest";
import { httpAudience } from "../../src/server/mcp/presets.js";
import { IdentityProvider } from "../../src/server/auth/identity-provider.js";
import { SessionStore } from "../../src/server/auth/session-store.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { AgentService } from "../../src/server/agents/service.js";
vi.mock("../../src/server/security/endpoint-policy.js", () => ({
  validateEndpoint: async (url: string) => ({ url: new URL(url) }),
}));
it("binds downstream Microsoft tokens to official MCP endpoints", () => {
  expect(() =>
    httpAudience({
      preset: "azure",
      endpoint: "https://outside.example",
      audience: "https://management.azure.com",
    }),
  ).toThrow();
  expect(() =>
    httpAudience({ preset: "fabric", endpoint: "https://outside.example" }),
  ).toThrow();
  expect(
    httpAudience({
      preset: "azure",
      endpoint: "https://outside.example",
      audience: "api://11111111-1111-4111-8111-111111111111",
    }),
  ).toContain("api://");
});
it("invalidates the authenticated session when its saved access changes", async () => {
  const access = {
    id: "a",
    tenantId: "t",
    clientId: "c",
    configurationVersion: 1,
  };
  const store = {
    read: async () => ({
      accessProfiles: [access],
      mcpProfiles: [],
      agentProfiles: [],
    }),
  } as any;
  const sessions = new SessionStore(),
    id = sessions.create("", "");
  const gate = new Invalidation(store);
  const provider = new IdentityProvider(
    { token: async () => "synthetic" } as any,
    { get: async () => access } as any,
    gate,
    sessions,
    {} as any,
    {} as any,
  );
  await provider.connectApplication(id, "a");
  const signal = sessions.get(id)!.controller.signal;
  gate.changed("access:a");
  expect(signal.aborted).toBe(true);
  expect(sessions.get(id)!.userId).toBe("");
});
it("rejects delegated MCP from application and unbound sessions before token acquisition", async () => {
  const profile = {
    id: "m",
    preset: "fabric",
    transport: "http",
    authMode: "delegated",
    accessId: "a",
  };
  const registry = new McpRegistry(
    { read: async () => ({ mcpProfiles: [profile] }) } as any,
    {} as any,
    { get: async () => ({ id: "a", tenantId: "t" }) } as any,
    {} as any,
    {} as any,
  );
  const ctx = {
    sessionId: "s",
    userId: "u",
    tenantId: "t",
    accessId: "a",
    principalKind: "application",
    signal: new AbortController().signal,
  } as const;
  await expect(registry.connect(ctx, "m")).rejects.toMatchObject({
    code: "forbidden",
  });
  await expect(
    registry.connect(
      { ...ctx, accessId: undefined, principalKind: "user" },
      "m",
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
});
it("requires key replacement when changing model origin", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const old = {
    id,
    name: "test",
    provider: "azure-chat-v1",
    endpoint: "https://old.openai.azure.com",
    model: "test",
    modelCredential: { kind: "apiKey", secretRef: "protected" },
    configurationVersion: 1,
    allowedAccessIds: [],
  };
  const snapshot = {
    agentProfiles: [old],
    accessProfiles: [],
    mcpProfiles: [],
  };
  const service = new AgentService(
    { mutate: async (fn: any) => fn(snapshot) } as any,
    {} as any,
    {} as any,
  );
  const { configurationVersion, ...fields } = old;
  await expect(
    service.save({
      ...fields,
      modelCredential: { kind: "apiKey" },
      endpoint: "https://new.openai.azure.com",
      expectedVersion: 1,
    }),
  ).rejects.toMatchObject({ code: "credential_binding" });
});
