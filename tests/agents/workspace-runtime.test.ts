import { it, expect, vi } from "vitest";
import { LocalAgentRuntime } from "../../src/server/agents/runtime.js";
import { ModelProvider } from "../../src/server/agents/model-provider.js";
it("runs an explicitly linked independent MCP agent without Azure and includes pinned knowledge", async () => {
  const complete = vi
    .spyOn(ModelProvider.prototype, "complete")
    .mockResolvedValue({ text: "Namespace confirmado", toolCalls: [] });
  const capture = vi.fn(async (keys: string[]) => ({}));
  const mcps: any = {
    get: async () => ({ preset: "kubernetes", name: "OpenShift" }),
    tools: async () => [
      {
        name: "namespaces_list",
        inputSchema: { type: "object" },
        approved: true,
        reviewable: true,
      },
    ],
  };
  const knowledge: any = {
    context: vi.fn(
      async () => "Commit: " + "a".repeat(40) + "\nInforme a fonte.",
    ),
  };
  const runtime = new LocalAgentRuntime(
    {} as any,
    {} as any,
    {} as any,
    { capture, watch: () => () => {}, assertCurrent: async () => {} } as any,
    mcps,
    undefined,
    knowledge,
  );
  const agent: any = {
    id: "agent",
    name: "Analista",
    provider: "azure-chat-v1",
    model: "test",
    modelCredential: { kind: "apiKey" },
    instructions: "Leitura",
    allowedAccessIds: [],
    mcpConnectionIds: ["kube"],
    allowedTools: ["mcp:kube:namespaces_list"],
    knowledgeIds: ["skill"],
    limits: { timeoutMs: 2000, toolCalls: 1, responseChars: 1000 },
  };
  try {
    await runtime.ask(
      {
        sessionId: "local",
        tenantId: "",
        userId: "",
        signal: new AbortController().signal,
      } as any,
      agent,
      {
        message: "Liste namespaces",
        basis: "ActualCost",
        selection: {
          accessId: "00000000-0000-4000-8000-000000000000",
          source: "mcp",
          mcpConnectionId: "kube",
        },
      },
      () => {},
    );
    expect(capture.mock.calls[0][0]).not.toContain("access:undefined");
    expect(JSON.stringify(complete.mock.calls[0][0])).toContain("a".repeat(40));
    expect(knowledge.context).toHaveBeenCalledWith(["skill"]);
  } finally {
    complete.mockRestore();
  }
});
