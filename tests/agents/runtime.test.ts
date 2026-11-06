import { it, expect } from "vitest";
import { runAgentLoop } from "../../src/server/agents/runtime.js";
it("runs tool calls locally and feeds verified results back to the model", async () => {
  let turns = 0,
    calls = 0;
  const output: any[] = [];
  await runAgentLoop(
    {
      complete: async (input) => {
        turns++;
        return turns === 1
          ? { toolCalls: [{ id: "x", name: "azure_query", arguments: "{}" }] }
          : {
              text: "Resultado consultado",
              toolCalls: [],
              usage: { inputTokens: 12, outputTokens: 4 },
            };
      },
    },
    [
      {
        name: "azure_query",
        description: "costs",
        parameters: { type: "object" },
        call: async () => {
          calls++;
          return { amount: "42" };
        },
      },
    ],
    {
      message: "custos",
      instructions: "read only",
      limits: { toolCalls: 2, timeoutMs: 3000, responseChars: 1000 },
    },
    new AbortController().signal,
    () => {},
    (e) => output.push(e),
  );
  expect(calls).toBe(1);
  expect(turns).toBe(2);
  expect(output.find((e) => e.type === "text")?.text).toBe(
    "Resultado consultado",
  );
  expect(output.find((e) => e.type === "usage")).toMatchObject({
    inputTokens: 12,
    outputTokens: 4,
    toolCalls: 1,
  });
  expect(output.some((e) => e.type === "progress")).toBe(true);
});
it("rejects arbitrary tools and enforces call budgets", async () => {
  await expect(
    runAgentLoop(
      {
        complete: async () => ({
          toolCalls: [{ id: "x", name: "shell", arguments: "{}" }],
        }),
      },
      [],
      {
        message: "test",
        instructions: "",
        limits: { toolCalls: 1, timeoutMs: 3000, responseChars: 1000 },
      },
      new AbortController().signal,
      () => {},
      () => {},
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
});
