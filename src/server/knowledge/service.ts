import { createHash, randomUUID } from "node:crypto";
import {
  knowledgeInput,
  type KnowledgeDocument,
} from "../../shared/knowledge.js";
import type { ConfigStore } from "../storage/config-store.js";
import { fetchBound } from "../security/endpoint-policy.js";
import { AppError, assertActive } from "../errors.js";

export function githubDocument(value: string) {
  const match =
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/blob\/([a-f0-9]{40})\/([\w./-]+\.md)$/i.exec(
      value,
    );
  if (!match || match[4].split("/").some((p) => !p || p === "." || p === ".."))
    throw new AppError(
      "invalid_request",
      "Use um arquivo .md público do GitHub com SHA completo de commit (40 caracteres), sem branch, query ou credenciais.",
    );
  return {
    commit: match[3].toLowerCase(),
    path: match[4],
    raw: `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}`,
  };
}
export class KnowledgeService {
  constructor(
    private store: ConfigStore,
    private fetcher: typeof fetchBound = fetchBound,
  ) {}
  async list(search = "") {
    const docs = (await this.store.read()).knowledgeDocuments || [];
    const term = search.toLocaleLowerCase("pt-BR");
    return docs.filter(
      (d) =>
        !term ||
        `${d.name}\n${d.path}\n${d.content}`
          .toLocaleLowerCase("pt-BR")
          .includes(term),
    );
  }
  async import(raw: unknown, signal: AbortSignal) {
    const input = knowledgeInput.parse(raw),
      source = githubDocument(input.url);
    const response = await this.fetcher(source.raw, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      headers: { Accept: "text/plain" },
    });
    if (!response.ok || !response.body)
      throw new AppError(
        "upstream",
        `GitHub respondeu HTTP ${response.status}. Apenas arquivos públicos são suportados.`,
        502,
      );
    const reader = response.body.getReader(),
      parts: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        assertActive(signal);
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 32768)
          throw new AppError(
            "invalid_request",
            "Documento excede 32 kB; divida o conteúdo antes de importar.",
          );
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const content = Buffer.concat(parts).toString("utf8");
    if (!content.trim() || content.includes("\u0000"))
      throw new AppError(
        "invalid_request",
        "Markdown vazio ou conteúdo binário.",
      );
    const document: KnowledgeDocument = {
      ...input,
      ...{ commit: source.commit, path: source.path },
      id: randomUUID(),
      content,
      contentHash: createHash("sha256").update(content).digest("hex"),
      importedAt: new Date().toISOString(),
    };
    assertActive(signal);
    await this.store.mutate((s) => {
      const docs = (s.knowledgeDocuments ||= []);
      if (docs.length >= 100)
        throw new AppError(
          "invalid_request",
          "Limite local de 100 documentos.",
        );
      if (docs.some((d) => d.url === input.url))
        throw new AppError("invalid_request", "Esta versão já foi importada.");
      docs.push(document);
    });
    return document;
  }
  async remove(id: string) {
    await this.store.mutate((s) => {
      if (s.agentProfiles.some((a) => a.knowledgeIds?.includes(id)))
        throw new AppError(
          "access_in_use",
          "Remova o vínculo dos agentes antes de excluir esta versão.",
          409,
        );
      s.knowledgeDocuments = (s.knowledgeDocuments || []).filter(
        (d) => d.id !== id,
      );
    });
  }
  async context(ids: string[]) {
    const docs = await this.list();
    const selected = ids.map((id) => {
      const doc = docs.find((d) => d.id === id);
      if (!doc)
        throw new AppError(
          "configuration_changed",
          "Conhecimento vinculado não encontrado.",
          409,
        );
      return doc;
    });
    const text = selected
      .map(
        (d) =>
          `Fonte revisada: ${d.name}\nURL: ${d.url}\nCommit: ${d.commit}\nSHA-256: ${d.contentHash}\nLicença declarada: ${d.license}\n${d.content}`,
      )
      .join("\n\n---\n\n");
    if (text.length > 48000)
      throw new AppError(
        "invalid_request",
        "Conhecimento vinculado excede 48 mil caracteres; reduza os documentos deste agente.",
      );
    return text;
  }
}
