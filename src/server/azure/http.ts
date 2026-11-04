import type { RequestContext } from "../../shared/contracts.js";
import { AppError, assertActive } from "../errors.js";
export class ArmHttp {
  constructor(
    private token: (ctx: RequestContext) => Promise<string>,
    private fetcher: typeof fetch = fetch,
    private sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}
  async request(
    ctx: RequestContext,
    path: string,
    body?: unknown,
  ): Promise<any> {
    assertActive(ctx.signal);
    const url = new URL(path, "https://management.azure.com");
    if (
      url.origin !== "https://management.azure.com" ||
      url.username ||
      url.password
    )
      throw new AppError("invalid_request", "Endpoint Azure recusado.");
    for (let attempt = 0; attempt < 3; attempt++) {
      assertActive(ctx.signal);
      const token = await this.token(ctx);
      const r = await this.fetcher(url, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctx.signal,
        redirect: "error",
      });
      ctx.diagnose?.({
        source: "Azure Resource Manager",
        operation: url.pathname,
        status: String(r.status),
        detail: r.ok
          ? "Azure respondeu à consulta."
          : r.status === 403
            ? "Azure negou acesso ao escopo. Verifique RBAC da identidade ativa; não é falha de configuração MCP."
            : r.status === 401
              ? "Token não aceito ou sessão expirada."
              : "Falha na consulta Azure; pode haver limite, recurso indisponível ou parâmetros incompatíveis.",
      });
      if (r.ok) {
        assertActive(ctx.signal);
        return r.status === 204 ? {} : await r.json();
      }
      if ([429, 503].includes(r.status) && attempt < 2) {
        const retry = r.headers.get("retry-after");
        const seconds = retry ? Number(retry) : NaN;
        const wait = Number.isFinite(seconds)
          ? seconds * 1000
          : retry
            ? Math.max(0, Date.parse(retry) - Date.now())
            : 1000 * (attempt + 1);
        if (wait > 60000)
          throw new AppError(
            "throttled",
            "Azure solicitou espera maior que um minuto. Tente novamente depois.",
            429,
          );
        await this.sleep(Math.max(0, wait));
        continue;
      }
      let providerCode = "";
      try {
        const b: any = await r.json();
        const code = b?.error?.code;
        if (typeof code === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(code))
          providerCode = code;
      } catch {
        /* O corpo de erro não é registrado. */
      }
      if (providerCode)
        ctx.diagnose?.({
          source: "Azure Resource Manager",
          operation: url.pathname,
          status: String(r.status),
          detail:
            "Código retornado pelo Azure: " +
            providerCode +
            ". Corpo bruto omitido para proteger dados e credenciais.",
        });
      const status = r.status;
      throw new AppError(
        status === 401
          ? "unauthenticated"
          : status === 403
            ? "forbidden"
            : status === 429
              ? "throttled"
              : [400, 404, 422].includes(status)
                ? "unsupported"
                : "upstream",
        status === 403
          ? "Sem permissão Azure neste escopo."
          : status === 401
            ? "Sessão Azure expirada."
            : `Consulta Azure indisponível (HTTP ${status}).`,
        status === 401 || status === 403 || status === 429 ? status : 502,
      );
    }
    throw new AppError("upstream", "Consulta não concluída.", 502);
  }
  async list(ctx: RequestContext, path: string) {
    const seen = new Set<string>();
    const items: any[] = [];
    let next: string | undefined = path;
    let partial = false;
    while (next) {
      const url = new URL(next, "https://management.azure.com");
      if (
        url.origin !== "https://management.azure.com" ||
        seen.has(url.href) ||
        seen.size >= 50
      ) {
        partial = true;
        break;
      }
      seen.add(url.href);
      const data = await this.request(ctx, url.href);
      items.push(...(Array.isArray(data.value) ? data.value : []));
      next = data.nextLink;
      if (items.length >= 20000) {
        partial = true;
        break;
      }
    }
    return { items, partial };
  }
}
