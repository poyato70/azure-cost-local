import { describe, expect, it } from "vitest";
import { getObservationStatus, isEvidenceStale } from "../src/web/pages/observabilityStatus.js";

const labels = {
  positive: "Endpoint respondeu ok=true",
  negative: "Endpoint respondeu ok=false",
  failed: "Falha ao ler /api/health",
};

describe("observability evidence result and age", () => {
  it.each([
    ["ok=true atual", "positive", "current", "ok", "Endpoint respondeu ok=true"],
    ["ok=false atual", "negative", "current", "error", "Endpoint respondeu ok=false"],
    ["ok=true desatualizado", "positive", "stale", "stale", "Desatualizado · Endpoint respondeu ok=true"],
    ["ok=false desatualizado", "negative", "stale", "error", "Desatualizado · Endpoint respondeu ok=false"],
    ["HTTP 503 atual", "failed", "current", "error", "Falha ao ler /api/health"],
    ["HTTP 503 desatualizado", "failed", "stale", "error", "Desatualizado · Falha ao ler /api/health"],
    ["sem resposta", "unverified", "current", "unknown", "Não verificado"],
  ] as const)("%s", (_case, result, freshness, state, label) => {
    expect(getObservationStatus(result, freshness, labels)).toEqual({ state, label });
  });

  it("marks evidence stale only after 60 seconds", () => {
    const checkedAt = "2026-11-18T12:00:00.000Z";
    const checkedAtMs = Date.parse(checkedAt);
    expect(isEvidenceStale(checkedAt, checkedAtMs + 60_000)).toBe(false);
    expect(isEvidenceStale(checkedAt, checkedAtMs + 60_001)).toBe(true);
    expect(isEvidenceStale(undefined, checkedAtMs + 120_000)).toBe(false);
  });
});
