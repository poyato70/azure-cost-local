import { it, expect } from "vitest";
import { emitHubEvidence } from "../../src/server/hubs/evidence.js";
it("emits verified financial evidence before it reaches model prose", () => {
  const events: any[] = [];
  const hub = {
    totals: [{ currency: "BRL", amount: "42" }],
    meta: { source: "Hub" },
  };
  emitHubEvidence({ hub, comparison: { status: "not_comparable" } }, (e) =>
    events.push(e),
  );
  expect(events[0]).toEqual({ type: "result", result: hub });
  expect(events[1].type).toBe("hubEvidence");
});
