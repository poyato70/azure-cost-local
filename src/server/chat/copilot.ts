import { assertArmChatScope } from "../mcp/arm-policy.js";
import { emitHubEvidence } from "../hubs/evidence.js";
import type { HubService } from "../hubs/service.js";
import { hubOperation } from "../../shared/hubs.js";
import {
  CopilotClient,
  RuntimeConnection,
  defineTool,
  type CopilotSession,
} from "@github/copilot-sdk";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  executeQuestionTool,
  ensureQuestionScope,
  restrictedSessionConfig,
  toolParameters,
  type QueryServices,
} from "./tools.js";
import { AppError, assertActive } from "../errors.js";
import type {
  RequestContext,
  Scope,
  CostQuery,
  ChatEvent,
} from "../../shared/contracts.js";
import { resolveCopilotPath } from "./runtime.js";
import type { McpRegistry } from "../mcp/registry.js";
import type { DataSelection } from "../../shared/connections.js";
import { z } from "zod";
export class CopilotChat {
  private client?: CopilotClient;
  private starting?: Promise<CopilotClient>;
  private busy = new Set<string>();
  constructor(
    private services: QueryServices,
    private mcps?: McpRegistry,
    private hubs?: HubService,
  ) {}
  private async getClient() {
    if (this.client) return this.client;
    if (!this.starting)
      this.starting = (async () => {
        const cwd = join(tmpdir(), "azure-cost-local-empty");
        await mkdir(cwd, { recursive: true });
        const client = new CopilotClient({
          mode: "empty",
          baseDirectory: join(homedir(), ".copilot"),
          workingDirectory: cwd,
          connection: RuntimeConnection.forStdio({
            path: resolveCopilotPath(),
          }),
        });
        await client.start();
        this.client = client;
        return client;
      })().catch((e) => {
        this.starting = undefined;
        throw e;
      });
    return this.starting;
  }
  async status() {
    try {
      const client = await this.getClient();
      const auth = await client.getAuthStatus();
      return {
        available: auth.isAuthenticated,
        message: auth.isAuthenticated
          ? "Copilot CLI autenticado. As ferramentas são verificadas antes de cada pergunta."
          : "Entre no Copilot CLI para habilitar o chat.",
      };
    } catch {
      return {
        available: false,
        message:
          "Copilot CLI indisponível ou incompatível. Consulte a configuração local.",
      };
    }
  }
  async ask(
    ctx: RequestContext,
    input: {
      message: string;
      scope?: Scope;
      basis: CostQuery["basis"];
      selection?: DataSelection;
    },
    emit: (e: ChatEvent) => void,
  ) {
    ensureQuestionScope(input.message, input.scope);
    if (this.busy.has(ctx.sessionId))
      throw new AppError("invalid_request", "Aguarde a resposta anterior.");
    this.busy.add(ctx.sessionId);
    let session: CopilotSession | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let client: CopilotClient | undefined;
    const controller = new AbortController();
    const abort = () => controller.abort();
    ctx.signal.addEventListener("abort", abort, { once: true });
    const localCtx = {
      ...ctx,
      signal: AbortSignal.any([ctx.signal, controller.signal]),
    };
    let calls = 0;
    let unwatchHub: (() => void) | undefined;
    try {
      if (input.selection?.hubId && this.hubs)
        unwatchHub = await this.hubs.watch(input.selection.hubId, controller);
      client = await this.getClient();
      if (!(await client.getAuthStatus()).isAuthenticated)
        throw new AppError(
          "unauthenticated",
          "Entre primeiro no Copilot CLI.",
          401,
        );
      let tool: any = defineTool("azure_query", {
        description:
          "Consulta somente o escopo selecionado no dashboard. Sem período usa dois meses civis completos anteriores. Operações: custos, previsão (forecast, padrão mês atual), comparação, budgets, Reservations e Savings Plans.",
        parameters: toolParameters,
        skipPermission: true,
        handler: async (args) => {
          assertActive(localCtx.signal);
          if (++calls > 10) {
            controller.abort();
            throw new AppError(
              "invalid_request",
              "Limite de dez consultas por pergunta atingido.",
            );
          }
          const result = await executeQuestionTool(
            this.services,
            localCtx,
            input.scope,
            input.basis,
            args,
          );
          assertActive(localCtx.signal);
          const cost = result.current || result;
          if (cost?.forecastTotals)
            emit({ type: "forecastEvidence", result: cost });
          else if (cost?.meta) emit({ type: "result", result: cost });
          return JSON.stringify(result);
        },
      });
      if (input.selection?.source === "mcp" && !input.selection?.hubId) {
        const id = input.selection.mcpConnectionId;
        if (!id || !this.mcps)
          throw new AppError("invalid_request", "Selecione uma conexão MCP.");
        const profile = await this.mcps.get(id);
        if (profile.preset === "arm")
          assertArmChatScope(profile.resourceContext.scope || "", input.scope);
        tool = defineTool("mcp_query", {
          description:
            "Descobrir ferramentas de leitura aprovadas e consultar o MCP selecionado. operation list descobre schemas; call executa somente ferramenta aprovada.",
          parameters: z
            .object({
              operation: z.enum(["list", "call"]),
              name: z.string().optional(),
              arguments: z.record(z.string(), z.unknown()).optional(),
            })
            .strict(),
          skipPermission: true,
          handler: async (args) => {
            assertActive(localCtx.signal);
            if (++calls > 10)
              throw new AppError(
                "limit_exceeded",
                "Limite de consultas atingido.",
              );
            if (args.operation === "list")
              return JSON.stringify(
                (await this.mcps!.tools(localCtx, id)).filter(
                  (t) => t.reviewable && t.approved,
                ),
              );
            if (!args.name)
              throw new AppError(
                "invalid_request",
                "Ferramenta não informada.",
              );
            const result = await this.mcps!.call(
              localCtx,
              id,
              args.name,
              args.arguments || {},
            );
            assertActive(localCtx.signal);
            emit({ type: "mcpEvidence", result });
            return JSON.stringify(result);
          },
        });
      }
      if (input.selection?.hubId) {
        const hubId = input.selection.hubId;
        tool = defineTool("finops_hub", {
          description:
            "Consulta Hub para RG nos dois meses civis completos: custos, conciliação informativa e recomendações de benefícios disponíveis.",
          parameters: z.object({ operation: hubOperation }).strict(),
          skipPermission: true,
          handler: async (args) => {
            if (++calls > 10)
              throw new AppError(
                "limit_exceeded",
                "Limite de consultas atingido.",
              );
            if (!this.hubs || !input.scope)
              throw new AppError("invalid_request", "Selecione um RG e Hub.");
            const r = await this.hubs.run(
              localCtx,
              hubId,
              input.scope,
              input.basis,
              args.operation,
            );
            assertActive(localCtx.signal);
            emitHubEvidence(r, emit);
            return JSON.stringify(r);
          },
        });
      }
      localCtx.diagnose?.({
        source: "Copilot",
        operation: "tools disponíveis nesta pergunta",
        status: "catálogo",
        detail:
          tool.name +
          ". " +
          (tool.name === "mcp_query"
            ? "Modo MCP: custos reais só podem ser consultados se uma tool aprovada oferecer esses dados. pricing_get fornece preços, não gastos."
            : "Ferramentas mediadas pela aplicação; consulta de dados depende de chamada do modelo."),
      });
      const allowedName = tool.name;
      session = await client.createSession(restrictedSessionConfig([tool]));
      await session.rpc.tools.initializeAndValidate();
      const metadata = await session.rpc.tools.getCurrentMetadata();
      const items = (metadata as any).tools;
      if (
        !Array.isArray(items) ||
        items.some((x: any) => x.name !== allowedName) ||
        !items.some((x: any) => x.name === allowedName)
      )
        throw new AppError(
          "forbidden",
          "O catálogo de ferramentas do Copilot não pôde ser restringido. Chat desativado.",
          403,
        );
      const activeSession = session;
      const onAbort = () => {
        void activeSession.abort().catch(() => {});
      };
      localCtx.signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => controller.abort(), 120000);
      try {
        const response = await session.sendAndWait(
          {
            prompt: `Data atual: ${new Date().toISOString()}. Escopo autorizado: ${JSON.stringify(input.scope || null)}. Base: ${input.basis}. Pergunta: ${input.message}`,
          },
          120000,
        );
        assertActive(localCtx.signal);
        localCtx.diagnose?.({
          source: "Copilot",
          operation: "resposta concluída",
          status: "concluído",
          detail:
            calls +
            " interação(ões) com tools nesta pergunta. Se não houver evento de execução de leitura MCP/Azure, o modelo respondeu sem consultar esses dados.",
        });
        emit({
          type: "text",
          text: (
            response?.data.content || "Nenhuma resposta foi retornada."
          ).slice(0, 8000),
        });
      } finally {
        localCtx.signal.removeEventListener("abort", onAbort);
      }
    } finally {
      unwatchHub?.();
      if (timer) clearTimeout(timer);
      controller.abort();
      ctx.signal.removeEventListener("abort", abort);
      this.busy.delete(ctx.sessionId);
      if (session && client) {
        const id = session.sessionId;
        await session.disconnect().catch(() => {});
        await client.deleteSession(id).catch(() => {});
      }
    }
  }
  async close() {
    await this.client?.stop();
  }
}
