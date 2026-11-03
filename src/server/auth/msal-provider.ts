import { createHash, randomBytes } from "node:crypto";
import { PublicClientApplication } from "@azure/msal-node";
import { AppError } from "../errors.js";
import { authError } from "./auth-errors.js";
import type { SessionStore } from "./session-store.js";
import type { Config } from "../config.js";
import type { RequestContext } from "../../shared/contracts.js";
const scopes = ["https://management.azure.com/user_impersonation"];
export class LoginFlows {
  private pending = new Map<
    string,
    {
      sessionId: string;
      verifier: string;
      challenge: string;
      nonce: string;
      created: number;
    }
  >();
  start(sessionId: string) {
    for (const [key, v] of this.pending)
      if (Date.now() - v.created > 600000) this.pending.delete(key);
    const verifier = randomBytes(48).toString("base64url"),
      state = randomBytes(32).toString("base64url"),
      nonce = randomBytes(32).toString("base64url");
    const f = {
      sessionId,
      verifier,
      challenge: createHash("sha256").update(verifier).digest("base64url"),
      nonce,
      created: Date.now(),
    };
    this.pending.set(state, f);
    return { ...f, state };
  }
  consume(state: string, sessionId: string) {
    const f = this.pending.get(state);
    this.pending.delete(state);
    if (!f || f.sessionId !== sessionId || Date.now() - f.created > 600000)
      throw new AppError(
        "invalid_request",
        "Login expirado ou inválido. Entre novamente.",
      );
    return f;
  }
}
export class MicrosoftIdentity {
  flows = new LoginFlows();
  constructor(
    private store: SessionStore,
    private config: Config,
    private options: { scopes?: string[]; pca?: PublicClientApplication } = {},
  ) {}
  async begin() {
    if (!this.config.clientId || !this.config.tenantId)
      throw new AppError(
        "invalid_request",
        "Configure Tenant ID e Client ID antes de entrar.",
      );
    const id = this.store.create("", this.config.tenantId),
      s = this.store.get(id)!;
    s.pca =
      this.options.pca ||
      new PublicClientApplication({
        auth: {
          clientId: this.config.clientId,
          authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        },
        system: {
          loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} },
        },
      });
    const f = this.flows.start(id);
    return {
      id,
      url: await s.pca.getAuthCodeUrl({
        scopes: this.options.scopes || scopes,
        redirectUri: this.config.origin + "/api/auth/callback",
        codeChallenge: f.challenge,
        codeChallengeMethod: "S256",
        state: f.state,
        nonce: f.nonce,
        prompt: "select_account",
      }),
    };
  }
  async finish(id: string, state: string, code: string) {
    const s = this.store.get(id);
    const f = this.flows.consume(state, id);
    if (!s?.pca)
      throw new AppError(
        "unauthenticated",
        "Sessão de login não encontrada.",
        401,
      );
    const result = await s.pca
      .acquireTokenByCode({
        code,
        scopes: this.options.scopes || scopes,
        redirectUri: this.config.origin + "/api/auth/callback",
        codeVerifier: f.verifier,
        nonce: f.nonce,
      })
      .catch((error) => {
        throw authError(error);
      });
    if (
      !result?.account ||
      (result.idTokenClaims as Record<string, unknown>)?.nonce !== f.nonce
    )
      throw new AppError(
        "unauthenticated",
        "Resposta de autenticação inválida.",
        401,
      );
    if (result.tenantId.toLowerCase() !== this.config.tenantId.toLowerCase())
      throw new AppError(
        "forbidden",
        "O tenant autenticado difere do configurado.",
        403,
      );
    const newId = this.store.create(
      result.account.homeAccountId,
      result.tenantId,
    );
    const next = this.store.get(newId)!;
    next.pca = s.pca;
    next.account = result.account;
    this.store.remove(id);
    return newId;
  }
  async getArmToken(ctx: RequestContext) {
    const s = this.store.get(ctx.sessionId);
    if (!s?.pca || !s.account || s.tenantId !== ctx.tenantId)
      throw new AppError(
        "unauthenticated",
        "Entre novamente com Microsoft.",
        401,
      );
    try {
      const r = await s.pca.acquireTokenSilent({ account: s.account, scopes });
      return r.accessToken;
    } catch {
      throw new AppError(
        "unauthenticated",
        "Sua sessão Microsoft precisa de novo login.",
        401,
      );
    }
  }
}
