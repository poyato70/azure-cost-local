import { resourceScopes } from "./resource-scopes.js";
import type { RequestContext } from "../../shared/contracts.js";
import type { AccessService } from "../connections/access-service.js";
import type { Invalidation } from "../connections/invalidation.js";
import { ApplicationProvider } from "./application-provider.js";
import { MicrosoftIdentity } from "./msal-provider.js";
import type { SessionStore } from "./session-store.js";
import type { Config } from "../config.js";
import { AppError, assertActive } from "../errors.js";
export class IdentityProvider {
  private pending = new Map<
    string,
    { identity: MicrosoftIdentity; accessId: string; version: number }
  >();
  constructor(
    readonly applications: ApplicationProvider,
    private accesses: AccessService,
    private gate: Invalidation,
    private sessions: SessionStore,
    private config: Config,
    private legacy: MicrosoftIdentity,
  ) {}
  async begin(accessId: string, audience?: string, previousSessionId?: string) {
    const p = await this.accesses.get(accessId);
    const previous = this.sessions.get(previousSessionId);
    const identity = new MicrosoftIdentity(
      this.sessions,
      { ...this.config, tenantId: p.tenantId, clientId: p.clientId },
      {
        scopes: audience ? resourceScopes(audience) : undefined,
        pca:
          previous?.accessId === accessId && previous.principalKind === "user"
            ? previous.pca
            : undefined,
      },
    );
    const result = await identity.begin();
    this.pending.set(result.id, {
      identity,
      accessId,
      version: p.configurationVersion,
    });
    return result;
  }
  async finish(id: string, state: string, code: string) {
    const p = this.pending.get(id);
    if (!p) return this.legacy.finish(id, state, code);
    this.pending.delete(id);
    await this.gate.assertCurrent({ ["access:" + p.accessId]: p.version });
    const next = await p.identity.finish(id, state, code);
    await this.gate.assertCurrent({ ["access:" + p.accessId]: p.version });
    const s = this.sessions.get(next)!;
    s.accessId = p.accessId;
    s.accessVersion = p.version;
    s.principalKind = "user";
    this.bind(s);
    return next;
  }
  async connectApplication(sessionId: string, accessId: string) {
    const p = await this.accesses.get(accessId);
    await this.applications.token(accessId, "https://management.azure.com");
    const s = this.sessions.get(sessionId);
    if (!s)
      throw new AppError("unauthenticated", "Sessão local encerrada.", 401);
    await this.gate.assertCurrent({
      ["access:" + accessId]: p.configurationVersion,
    });
    s.userId = "application:" + p.clientId;
    s.tenantId = p.tenantId;
    s.accessId = accessId;
    s.accessVersion = p.configurationVersion;
    s.principalKind = "application";
    this.bind(s);
  }
  private bind(s: import("./session-store.js").Session) {
    this.gate.watch(
      { ["access:" + s.accessId]: s.accessVersion! },
      s.controller,
    );
    s.controller.signal.addEventListener(
      "abort",
      () => {
        s.userId = "";
        s.pca = undefined;
        s.account = undefined;
      },
      { once: true },
    );
  }
  async getToken(
    ctx: RequestContext,
    audience = "https://management.azure.com",
  ) {
    assertActive(ctx.signal);
    const s = this.sessions.get(ctx.sessionId);
    if (!s?.userId)
      throw new AppError("unauthenticated", "Conecte um acesso primeiro.", 401);
    if (s.accessId) {
      await this.gate.assertCurrent({
        ["access:" + s.accessId]: s.accessVersion!,
      });
      if (s.principalKind === "application")
        return this.applications.token(s.accessId, audience);
    }
    if (audience === "https://management.azure.com")
      return this.legacy.getArmToken(ctx);
    if (!s.pca || !s.account)
      throw new AppError(
        "unauthenticated",
        "Conecte o usuário Microsoft.",
        401,
      );
    try {
      return (
        await s.pca.acquireTokenSilent({
          account: s.account,
          scopes: resourceScopes(audience),
        })
      ).accessToken;
    } catch {
      throw new AppError(
        "auth_consent",
        "Este recurso requer consentimento/login específico na conexão MCP.",
        403,
      );
    }
  }
}
