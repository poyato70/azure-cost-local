import { it, expect, vi } from "vitest";
import { buildApp } from "../../src/server/app.js";
import { SessionStore } from "../../src/server/auth/session-store.js";
import { ModelProvider } from "../../src/server/agents/model-provider.js";
it("tests API-key inference from local session without Microsoft login", async () => {
  const store = new SessionStore(),
    sid = store.create("", "");
  const id = "11111111-1111-4111-8111-111111111111";
  const configStore: any = {
    root: "D:/DEV/FinOps/Tesseract/.superpowers/test-vault",
    read: async () => ({
      schemaVersion: 1,
      accessProfiles: [],
      mcpProfiles: [],
      agentProfiles: [
        {
          id,
          provider: "azure-chat-v1",
          name: "test",
          modelCredential: { kind: "apiKey" },
        },
      ],
    }),
  };
  const complete = vi
    .spyOn(ModelProvider.prototype, "complete")
    .mockResolvedValue({ text: "ok", toolCalls: [] });
  const app = await buildApp({ store, configStore });
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/agents/${id}/test-model`,
      headers: {
        host: "localhost:4317",
        cookie: "sid=" + sid,
        "x-csrf-token": store.get(sid)!.csrf,
      },
      payload: { consent: true },
    });
    expect(response.statusCode).toBe(200);
    expect(complete).toHaveBeenCalledOnce();
  } finally {
    await app.close();
    complete.mockRestore();
  }
});
