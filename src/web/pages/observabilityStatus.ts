export type ObservationResult = "positive" | "negative" | "failed" | "unverified";
export type ObservationFreshness = "current" | "stale";
export type ObservationState = "ok" | "stale" | "error" | "unknown";

export type ObservationLabels = {
  positive: string;
  negative: string;
  failed: string;
};

export function getObservationStatus(
  result: ObservationResult,
  freshness: ObservationFreshness,
  labels: ObservationLabels,
): { state: ObservationState; label: string } {
  if (result === "unverified") return { state: "unknown", label: "Não verificado" };

  const state: ObservationState = result === "positive"
    ? freshness === "stale" ? "stale" : "ok"
    : "error";
  const label = result === "positive"
    ? labels.positive
    : result === "negative" ? labels.negative : labels.failed;

  return {
    state,
    label: freshness === "stale" ? `Desatualizado · ${label}` : label,
  };
}

export function isEvidenceStale(checkedAt: string | undefined, now: number): boolean {
  return Boolean(checkedAt && now - Date.parse(checkedAt) > 60_000);
}
