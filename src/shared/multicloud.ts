import { z } from "zod";
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida",
  );
const common = { from: day, toExclusive: day };
export const cloudQuerySchema = z
  .discriminatedUnion("provider", [
    z
      .object({
        ...common,
        provider: z.literal("aws"),
        profile: z.string().regex(/^[\w.@-]{1,128}$/),
        accountId: z
          .string()
          .regex(/^\d{12}$/)
          .optional(),
      })
      .strict(),
    z
      .object({
        ...common,
        provider: z.literal("gcp"),
        projectId: z.string().regex(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/),
        table: z
          .string()
          .regex(
            /^[a-z][a-z0-9-]{4,61}[a-z0-9]\.[A-Za-z_][A-Za-z0-9_]{0,1023}\.[A-Za-z_][A-Za-z0-9_]{0,1023}$/,
          ),
        location: z
          .string()
          .regex(/^[A-Za-z0-9-]{2,40}$/)
          .default("US"),
        maximumBytesBilled: z
          .number()
          .int()
          .min(1)
          .max(10_000_000_000)
          .default(1_000_000_000),
        confirmQueryCost: z.literal(true),
      })
      .strict(),
    z
      .object({
        ...common,
        provider: z.literal("kubernetes"),
        endpoint: z.string().url().max(2048),
        currency: z.string().regex(/^[A-Z]{3}$/),
        allowPrivateNetwork: z.boolean().default(false),
        secretRef: z
          .string()
          .regex(/^[\w-]{1,128}$/)
          .optional(),
      })
      .strict(),
  ])
  .superRefine((q, ctx) => {
    if (
      q.from >= q.toExclusive ||
      (Date.parse(q.toExclusive) - Date.parse(q.from)) / 86400000 > 366
    )
      ctx.addIssue({
        code: "custom",
        message: "Selecione entre 1 e 366 dias, com fim exclusivo.",
      });
  });
export type CloudQuery = z.infer<typeof cloudQuerySchema>;
export type CloudRow = {
  date: string;
  service: string;
  amount: string;
  currency: string;
};
export type CloudResult = {
  provider: CloudQuery["provider"] | "azure";
  scope: string;
  from: string;
  toExclusive: string;
  basis: string;
  layer: "billing" | "allocation";
  rows: CloudRow[];
  totals: { currency: string; amount: string }[];
  raw: unknown;
  warnings: string[];
  queriedAt: string;
};
