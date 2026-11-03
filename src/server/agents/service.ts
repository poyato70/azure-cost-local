import { finopsTemplate } from "./finops-template.js";
import { randomUUID } from "node:crypto";
import {
  agentInput,
  type AgentProfile,
  type PublicAgent,
} from "../../shared/connections.js";
import type { ConfigStore } from "../storage/config-store.js";
import type { SecretStore } from "../storage/secret-store.js";
import type { Invalidation } from "../connections/invalidation.js";
import { validateEndpoint } from "../security/endpoint-policy.js";
import { AppError } from "../errors.js";
export function publicAgent(p: AgentProfile): PublicAgent {
  const { modelCredential, ...rest } = p;
  return {
    ...rest,
    modelCredential:
      modelCredential.kind === "apiKey"
        ? { kind: "apiKey", keyConfigured: !!modelCredential.secretRef }
        : modelCredential,
  };
}
export class AgentService {
  constructor(
    private store: ConfigStore,
    private vault: SecretStore,
    private gate: Invalidation,
  ) {}
  async list() {
    return (await this.store.read()).agentProfiles.map(publicAgent);
  }
  async get(id: string) {
    const p = (await this.store.read()).agentProfiles.find((x) => x.id === id);
    if (!p)
      throw new AppError("invalid_request", "Agente não encontrado.", 404);
    return p;
  }
  async save(raw: unknown) {
    const v = agentInput.parse(raw);
    const endpoint = await validateEndpoint(v.endpoint);
    if (
      !/\.(openai\.azure\.com|services\.ai\.azure\.com)$/.test(
        endpoint.url.hostname,
      ) ||
      endpoint.url.search
    )
      throw new AppError(
        "invalid_endpoint",
        "Use um endpoint Azure OpenAI/Foundry compatível com v1.",
      );
    let saved!: AgentProfile,
      oldRef: string | undefined,
      newRef: string | undefined;
    try {
      await this.store.mutate(async (s) => {
        const old = s.agentProfiles.find((x) => x.id === v.id);
        if (v.id && !old)
          throw new AppError("invalid_request", "Agente não encontrado.", 404);
        if (old && v.expectedVersion !== old.configurationVersion)
          throw new AppError(
            "configuration_changed",
            "Agente editado. Recarregue.",
            409,
          );
        for (const id of v.allowedAccessIds)
          if (!s.accessProfiles.some((x) => x.id === id))
            throw new AppError(
              "invalid_request",
              "Vínculo de acesso inválido.",
            );
        for (const id of v.mcpConnectionIds)
          if (!s.mcpProfiles.some((x) => x.id === id))
            throw new AppError("invalid_request", "Vínculo MCP inválido.");
        if (
          v.modelCredential.kind === "entra" &&
          !s.accessProfiles.some(
            (x) =>
              v.modelCredential.kind === "entra" &&
              x.id === v.modelCredential.accessId,
          )
        )
          throw new AppError(
            "invalid_request",
            "Acesso Entra do modelo não encontrado.",
          );
        oldRef =
          old?.modelCredential.kind === "apiKey"
            ? old.modelCredential.secretRef
            : undefined;
        if (
          oldRef &&
          v.modelCredential.kind === "apiKey" &&
          v.keyAction.kind === "keep" &&
          old &&
          new URL(old.endpoint).origin !== endpoint.url.origin
        )
          throw new AppError(
            "credential_binding",
            "Ao mudar o host do modelo, substitua ou remova a chave.",
            409,
          );
        let ref = v.modelCredential.kind === "apiKey" ? oldRef : undefined;
        if (v.keyAction.kind === "replace")
          ref = newRef = await this.vault.put(v.keyAction.value);
        if (v.keyAction.kind === "remove") ref = undefined;
        const { keyAction, expectedVersion, modelCredential, ...fields } = v;
        saved = {
          ...fields,
          templateSource: fields.templateSource
            ? {
                ...finopsTemplate().templateSource,
                customized:
                  fields.instructions !== finopsTemplate().instructions,
              }
            : undefined,
          id: old?.id || randomUUID(),
          configurationVersion: (old?.configurationVersion || 0) + 1,
          modelCredential:
            modelCredential.kind === "apiKey"
              ? { kind: "apiKey", secretRef: ref }
              : modelCredential,
        };
        s.agentProfiles = s.agentProfiles.filter((x) => x.id !== saved.id);
        s.agentProfiles.push(saved);
      });
    } catch (e) {
      if (newRef) await this.vault.remove(newRef);
      throw e;
    }
    this.gate.changed("agent:" + saved.id);
    if (
      oldRef &&
      (saved.modelCredential.kind !== "apiKey" ||
        saved.modelCredential.secretRef !== oldRef)
    )
      await this.vault.remove(oldRef);
    return publicAgent(saved);
  }
  async remove(id: string) {
    let ref: string | undefined;
    await this.store.mutate((s) => {
      const p = s.agentProfiles.find((x) => x.id === id);
      if (p?.modelCredential.kind === "apiKey")
        ref = p.modelCredential.secretRef;
      s.agentProfiles = s.agentProfiles.filter((x) => x.id !== id);
    });
    this.gate.changed("agent:" + id);
    if (ref) await this.vault.remove(ref);
  }
  async duplicate(id: string) {
    const a = await this.get(id);
    const { configurationVersion, modelCredential, ...rest } = a;
    return this.save({
      ...rest,
      id: undefined,
      name: a.name + " (cópia)",
      modelCredential:
        modelCredential.kind === "apiKey"
          ? { kind: "apiKey" }
          : modelCredential,
      keyAction:
        modelCredential.kind === "apiKey" && modelCredential.secretRef
          ? {
              kind: "replace",
              value: await this.vault.read(modelCredential.secretRef),
            }
          : { kind: "keep" },
    });
  }
}
