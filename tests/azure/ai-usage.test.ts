import { describe, expect, it } from "vitest";
import {
  azureAiUsageQuery,
  normalizeAzureAiUsage,
} from "../../src/server/azure/ai-usage.js";
import {
  parseAzureAiResourceId,
  validateAzureAiUsagePeriod,
} from "../../src/shared/azure-ai-usage.js";

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

describe("Azure AI resource input guidance", () => {
  const resourceId =
    "/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/rg-openai/providers/Microsoft.CognitiveServices/accounts/openai-prod";

  it("accepts an exact Resource ID and extracts only a recognized Azure portal resource route", () => {
    expect(parseAzureAiResourceId(resourceId)).toMatchObject({
      resourceId,
      extractedFromPortal: false,
    });
    expect(
      parseAzureAiResourceId(
        "https://portal.azure.com/#@example.onmicrosoft.com/resource" +
          resourceId +
          "/overview",
      ),
    ).toMatchObject({ resourceId, extractedFromPortal: true });
  });

  it("rejects arbitrary portal pages, other hosts, and encoded path separators", () => {
    expect(
      parseAzureAiResourceId("https://portal.azure.com/#view/HubsExtension"),
    ).toMatchObject({ error: expect.stringContaining("Não encontrei") });
    expect(
      parseAzureAiResourceId(
        "https://attacker.example/#resource" + resourceId + "/overview",
      ),
    ).toMatchObject({ error: expect.stringContaining("portal.azure.com") });
    expect(
      parseAzureAiResourceId(
        "https://portal.azure.com/#resource%2Fsubscriptions" +
          resourceId.slice("/subscriptions".length) +
          "/overview",
      ),
    ).toMatchObject({ error: expect.stringContaining("portal.azure.com") });
  });

  it("validates UTC intervals as start-inclusive and end-exclusive, up to 30 days", () => {
    expect(validateAzureAiUsagePeriod("2026-11-01", "2026-12-01")).toBeUndefined();
    expect(validateAzureAiUsagePeriod("2026-11-01", "2026-12-02")).toContain(
      "30 dias",
    );
    expect(validateAzureAiUsagePeriod("2026-11-02", "2026-11-01")).toContain(
      "posterior",
    );
    expect(validateAzureAiUsagePeriod("2026-02-30", "2026-03-01")).toContain(
      "datas válidas",
    );
  });
});
