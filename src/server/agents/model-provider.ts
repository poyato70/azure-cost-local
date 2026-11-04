import { fetchBound } from "../security/endpoint-policy.js";
import { AppError } from "../errors.js";
import type { AgentProfile } from "../../shared/connections.js";
import type { RequestContext } from "../../shared/contracts.js";
import type { SecretStore } from "../storage/secret-store.js";
import type { IdentityProvider } from "../auth/identity-provider.js";
export type ModelTurn = {
  messages: any[];
  tools: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[];
};
export type ModelResult = {
  text?: string;
  toolCalls: { id: string; name: string; arguments: string }[];
};
export class ModelProvider {
  constructor(
    private profile: AgentProfile,
    private vault: SecretStore,
    private identity: IdentityProvider,
    private ctx: RequestContext,
  ) {}
  async complete(input: ModelTurn, signal: AbortSignal): Promise<ModelResult> {
    const p = this.profile,
      url = new URL(p.endpoint);
    if (!/\.(openai\.azure\.com|services\.ai\.azure\.com)$/.test(url.hostname))
      throw new AppError(
        "invalid_endpoint",
        "Endpoint de inferência não autorizado.",
      );
    let path = url.pathname.replace(/\/$/, "");
    if (!path || path === "/") path = "/openai/v1";
    if (!path.endsWith("/openai/v1"))
      throw new AppError(
        "invalid_endpoint",
        "Informe a raiz do recurso ou base /openai/v1.",
      );
    url.pathname = path + "/chat/completions";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (p.modelCredential.kind === "apiKey") {
      if (!p.modelCredential.secretRef)
        throw new AppError(
          "auth_configuration",
          "Cadastre a chave de inferência do modelo.",
        );
      headers["api-key"] = await this.vault.read(p.modelCredential.secretRef);
    } else {
      const token =
        p.modelCredential.accessId === this.ctx.accessId
          ? await this.identity.getToken(
              this.ctx,
              "https://cognitiveservices.azure.com",
            )
          : await this.identity.applications.token(
              p.modelCredential.accessId,
              "https://cognitiveservices.azure.com",
            );
      headers.Authorization = "Bearer " + token;
    }
    const response = await fetchBound(url.href, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: p.model,
        messages: input.messages,
        tools: input.tools.length
          ? input.tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            }))
          : undefined,
        max_completion_tokens: 2048,
      }),
      signal,
    });
    this.ctx.diagnose?.({
      source: "Modelo do agente",
      operation: "inferência",
      status: String(response.status),
      detail: response.ok
        ? "Modelo respondeu; verifique as chamadas de tools nos eventos seguintes."
        : "O provedor de inferência recusou a solicitação. Verifique deployment, credencial e suporte ao modelo.",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new AppError(
        "model_unavailable",
        `O modelo recusou a solicitação (HTTP ${response.status}). Confira deployment, credencial e suporte a tool calling.`,
        502,
      );
    }
    const data = (await response.json()) as any;
    const m = data.choices?.[0]?.message;
    if (!m)
      throw new AppError(
        "model_unavailable",
        "Resposta do modelo sem mensagem compatível.",
        502,
      );
    return {
      text: typeof m.content === "string" ? m.content : undefined,
      toolCalls: (m.tool_calls || []).map((t: any) => ({
        id: t.id,
        name: t.function?.name,
        arguments: t.function?.arguments,
      })),
    };
  }
}
