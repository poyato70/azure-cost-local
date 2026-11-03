import { randomUUID } from "node:crypto";
import {
  accessInput,
  type AccessProfile,
  type PublicAccessProfile,
} from "../../shared/connections.js";
import type { ConfigStore } from "../storage/config-store.js";
import type { SecretStore } from "../storage/secret-store.js";
import type { Invalidation } from "./invalidation.js";
import { AppError } from "../errors.js";
export const publicAccess = (p: AccessProfile): PublicAccessProfile => {
  const { secretRef, ...safe } = p;
  return { ...safe, secretConfigured: !!secretRef };
};
export class AccessService {
  constructor(
    private store: ConfigStore,
    private vault: SecretStore,
    private gate?: Invalidation,
  ) {}
  async list() {
    return (await this.store.read()).accessProfiles.map(publicAccess);
  }
  async get(id: string) {
    const p = (await this.store.read()).accessProfiles.find((p) => p.id === id);
    if (!p)
      throw new AppError("invalid_request", "Acesso não encontrado.", 404);
    return p;
  }
  async save(raw: unknown) {
    const input = accessInput.parse(raw);
    let saved!: AccessProfile,
      newRef: string | undefined,
      oldRef: string | undefined;
    try {
      await this.store.mutate(async (s) => {
        const old = input.id
          ? s.accessProfiles.find((p) => p.id === input.id)
          : undefined;
        if (input.id && !old)
          throw new AppError("invalid_request", "Acesso não encontrado.", 404);
        if (old && input.expectedVersion !== old.configurationVersion)
          throw new AppError(
            "configuration_changed",
            "O acesso foi editado. Recarregue antes de salvar.",
            409,
          );
        oldRef = old?.secretRef;
        let ref = oldRef;
        if (input.secretAction.kind === "replace")
          ref = newRef = await this.vault.put(input.secretAction.value);
        if (input.secretAction.kind === "remove") ref = undefined;
        saved = {
          id: old?.id || randomUUID(),
          name: input.name,
          tenantId: input.tenantId,
          clientId: input.clientId,
          preferredMode: input.preferredMode,
          secretExpiresAt: input.secretExpiresAt,
          secretRef: ref,
          credentialVersion:
            (old?.credentialVersion || 0) +
            (input.secretAction.kind === "keep" && old ? 0 : 1),
          configurationVersion: (old?.configurationVersion || 0) + 1,
        };
        s.accessProfiles = s.accessProfiles.filter((p) => p.id !== saved.id);
        s.accessProfiles.push(saved);
      });
    } catch (e) {
      if (newRef) await this.vault.remove(newRef);
      throw e;
    }
    this.gate?.changed("access:" + saved.id);
    if (oldRef && oldRef !== saved.secretRef) await this.vault.remove(oldRef);
    return publicAccess(saved);
  }
  async remove(id: string) {
    let ref: string | undefined;
    await this.store.mutate((s) => {
      if (
        (s.hubProfiles || []).some((p) => p.accessId === id) ||
        s.mcpProfiles.some((p) => p.accessId === id) ||
        s.agentProfiles.some(
          (a) =>
            a.allowedAccessIds.includes(id) ||
            (a.modelCredential.kind === "entra" &&
              a.modelCredential.accessId === id),
        )
      )
        throw new AppError(
          "access_in_use",
          "Remova os vínculos com MCPs/agentes antes de excluir este acesso.",
          409,
        );
      const p = s.accessProfiles.find((p) => p.id === id);
      if (!p)
        throw new AppError("invalid_request", "Acesso não encontrado.", 404);
      ref = p.secretRef;
      s.accessProfiles = s.accessProfiles.filter((p) => p.id !== id);
    });
    this.gate?.changed("access:" + id);
    if (ref) await this.vault.remove(ref);
  }
}
