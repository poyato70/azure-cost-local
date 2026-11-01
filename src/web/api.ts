import type {
  Scope,
  CostQuery,
  CostResult,
  BudgetStatus,
  BenefitAnalysis,
  Subscription,
  DateRange,
  ChatEvent,
} from "../shared/contracts.js";
let csrf = "";
export type Bootstrap = {
  loginError?: { code: string; message: string };
  csrf: string;
  authenticated: boolean;
  tenantId: string;
  clientId: string;
  configured: boolean;
  period: DateRange;
};
async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.message || "Não foi possível consultar.");
  return result;
}
export const api = {
  async bootstrap() {
    const b = await request<Bootstrap>("/bootstrap");
    csrf = b.csrf;
    return b;
  },
  config: (tenantId: string, clientId: string) =>
    request("/config", { tenantId, clientId }),
  login: () => request<{ url: string }>("/auth/login", {}),
  logout: () => request("/auth/logout", {}),
  subscriptions: (signal?: AbortSignal) =>
    request<Subscription[]>("/subscriptions", undefined, signal),
  groups: (id: string, signal?: AbortSignal) =>
    request<string[]>(
      "/resource-groups?subscriptionId=" + encodeURIComponent(id),
      undefined,
      signal,
    ),
  queryCosts: (q: CostQuery, signal?: AbortSignal) =>
    request<CostResult>("/costs/query", q, signal),
  compare: (q: CostQuery, signal?: AbortSignal) =>
    request<{
      comparison: { currency: string; delta: string; percent: string | null }[];
      warnings?: string[];
    }>("/costs/compare", q, signal),
  getBudgets: (scope: Scope, signal?: AbortSignal) =>
    request<BudgetStatus>("/budgets/query", scope, signal),
  analyzeBenefits: (
    scope: Scope,
    kind: BenefitAnalysis["kind"],
    signal?: AbortSignal,
  ) => request<BenefitAnalysis>("/benefits/query", { scope, kind }, signal),
  chatStatus: () =>
    request<{ available: boolean; message: string }>("/chat/status"),
  async ask(
    input: {
      message: string;
      scope?: Scope;
      basis: CostQuery["basis"];
      consent: true;
    },
    emit: (e: ChatEvent) => void,
    signal?: AbortSignal,
  ) {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify(input),
      signal,
    });
    if (!r.ok) {
      const b = await r.json();
      throw new Error(b.message || "Chat indisponível.");
    }
    const reader = r.body!.getReader(),
      decoder = new TextDecoder();
    let pending = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop()!;
      for (const line of lines) if (line) emit(JSON.parse(line));
    }
  },
};
export function money(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}
