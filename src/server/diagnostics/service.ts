import { sanitizeDiagnosticText } from "../../shared/diagnostic-sanitizer.js";

export type DiagnosticEvent = {
  time: string;
  requestId?: string;
  attempt?: number;
  source: string;
  operation: string;
  status: string;
  detail: string;
};
export class Diagnostics {
  private sessions = new Map<string, DiagnosticEvent[]>();
  record(id: string, event: Omit<DiagnosticEvent, "time">) {
    if (!id) return;
    const clean = sanitizeDiagnosticText;
    const rows = this.sessions.get(id) || [];
    rows.push({
      time: new Date().toISOString(),
      requestId: event.requestId ? clean(event.requestId) : undefined,
      attempt:
        Number.isSafeInteger(event.attempt) && event.attempt! > 0
          ? event.attempt
          : undefined,
      source: clean(event.source),
      operation: clean(event.operation),
      status: clean(event.status),
      detail: clean(event.detail),
    });
    this.sessions.delete(id);
    this.sessions.set(id, rows.slice(-150));
    if (this.sessions.size > 100)
      this.sessions.delete(this.sessions.keys().next().value!);
  }
  list(id: string) {
    return this.sessions.get(id) || [];
  }
  clear(id: string) {
    this.sessions.delete(id);
  }
}
