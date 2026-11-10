import { z } from "zod";
export const knowledgeInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    url: z.string().url().max(2048),
    license: z.string().trim().min(1).max(160),
    reviewed: z.literal(true),
  })
  .strict();
export type KnowledgeDocument = z.infer<typeof knowledgeInput> & {
  id: string;
  commit: string;
  path: string;
  content: string;
  contentHash: string;
  importedAt: string;
};
