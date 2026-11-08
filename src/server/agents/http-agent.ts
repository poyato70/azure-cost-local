import { fetchBound } from "../security/endpoint-policy.js";
import { AppError } from "../errors.js";
import type { AgentProfile } from "../../shared/connections.js";
import type { SecretStore } from "../storage/secret-store.js";

const answerKeys = [
  "resposta",
  "response",
  "answer",
  "text",
  "message",
  "content",
  "output",
];
const threadKeys = ["thread_id", "threadId", "id"];

export class HttpAgentClient {
  constructor(
    private agent: AgentProfile,
    private vault: SecretStore,
  ) {}
  private base() {
    return this.agent.endpoint.replace(/\/+$/, "");
  }
  private async call(
    path: string,
    signal: AbortSignal,
    body?: unknown,
    auth = true,
  ) {
    const headers: Record<string, string> = { Accept: "application/json" };
    const cred = this.agent.modelCredential;
    if (auth && cred.kind === "apiKey" && cred.secretRef)
      headers.Authorization =
        "Bearer " + (await this.vault.read(cred.secretRef));
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetchBound(
      this.base() + path,
      {
        method:
          body === undefined && path !== "/api/conversas" ? "GET" : "POST",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      },
      this.agent.allowPrivateNetwork,
      this.agent.allowInsecureHttp,
    );
    const text = await response.text();
    if (response.status === 401 || response.status === 403)
      throw new AppError(
        "auth_configuration",
        "O agente HTTP recusou a credencial (HTTP " +
          response.status +
          "). Cadastre o token Bearer.",
        response.status,
      );
    if (!response.ok)
      throw new AppError(
        "upstream",
        `O agente HTTP respondeu ${response.status}: ${text.slice(0, 300)}`,
        502,
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  async health(signal: AbortSignal) {
    return this.call("/api/health/live", signal, undefined, false);
  }
  async ask(message: string, signal: AbortSignal) {
    const created: any = await this.call("/api/conversas", signal);
    const thread =
      typeof created === "string"
        ? created
        : threadKeys.map((k) => created?.[k]).find((v) => v !== undefined);
    if (thread === undefined || thread === null || thread === "")
      throw new AppError(
        "upstream",
        "O agente HTTP não retornou o identificador da conversa.",
        502,
      );
    const reply = await this.call(
      `/api/conversas/${encodeURIComponent(String(thread))}/mensagens`,
      signal,
      { pergunta: message },
    );
    return extractAnswer(reply);
  }
}

export function extractAnswer(reply: unknown): string {
  if (typeof reply === "string") return reply;
  if (reply && typeof reply === "object") {
    const o = reply as Record<string, unknown>;
    for (const k of answerKeys)
      if (typeof o[k] === "string") return o[k] as string;
  }
  return JSON.stringify(reply, null, 2);
}
