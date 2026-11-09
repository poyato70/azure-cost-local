import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { sanitizeEvidence } from "../multicloud/sanitize.js";
export async function readCatalog(client: Client, signal: AbortSignal) {
  const capabilities = client.getServerCapabilities() || {};
  async function list(kind: "prompts" | "resources") {
    if (!capabilities[kind]) return { status: "not_advertised", items: [] };
    const items: unknown[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    try {
      do {
        signal.throwIfAborted();
        const response =
          kind === "prompts"
            ? await client.listPrompts(cursor ? { cursor } : undefined, {
                signal,
                timeout: 15000,
              })
            : await client.listResources(cursor ? { cursor } : undefined, {
                signal,
                timeout: 15000,
              });
        items.push(...((response as any)[kind] || []));
        cursor = response.nextCursor;
        if (
          items.length > 100 ||
          seen.size >= 50 ||
          (cursor && seen.has(cursor))
        )
          return { status: "partial", items: items.slice(0, 100) };
        if (cursor) seen.add(cursor);
      } while (cursor);
      return { status: items.length ? "discovered" : "empty", items };
    } catch {
      signal.throwIfAborted();
      return {
        status: "error",
        items,
        message:
          "Falha na leitura do catálogo. Confira autenticação e implementação no servidor.",
      };
    }
  }
  const prompts = await list("prompts"),
    resources = await list("resources");
  return sanitizeEvidence({
    server: client.getServerVersion(),
    capabilities,
    prompts,
    resources,
  });
}
