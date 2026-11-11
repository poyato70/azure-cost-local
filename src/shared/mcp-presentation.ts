export type McpPresentation = {
  kind: "advisor" | "learn";
  count: number;
  items: {
    title?: string;
    description?: string;
    category?: string;
    impact?: string;
    language?: string;
    code?: string;
    link?: string;
  }[];
};

function boundedText(value: unknown, limit = 320) {
  return typeof value === "string" ? value.slice(0, limit) : undefined;
}

export function mcpPresentation(response: any): McpPresentation | undefined {
  const preview = response?.presentation;
  if (
    response?.partial === true &&
    (preview?.kind === "advisor" || preview?.kind === "learn") &&
    Number.isSafeInteger(preview.count) &&
    Array.isArray(preview.items) &&
    preview.count >= preview.items.length
  ) {
    return {
      kind: preview.kind,
      count: preview.count,
      items: preview.items.slice(0, 5).map((item: any) => ({
        title: boundedText(item?.title),
        category: boundedText(item?.category, 80),
        impact: boundedText(item?.impact, 80),
        description: boundedText(item?.description),
        language: boundedText(item?.language, 60),
        code: boundedText(item?.code, 550),
        link: boundedText(item?.link, 400),
      })),
    };
  }
  const payloads = [response?.structuredContent];
  for (const item of Array.isArray(response?.content) ? response.content : []) {
    if (item?.type !== "text" || typeof item.text !== "string") continue;
    try {
      payloads.push(JSON.parse(item.text));
    } catch {
      // Plain text stays in the technical response.
    }
  }
  for (const payload of payloads) {
    const recommendations = payload?.results?.recommendations;
    if (Array.isArray(recommendations)) {
      return {
        kind: "advisor",
        count: recommendations.length,
        items: recommendations.slice(0, 5).map((item) => {
          const properties = item?.properties;
          return {
            title: boundedText(properties?.impactedValue),
            category: boundedText(properties?.category, 80),
            impact: boundedText(properties?.impact, 80),
            description: boundedText(
              properties?.shortDescription?.solution ?? properties?.label,
            ),
            link: boundedText(properties?.learnMoreLink, 400),
          };
        }),
      };
    }
    const examples = payload?.results;
    if (
      Array.isArray(examples) &&
      examples.some((item) => typeof item?.codeSnippet === "string")
    ) {
      return {
        kind: "learn",
        count: examples.length,
        items: examples.slice(0, 5).map((item) => ({
          title: boundedText(item?.title, 160),
          description: boundedText(item?.description)
            ?.split("\n")[0]
            .replace(/^description:\s*/i, ""),
          language: boundedText(item?.language, 60),
          code: boundedText(item?.codeSnippet, 550),
          link: boundedText(item?.link ?? item?.url, 400),
        })),
      };
    }
  }
}
