import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import type { AccessService } from "../connections/access-service.js";
import type { SecretStore } from "../storage/secret-store.js";
import { AppError } from "../errors.js";
import { authError } from "./auth-errors.js";
export class ApplicationProvider {
  private cache = new Map<string, { token: string; expires: number }>();
  constructor(
    private accesses: AccessService,
    private vault: SecretStore,
    private factory: (
      c: Configuration,
    ) => Pick<
      ConfidentialClientApplication,
      "acquireTokenByClientCredential"
    > = (c) => new ConfidentialClientApplication(c),
  ) {}
  async token(accessId: string, audience: string) {
    const p = await this.accesses.get(accessId);
    if (!p.secretRef)
      throw new AppError(
        "auth_configuration",
        "Cadastre o Secret Value para usar a identidade da aplicação.",
      );
    if (
      ![
        "https://management.azure.com",
        "https://api.fabric.microsoft.com",
        "https://cognitiveservices.azure.com",
      ].includes(audience) &&
      !/^https:\/\/[a-z0-9.-]+\.kusto\.windows\.net$/.test(audience) &&
      !/^api:\/\/[0-9a-f-]{36}$/i.test(audience)
    )
      throw new AppError(
        "forbidden",
        "Recurso de autenticação não autorizado.",
        403,
      );
    const key = [
        accessId,
        p.configurationVersion,
        p.credentialVersion,
        audience,
      ].join("|"),
      old = this.cache.get(key);
    if (old && old.expires > Date.now() + 60000) return old.token;
    const client = this.factory({
      auth: {
        clientId: p.clientId,
        authority: `https://login.microsoftonline.com/${p.tenantId}`,
        clientSecret: await this.vault.read(p.secretRef),
      },
      system: {
        loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} },
      },
    });
    let result;
    try {
      result = await client.acquireTokenByClientCredential({
        scopes: [audience + "/.default"],
      });
    } catch (e) {
      throw authError(e);
    }
    if (!result?.accessToken)
      throw new AppError(
        "unauthenticated",
        "O Azure não retornou um token de aplicação.",
        401,
      );
    const current = await this.accesses.get(accessId);
    if (current.configurationVersion !== p.configurationVersion)
      throw new AppError(
        "configuration_changed",
        "O acesso mudou durante a autenticação.",
        409,
      );
    this.cache.set(key, {
      token: result.accessToken,
      expires: result.expiresOn?.getTime() || Date.now() + 300000,
    });
    return result.accessToken;
  }
  clear() {
    this.cache.clear();
  }
}
