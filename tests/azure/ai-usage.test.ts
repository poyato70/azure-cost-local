import { describe, expect, it } from "vitest";
import {
  azureAiUsageQuery,
  normalizeAzureAiUsage,
} from "../../src/server/azure/ai-usage.js";

describe("Azure AI token usage", () => {
  it("keeps reported zero distinct from absent telemetry", () => {
    const [input, output] = normalizeAzureAiUsage({
      value: [
        {
          name: { value: "ProcessedPromptTokens" },
          timeseries: [
            { data: [{ timeStamp: "2026-11-10T00:00:00Z", total: 0 }] },
          ],
        },
      ],
    });
    expect(input.total).toBe(0);
    expect(output.total).toBeNull();
  });

  it("rejects ambiguous resource paths and ranges beyond 30 days", () => {
    const request = {
      resourceId:
        "/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/ai-test",
      from: "2026-11-01",
      toExclusive: "2026-11-11",
    };
    expect(azureAiUsageQuery.safeParse(request).success).toBe(true);
    expect(
      azureAiUsageQuery.safeParse({
        ...request,
        resourceId: request.resourceId.replace("rg-ai", ".."),
      }).success,
    ).toBe(false);
    expect(
      azureAiUsageQuery.safeParse({
        ...request,
        toExclusive: "2026-12-02",
      }).success,
    ).toBe(false);
  });
});
