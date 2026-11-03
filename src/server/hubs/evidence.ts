import type { ChatEvent } from "../../shared/contracts.js";
export function emitHubEvidence(value: any, emit: (e: ChatEvent) => void) {
  for (const result of [value?.hub, value?.arm, value?.meta && value])
    if (result?.meta && Array.isArray(result.totals))
      emit({ type: "result", result });
  emit({ type: "hubEvidence", result: value });
}
