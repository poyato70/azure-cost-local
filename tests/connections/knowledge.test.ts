import { it, expect } from "vitest";
import {
  KnowledgeService,
  githubDocument,
} from "../../src/server/knowledge/service.js";
it("requires immutable public Markdown source and rejects scripts and moving refs", () => {
  const base = "https://github.com/example/catalog/blob/";
  expect(() => githubDocument(base + "main/skills/finops/SKILL.md")).toThrow();
  expect(() => githubDocument(base + "a".repeat(40) + "/run.ps1")).toThrow();
  expect(
    githubDocument(base + "a".repeat(40) + "/skills/finops/SKILL.md").commit,
  ).toBe("a".repeat(40));
});
it("stores reviewed pinned content, searches locally, and refuses deletion while linked", async () => {
  const snapshot: any = { knowledgeDocuments: [], agentProfiles: [] };
  const store: any = {
    read: async () => structuredClone(snapshot),
    mutate: async (fn: any) => fn(snapshot),
  };
  const service = new KnowledgeService(
    store,
    async () => new Response("# FinOps\nInforme moeda e período."),
  );
  const doc = await service.import(
    {
      name: "Custo real",
      url:
        "https://github.com/example/catalog/blob/" +
        "b".repeat(40) +
        "/SKILL.md",
      license: "MIT",
      reviewed: true,
    },
    new AbortController().signal,
  );
  expect(doc.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(await service.list("moeda")).toHaveLength(1);
  expect(await service.context([doc.id])).toContain(doc.commit);
  snapshot.agentProfiles = [{ knowledgeIds: [doc.id] }];
  await expect(service.remove(doc.id)).rejects.toMatchObject({
    code: "access_in_use",
  });
});
