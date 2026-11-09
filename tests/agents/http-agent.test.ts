import { it, expect, vi } from "vitest";
import { HttpAgentClient } from "../../src/server/agents/http-agent.js";
import { LocalAgentRuntime } from "../../src/server/agents/runtime.js";
import { fetchBound } from "../../src/server/security/endpoint-policy.js";
vi.mock("../../src/server/security/endpoint-policy.js", () => ({
  fetchBound: vi.fn(),
}));
const agent: any = {
  id: "agent-1",
  name: "Corporativo",
  provider: "http-agent-v1",
  endpoint: "https://agent.example",
  modelCredential: { kind: "none" },
  allowedAccessIds: ["access-1"],
  mcpConnectionIds: [],
  limits: { timeoutMs: 3000, responseChars: 2000 },
};
it("does not expose arbitrary upstream error bodies", async () => {
  vi.mocked(fetchBound).mockResolvedValueOnce(
    new Response("Bearer secret-token internal-person@example.com", {
      status: 500,
    }),
  );
  await expect(
    new HttpAgentClient(agent, {} as any).ask(
      "oi",
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({
    message:
      "O agente HTTP respondeu HTTP 500. Consulte o administrador do endpoint com o horário da tentativa.",
  });
});
it("cancels a revoked HTTP agent and never emits its stale answer", async () => {
  let controller: AbortController | undefined;
  const unwatch = vi.fn();
  const gate: any = {
    capture: vi.fn(async () => ({})),
    watch: vi.fn((_v, c) => {
      controller = c;
      return unwatch;
    }),
    assertCurrent: vi.fn(async () => {}),
  };
  vi.mocked(fetchBound).mockReset();
  vi.mocked(fetchBound).mockResolvedValueOnce(
    new Response(JSON.stringify({ id: "thread-1" })),
  );
  vi.mocked(fetchBound).mockImplementationOnce(async () => {
    controller?.abort();
    return new Response(JSON.stringify({ resposta: "stale" }));
  });
  const events: any[] = [];
  const runtime = new LocalAgentRuntime(
    {} as any,
    {} as any,
    {} as any,
    gate,
    {} as any,
  );
  await expect(
    runtime.ask(
      { accessId: "access-1", signal: new AbortController().signal } as any,
      agent,
      {
        message: "oi",
        basis: "ActualCost",
        selection: { accessId: "access-1", source: "api" },
      },
      (e) => events.push(e),
    ),
  ).rejects.toBeDefined();
  expect(gate.watch).toHaveBeenCalled();
  expect(events.some((e) => e.type === "text")).toBe(false);
  expect(unwatch).toHaveBeenCalled();
});
