import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  mcpInput,
  type McpProfile,
  type ToolDescriptor,
} from "../../shared/connections.js";
import type { RequestContext } from "../../shared/contracts.js";
import type { ConfigStore } from "../storage/config-store.js";
import type { SecretStore } from "../storage/secret-store.js";
import type { AccessService } from "../connections/access-service.js";
import type { Invalidation } from "../connections/invalidation.js";
import type { IdentityProvider } from "../auth/identity-provider.js";
import { AppError, assertActive } from "../errors.js";
import { fetchBound, validateEndpoint } from "../security/endpoint-policy.js";
import { presets, capability, httpAudience } from "./presets.js";
import {
  descriptor,
  authorizeTool,
  reviewable,
  safeToolResult,
} from "./tool-policy.js";
type Live = {
  client: Client;
  profile: McpProfile;
  tools: ToolDescriptor[];
  controller: AbortController;
  unwatch: () => void;
  sessionId: string;
};
export class McpRegistry {
  private live = new Map<string, Live>();
  private states = new Map<string, unknown>();
  constructor(
    private store: ConfigStore,
    private vault: SecretStore,
    private accesses: AccessService,
    private gate: Invalidation,
    private identity: IdentityProvider,
  ) {}
  async list() {
    return (await this.store.read()).mcpProfiles.map((p) => ({
      ...p,
      capability: capability(p),
      status: this.states.get(p.id) || "cadastrado",
    }));
  }
  async get(id: string) {
    const p = (await this.store.read()).mcpProfiles.find((x) => x.id === id);
    if (!p)
      throw new AppError("invalid_request", "Conexão MCP não encontrada.", 404);
    return p;
  }
  async save(raw: unknown) {
    const v = mcpInput.parse(raw);
    if (v.transport === "http") {
      if (!v.endpoint)
        throw new AppError(
          "invalid_endpoint",
          "Informe a URL da instância MCP.",
        );
      httpAudience(v as any);
      await validateEndpoint(v.endpoint, v.allowPrivateNetwork);
    }
    if (
      v.preset === "adx" &&
      (!v.resourceContext.clusterUri || !v.resourceContext.database)
    )
      throw new AppError(
        "invalid_request",
        "ADX requer clusterUri e database.",
      );
    if (v.preset === "powerbi" && !v.resourceContext.modelId)
      throw new AppError("invalid_request", "Power BI requer modelId.");
    let saved!: McpProfile;
    await this.store.mutate((s) => {
      if (v.accessId && !s.accessProfiles.some((a) => a.id === v.accessId))
        throw new AppError("invalid_request", "Acesso salvo não encontrado.");
      const old = s.mcpProfiles.find((x) => x.id === v.id);
      if (v.id && !old)
        throw new AppError("invalid_request", "Conexão não encontrada.", 404);
      if (old && v.expectedVersion !== old.configurationVersion)
        throw new AppError(
          "configuration_changed",
          "Conexão alterada. Recarregue.",
          409,
        );
      const { expectedVersion, ...fields } = v;
      saved = {
        ...fields,
        id: old?.id || randomUUID(),
        configurationVersion: (old?.configurationVersion || 0) + 1,
      };
      s.mcpProfiles = s.mcpProfiles.filter((x) => x.id !== saved.id);
      s.mcpProfiles.push(saved);
    });
    this.gate.changed("mcp:" + saved.id);
    await this.disconnect(saved.id);
    return saved;
  }
  async remove(id: string) {
    await this.store.mutate((s) => {
      if (
        (s.hubProfiles || []).some((h) => h.mcpConnectionId === id) ||
        s.agentProfiles.some((a) => a.mcpConnectionIds.includes(id))
      )
        throw new AppError(
          "access_in_use",
          "Remova o vínculo com os agentes antes de excluir.",
          409,
        );
      s.mcpProfiles = s.mcpProfiles.filter((p) => p.id !== id);
    });
    this.gate.changed("mcp:" + id);
    await this.disconnect(id);
  }
  async disconnect(id: string) {
    for (const [key, live] of this.live)
      if (live.profile.id === id) {
        this.live.delete(key);
        live.unwatch();
        live.controller.abort();
        await live.client.close().catch(() => {});
      }
    this.states.delete(id);
  }
  async closeSession(sessionId: string) {
    for (const live of [...this.live.values()])
      if (live.sessionId === sessionId) await this.disconnect(live.profile.id);
  }
  async close() {
    for (const live of [...this.live.values()])
      await this.disconnect(live.profile.id);
  }
  async connect(ctx: RequestContext, id: string) {
    assertActive(ctx.signal);
    const p = await this.get(id),
      cap = capability(p);
    if (cap.status === "unsupported")
      throw new AppError("unsupported", cap.reason);
    if (!p.accessId)
      throw new AppError("invalid_request", "Vincule um acesso salvo ao MCP.");
    const a = await this.accesses.get(p.accessId);
    if (ctx.tenantId !== a.tenantId || ctx.accessId !== a.id)
      throw new AppError(
        "forbidden",
        "Conecte o acesso vinculado a este MCP antes de testar.",
        403,
      );
    if (p.authMode === "delegated" && ctx.principalKind !== "user")
      throw new AppError(
        "forbidden",
        "Esta conexão requer o usuário do acesso vinculado.",
        403,
      );
    const key = ctx.sessionId + "|" + id,
      old = this.live.get(key);
    if (old && old.profile.configurationVersion === p.configurationVersion)
      return old;
    const versions = await this.gate.capture(["access:" + a.id, "mcp:" + id]),
      controller = new AbortController(),
      unwatchConfig = this.gate.watch(versions, controller);
    const abortParent = () => controller.abort();
    ctx.signal.addEventListener("abort", abortParent, { once: true });
    const unwatch = () => {
      unwatchConfig();
      ctx.signal.removeEventListener("abort", abortParent);
    };
    if (ctx.signal.aborted) controller.abort();
    const client = new Client({ name: "azure-cost-local", version: "0.2.0" });
    let transport;
    try {
      if (p.transport === "http") {
        const preset = presets.find((x) => x.id === p.preset)!;
        const endpoint = p.endpoint!;
        await validateEndpoint(endpoint, p.allowPrivateNetwork);
        const expected = new URL(endpoint).origin;
        const audience = httpAudience(p);
        transport = new StreamableHTTPClientTransport(new URL(endpoint), {
          fetch: async (input: any, options: any) => {
            await this.gate.assertCurrent(versions);
            const target =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url;
            if (new URL(target).origin !== expected)
              throw new AppError(
                "invalid_endpoint",
                "O MCP tentou trocar de host.",
              );
            const token =
              p.authMode === "application"
                ? await this.identity.applications.token(a.id, audience)
                : await this.identity.getToken(ctx, audience);
            const headers = new Headers(options?.headers);
            headers.set("Authorization", "Bearer " + token);
            return fetchBound(
              target,
              {
                ...options,
                headers,
                signal: AbortSignal.any([
                  controller.signal,
                  ctx.signal,
                  options?.signal || new AbortController().signal,
                ]),
              },
              p.allowPrivateNetwork,
            );
          },
        });
      } else {
        if (!a.secretRef)
          throw new AppError(
            "auth_configuration",
            "Cadastre o Secret Value para o MCP local.",
          );
        const preset = presets.find((x) => x.id === p.preset)!;
        if (!preset.package || !preset.bin)
          throw new AppError(
            "unsupported",
            "Sem executor local para este preset.",
          );
        const cwd = join(tmpdir(), "azure-cost-mcp");
        await mkdir(cwd, { recursive: true });
        const env: Record<string, string> = {};
        for (const key of [
          "PATH",
          "Path",
          "SystemRoot",
          "WINDIR",
          "USERPROFILE",
          "LOCALAPPDATA",
          "APPDATA",
          "TEMP",
          "TMP",
          "ProgramFiles",
        ])
          if (process.env[key]) env[key] = process.env[key]!;
        Object.assign(env, {
          AZURE_TENANT_ID: a.tenantId,
          AZURE_CLIENT_ID: a.clientId,
          AZURE_CLIENT_SECRET: await this.vault.read(a.secretRef),
          AZURE_TOKEN_CREDENTIALS: "EnvironmentCredential",
        });
        const args = [
          join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
          "exec",
          "--yes",
          "--package",
          preset.package,
          "--",
          preset.bin,
          "server",
          "start",
          "--mode",
          "all",
        ];
        if (p.preset !== "fabric") args.push("--read-only");
        if (p.preset === "adx") args.push("--namespace", "kusto");
        if (p.preset === "azure") {
          const namespace = p.resourceContext.namespace || "pricing";
          if (
            ![
              "pricing",
              "advisor",
              "optimization",
              "subscription",
              "group",
            ].includes(namespace)
          )
            throw new AppError(
              "invalid_request",
              "Namespace Azure não permitido.",
            );
          args.push("--namespace", namespace);
        }
        transport = new StdioClientTransport({
          command: process.execPath,
          args,
          env,
          cwd,
          stderr: "pipe",
          maxBufferSize: 2097152,
        });
        (transport.stderr as any)?.resume();
      }
      await client.connect(transport, { timeout: 60000 });
      const tools: ToolDescriptor[] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const result = await client.listTools(cursor ? { cursor } : undefined, {
          signal: controller.signal,
          timeout: 15000,
        });
        tools.push(...result.tools.map(descriptor));
        if (tools.length > 100)
          throw new AppError(
            "unsupported",
            "Selecione namespaces menores: limite de 100 ferramentas por conexão.",
          );
        cursor = result.nextCursor;
        if (cursor && seen.has(cursor))
          throw new AppError("upstream", "Paginação MCP circular.", 502);
        if (cursor) seen.add(cursor);
      } while (cursor);
      await this.gate.assertCurrent(versions);
      assertActive(ctx.signal);
      const live = {
        client,
        profile: p,
        tools,
        controller,
        unwatch,
        sessionId: ctx.sessionId,
      };
      controller.signal.addEventListener(
        "abort",
        () => {
          this.live.delete(key);
          unwatch();
          void client.close().catch(() => {});
        },
        { once: true },
      );
      this.live.set(key, live);
      ctx.diagnose?.({
        source: "MCP",
        operation: p.name + " / tools/list",
        status: "conectado",
        detail:
          tools.length +
          " tools descobertas: " +
          tools.map((t) => t.name).join(", ") +
          ". Catálogo não comprova permissão de acesso aos dados.",
      });
      this.states.set(id, "conectado — ferramentas descobertas");
      return live;
    } catch (e) {
      unwatch();
      controller.abort();
      await client.close().catch(() => {});
      const message = e instanceof Error ? e.message : "";
      const httpStatus = message.match(
        /\b(401|403|404|429|500|502|503)\b/,
      )?.[1];
      ctx.diagnose?.({
        source: "MCP",
        operation: p.name + " / conectar",
        status:
          e instanceof AppError ? e.code : httpStatus || "mcp_unavailable",
        detail:
          e instanceof AppError
            ? e.message
            : httpStatus === "401"
              ? "Servidor MCP não aceitou a autenticação."
              : httpStatus === "403"
                ? "Servidor MCP negou permissão."
                : "Falha ao iniciar ou negociar o protocolo MCP. Verifique endpoint, transporte e disponibilidade do servidor; nenhuma mensagem bruta de credencial é registrada.",
      });
      if (e instanceof AppError) throw e;
      throw new AppError(
        "mcp_unavailable",
        "Não foi possível conectar ao MCP. Verifique endpoint, permissão e autenticação específica do serviço.",
        502,
      );
    }
  }
  async tools(ctx: RequestContext, id: string) {
    const live = await this.connect(ctx, id);
    return live.tools.map((t) => ({
      ...t,
      reviewable: reviewable(live.profile, t),
      approved: live.profile.approvedTools.some(
        (x) => x.name === t.name && x.schemaHash === t.schemaHash,
      ),
    }));
  }
  async approve(ctx: RequestContext, id: string, names: string[]) {
    const live = await this.connect(ctx, id);
    const tools = names.map((name) => {
      const t = live.tools.find((t) => t.name === name);
      if (!t || !reviewable(live.profile, t))
        throw new AppError(
          "forbidden",
          "Ferramenta não elegível para aprovação.",
          403,
        );
      return { name: t.name, schemaHash: t.schemaHash };
    });
    const { configurationVersion, ...fields } = live.profile;
    return this.save({
      ...fields,
      expectedVersion: configurationVersion,
      approvedTools: tools,
    });
  }
  async call(
    ctx: RequestContext,
    id: string,
    name: string,
    args: Record<string, unknown>,
    registeredQuery?: string,
  ) {
    const live = await this.connect(ctx, id),
      current = await this.get(id);
    const latest = await live.client.listTools(undefined, {
      signal: ctx.signal,
      timeout: 15000,
    });
    const t = latest.tools.map(descriptor).find((t) => t.name === name);
    if (!t) throw new AppError("unsupported", "Ferramenta não encontrada.");
    ctx.diagnose?.({
      source: "MCP",
      operation: current.name + " / " + name,
      status: "validando",
      detail:
        "Verificando aprovação, schema e escopo. Argumentos e credenciais não são registrados.",
    });
    authorizeTool(current, t, args, registeredQuery);
    const validate = new AjvJsonSchemaValidator().getValidator(
      t.inputSchema as any,
    );
    if (!validate(args).valid)
      throw new AppError(
        "invalid_request",
        "Os argumentos não correspondem ao schema desta tool. Confira os campos obrigatórios e os tipos no formulário. Obrigatórios: " +
          ((t.inputSchema as any).required || []).join(", "),
      );
    const versions = await this.gate.capture([
      "mcp:" + id,
      "access:" + current.accessId,
    ]);
    const result = await live.client.callTool(
      { name, arguments: args },
      undefined,
      { signal: ctx.signal, timeout: 60000 },
    );
    await this.gate.assertCurrent(versions);
    assertActive(ctx.signal);
    let commandStatus: number | undefined;
    const payload = (result as any).structuredContent;
    if (typeof payload?.status === "number") commandStatus = payload.status;
    if (commandStatus === undefined)
      for (const c of Array.isArray(result.content) ? result.content : [])
        if (c.type === "text") {
          try {
            const v = JSON.parse(String(c.text));
            if (typeof v.status === "number") commandStatus = v.status;
          } catch {}
        }
    if (
      result.isError ||
      (commandStatus !== undefined && commandStatus >= 400)
    ) {
      ctx.diagnose?.({
        source: "MCP",
        operation: name,
        status: "mcp_tool_failed",
        detail:
          "O MCP retornou erro de execução" +
          (commandStatus !== undefined
            ? " (status " + commandStatus + ")"
            : "") +
          "; a consulta não foi validada.",
      });
      this.states.set(id, "falha na consulta");
      throw new AppError(
        "mcp_tool_failed",
        commandStatus === 400
          ? "A tool MCP recusou os parâmetros (status 400). Confira os campos, SKU e filtros; esta resposta não comprova falha no login."
          : commandStatus === 401
            ? "A tool MCP não aceitou a autenticação (status 401). Reconecte o acesso vinculado."
            : commandStatus === 403
              ? "A tool MCP negou acesso aos dados (status 403). Confira as permissões da identidade ativa."
              : "A tool MCP informou falha na consulta" +
                (commandStatus !== undefined
                  ? " (status " + commandStatus + ")"
                  : "") +
                ". Veja a operação no Diagnóstico.",
        502,
      );
    }
    ctx.diagnose?.({
      source: "MCP",
      operation: current.name + " / " + name,
      status: "sucesso",
      detail:
        "tools/call retornou sem isError; resposta disponível no painel da execução. Isso valida esta chamada, não todas as capacidades Azure.",
    });
    this.states.set(id, "consulta validada");
    return {
      source: "mcp",
      connectionId: id,
      operation: name,
      result: safeToolResult(result),
    };
  }
}
