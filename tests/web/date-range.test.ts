import { describe, expect, it } from "vitest";
import {
  inclusiveEndDate,
  periodWithInclusiveEnd,
  periodWithStart,
} from "../../src/web/date-range.js";

describe("inclusive date controls preserve the exclusive API contract", () => {
  it("converts the last day of a month to the next-day exclusive bound", () => {
    const period = {
      from: "2026-10-01",
      toExclusive: "2026-11-01",
      timeZone: "America/Sao_Paulo" as const,
    };
    expect(inclusiveEndDate(period)).toBe("2026-10-31");
    expect(periodWithInclusiveEnd(period, "2026-10-31").toExclusive).toBe(
      "2026-11-01",
    );
  });

  it("converts year-end and leap-day boundaries correctly", () => {
    const period = {
      from: "2026-12-01",
      toExclusive: "2027-01-01",
      timeZone: "America/Sao_Paulo" as const,
    };
    expect(inclusiveEndDate(period)).toBe("2026-12-31");
    expect(periodWithInclusiveEnd(period, "2028-02-29").toExclusive).toBe(
      "2028-03-01",
    );
  });

  it("keeps a valid range when the start moves past its previous end", () => {
    const period = {
      from: "2026-01-01",
      toExclusive: "2026-02-01",
      timeZone: "America/Sao_Paulo" as const,
    };
    expect(periodWithStart(period, "2026-02-10")).toEqual({
      ...period,
      from: "2026-02-10",
      toExclusive: "2026-02-11",
    });
  });
});
