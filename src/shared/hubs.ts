import { z } from "zod";
export const hubInput = z
  .object({
    id: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    accessId: z.string().uuid(),
    transport: z.enum(["api", "mcp"]),
    endpoint: z.string().url(),
    database: z.literal("Hub").default("Hub"),
    schemaVersion: z.literal("v1_2").default("v1_2"),
    mcpConnectionId: z.string().uuid().optional(),
  })
  .strict();
export type HubProfile = Omit<
  z.infer<typeof hubInput>,
  "id" | "expectedVersion"
> & { id: string; configurationVersion: number };
export const hubOperation = z.enum([
  "costs",
  "reconcile",
  "reservations",
  "savingsPlans",
]);
export type HubOperation = z.infer<typeof hubOperation>;
