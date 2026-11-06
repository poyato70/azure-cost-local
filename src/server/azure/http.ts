import type { RequestContext } from "../../shared/contracts.js";
import { AppError, assertActive } from "../errors.js";
export class ArmHttp {
  private cooldowns = new Map<string, number>();
  private limited(seconds: number) {
    return new AppError(
      "throttled",
      `Azure limitou as consultas (HTTP 429). Aguarde ${Math.max(1, Math.ceil(seconds))} segundo(s) antes de consultar este escopo novamente. Não é uma falha de Secret ou de configuração MCP comprovada.`,
      429,
    );
  }
  private async pause(ms: number, signal?: AbortSignal) {
    if (!signal) return this.sleep(ms);
    assertActive(signal);
    let abort: () => void = () => {};
    try {
      await Promise.race([
        this.sleep(ms),
        new Promise<never>((_, reject) => {
          abort = () =>
            reject(
              new AppError(
                "unauthenticated",
                "Consulta cancelada durante a espera.",
                401,
              ),
            );
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
        }),
      ]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
    assertActive(signal);
  }
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
    const scope = url.pathname.split(/\/providers\//i)[0].toLowerCase();
    const key = JSON.stringify([
      ctx.sessionId,
      ctx.tenantId,
      ctx.userId,
      ctx.accessId,
      ctx.configurationVersion,
      scope,
    ]);
    const remaining = (this.cooldowns.get(key) || 0) - Date.now();
    if (remaining > 0) {
      ctx.diagnose?.({
        source: "Azure Resource Manager",
        operation: url.pathname,
        status: "aguardando",
        detail: `Limite já recebido: nova chamada bloqueada por ${Math.ceil(remaining / 1000)}s; nenhum HTTP adicional enviado.`,
      });
      throw this.limited(remaining / 1000);
    }
    this.cooldowns.delete(key);
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
        attempt: attempt + 1,
        detail: r.ok
          ? "Azure respondeu à consulta."
          : r.status === 403
            ? "Azure negou acesso ao escopo. Verifique RBAC da identidade ativa; não é falha de configuração MCP."
            : r.status === 401
              ? "Token não aceito ou sessão expirada."
              : r.status === 429
                ? "Limite de chamadas Azure atingido (429); verificando tempo de espera antes de repetir."
                : "Falha na consulta Azure; verifique status e configuração.",
      });
      if (r.ok) {
        if ((this.cooldowns.get(key) || 0) <= Date.now())
          this.cooldowns.delete(key);
        assertActive(ctx.signal);
        return r.status === 204 ? {} : await r.json();
      }
      if (r.status === 429) {
        const waits: number[] = [];
        for (const [name, raw] of r.headers) {
          if (
            name !== "retry-after" &&
            !/^x-ms-ratelimit-microsoft\.(?:costmanagement|consumption)(?:-[a-z]+)*-retry-after$/i.test(
              name,
            )
          )
            continue;
          const seconds = raw.trim() ? Number(raw) : NaN;
          const ms =
            Number.isFinite(seconds) && seconds >= 0
              ? seconds * 1000
              : name === "retry-after"
                ? Date.parse(raw) - Date.now()
                : NaN;
          if (Number.isFinite(ms) && ms >= 0) waits.push(ms);
        }
        const wait = Math.max(
          1000,
          (this.cooldowns.get(key) || 0) - Date.now(),
          ...waits,
          waits.length ? 0 : 30000,
        );
        for (const [k, expires] of this.cooldowns)
          if (expires <= Date.now()) this.cooldowns.delete(k);
        if (this.cooldowns.size >= 1000)
          this.cooldowns.delete(this.cooldowns.keys().next().value!);
        this.cooldowns.set(key, Date.now() + wait);
        ctx.diagnose?.({
          source: "Azure Resource Manager",
          operation: url.pathname,
          status: "aguardando",
          attempt: attempt + 1,
          detail: `Aguardar ${Math.ceil(wait / 1000)}s. Maior espera válida dos cabeçalhos Azure; na ausência, pausa conservadora de 30s. Nenhum dado financeiro foi retornado.`,
        });
        await r.body?.cancel();
        if (attempt >= 2 || wait > 5000) throw this.limited(wait / 1000);
        await this.pause(wait, ctx.signal);
        continue;
      }
      if (r.status === 503 && attempt < 2) {
        await r.body?.cancel();
        const seconds = Number(r.headers.get("retry-after"));
        const wait =
          Number.isFinite(seconds) && seconds > 0
            ? seconds * 1000
            : 1000 * (attempt + 1);
        if (wait > 5000)
          throw new AppError(
            "upstream",
            "Azure temporariamente indisponível. Tente novamente mais tarde.",
            503,
          );
        await this.pause(wait, ctx.signal);
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
