import { z } from "zod";

export const azureAiUsageQuery = z
  .object({
    resourceId: z
      .string()
      .regex(
        /^\/subscriptions\/[a-f0-9-]{36}\/resourceGroups\/[\p{L}\p{N}_.() -]{1,90}\/providers\/Microsoft\.CognitiveServices\/accounts\/[a-z0-9-]{2,64}$/iu,
      ),
    from: z.iso.date(),
    toExclusive: z.iso.date(),
  })
  .strict()
  .refine(({ resourceId }) => ![".", ".."].includes(resourceId.split("/")[4]), {
    message: "Informe um grupo de recursos válido.",
  })
  .refine(
    ({ from, toExclusive }) => {
      const days = (Date.parse(toExclusive) - Date.parse(from)) / 86400000;
      return days > 0 && days <= 30;
    },
    { message: "Informe um período de 1 a 30 dias." },
  );

export function normalizeAzureAiUsage(payload: any) {
  const names = ["ProcessedPromptTokens", "GeneratedTokens"];
  return names.map((metric) => {
    const entry = Array.isArray(payload?.value)
      ? payload.value.find((value: any) => value?.name?.value === metric)
      : undefined;
    const points = new Map<string, number>();
    for (const series of Array.isArray(entry?.timeseries)
      ? entry.timeseries
      : []) {
      for (const point of Array.isArray(series?.data) ? series.data : []) {
        if (
          typeof point?.timeStamp !== "string" ||
          typeof point.total !== "number" ||
          !Number.isFinite(point.total)
        )
          continue;
        points.set(
          point.timeStamp,
          (points.get(point.timeStamp) ?? 0) + point.total,
        );
      }
    }
    return {
      metric,
      total: points.size
        ? [...points.values()].reduce((total, amount) => total + amount, 0)
        : null,
      points: [...points]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, tokens]) => ({ time, tokens })),
    };
  });
}
