import { it, expect } from "vitest";
import { finopsTemplate } from "../../src/server/agents/finops-template.js";
it("offers traceable instructions without choosing credentials", () => {
  const t = finopsTemplate();
  expect(t.name).toBe("Analista FinOps");
  expect(t.templateSource.version).toBe("1");
  expect(t.instructions).toContain("Não some");
  expect(t).not.toHaveProperty("endpoint");
});
