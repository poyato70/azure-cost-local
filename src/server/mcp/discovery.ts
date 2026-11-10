import { z } from "zod";
import { fetchBound } from "../security/endpoint-policy.js";
import { AppError, assertActive } from "../errors.js";
export const registrySearch = z
  .object({
    query: z.string().trim().min(2).max(120),
    cursor: z.string().max(2048).optional(),
  })
  .strict();
const publicUrl = (v: unknown) => {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" && !u.username && !u.password && !u.hash
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
};
export class RegistryDiscovery {
  constructor(private fetcher: typeof fetchBound = fetchBound) {}
  async search(raw: unknown, signal: AbortSignal) {
    const input = registrySearch.parse(raw),
      url = new URL("https://registry.modelcontextprotocol.io/v0.1/servers");
    url.searchParams.set("search", input.query);
    url.searchParams.set("version", "latest");
    url.searchParams.set("limit", "20");
    if (input.cursor) url.searchParams.set("cursor", input.cursor);
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
    let data: any;
    try {
      const r = await this.fetcher(url.href, {
        signal: deadline,
        headers: { Accept: "application/json" },
      });
      if (!r.ok || !r.body) throw new Error();
      const reader = r.body.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          deadline.throwIfAborted();
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 524288) throw new Error();
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!Array.isArray(data.servers)) throw new Error();
    } catch {
      assertActive(signal);
      throw new AppError(
        "registry_unavailable",
        "O catálogo MCP não respondeu com dados válidos. Verifique acesso à registry.modelcontextprotocol.io na rede e tente novamente. Nenhuma conexão foi alterada.",
        502,
      );
    }
    return {
      source: url.origin,
      queriedAt: new Date().toISOString(),
      query: input.query,
      nextCursor:
        typeof data.metadata?.nextCursor === "string"
          ? data.metadata.nextCursor.slice(0, 2048)
          : undefined,
      servers: data.servers.slice(0, 20).flatMap((entry: any) => {
        const s = entry?.server;
        if (typeof s?.name !== "string") return [];
        const meta = entry._meta?.["io.modelcontextprotocol.registry/official"];
        return [
          {
            name: s.name.slice(0, 200),
            description: String(s.description || "").slice(0, 2000),
            version: String(s.version || "").slice(0, 100),
            status: String(meta?.status || "não informado"),
            repository: publicUrl(s.repository?.url),
            packages: (Array.isArray(s.packages) ? s.packages : [])
              .slice(0, 10)
              .map((p: any) => ({
                registryType: String(p.registryType || ""),
                identifier: String(p.identifier || "").slice(0, 200),
                version: String(p.version || "").slice(0, 100),
                transport: String(p.transport?.type || ""),
              })),
            remotes: (Array.isArray(s.remotes) ? s.remotes : [])
              .slice(0, 10)
              .map((r: any) => ({
                transport: String(r.type || ""),
                url: publicUrl(r.url),
              }))
              .filter((r: any) => r.url),
          },
        ];
      }),
    };
  }
}
