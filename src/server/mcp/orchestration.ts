import { randomUUID } from "node:crypto";
import type { RequestContext } from "../../shared/contracts.js";
import type { McpRegistry } from "./registry.js";
import { AppError } from "../errors.js";

export type McpFlow = {
  id: string;
  sessionId: string;
  requestId: string;
  state:
    | "running_a"
    | "awaiting_b_confirmation"
    | "running_b"
    | "succeeded"
    | "failed"
    | "indeterminate";
  stage: "A" | "B";
  serverA: { id: string; tool: string };
  serverB: { id: string; tool: string };
  resultA?: unknown;
  resultB?: unknown;
  error?: string;
  events: Array<{
    time: string;
    stage: "A" | "B";
    state: string;
    detail: string;
  }>;
};

const flows = new Map<string, McpFlow>();
const idempotency = new Map<string, string>();
const outputObject = (result: any) => {
  const value = result?.result?.structuredContent ?? result?.structuredContent;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError(
      "invalid_request",
      "A etapa A não retornou conteúdo estruturado utilizável.",
    );
  return value as Record<string, unknown>;
};

export class McpOrchestration {
  constructor(private mcps: McpRegistry) {}
  get(sessionId: string, id: string) {
    const flow = flows.get(id);
    if (!flow || flow.sessionId !== sessionId)
      throw new AppError(
        "not_found",
        "Execução não encontrada nesta sessão.",
        404,
      );
    return flow;
  }
  async start(
    ctx: RequestContext,
    input: {
      serverA: string;
      toolA: string;
      argsA: Record<string, unknown>;
      serverB: string;
      toolB: string;
      idempotencyKey?: string;
      confirmedA: true;
    },
  ) {
    const key = input.idempotencyKey
      ? `${ctx.sessionId}|${input.idempotencyKey}`
      : "";
    const prior = key && idempotency.get(key);
    if (prior) return this.get(ctx.sessionId, prior);
    const flow: McpFlow = {
      id: randomUUID(),
      sessionId: ctx.sessionId,
      requestId: ctx.requestId || randomUUID(),
      state: "running_a",
      stage: "A",
      serverA: { id: input.serverA, tool: input.toolA },
      serverB: { id: input.serverB, tool: input.toolB },
      events: [],
    };
    flows.set(flow.id, flow);
    if (key) idempotency.set(key, flow.id);
    if (flows.size > 100) {
      const oldest = flows.keys().next().value as string | undefined;
      if (oldest) {
        flows.delete(oldest);
        for (const [entry, flowId] of idempotency)
          if (flowId === oldest) idempotency.delete(entry);
      }
    }
    this.event(
      ctx,
      flow,
      "A",
      "enviada",
      "Chamada MCP A enviada; execução sem retry.",
    );
    try {
      const a = await this.mcps.call(
        ctx,
        input.serverA,
        input.toolA,
        input.argsA,
        undefined,
        input.confirmedA,
      );
      flow.resultA = a.result;
      const data = outputObject(a);
      const argsB = {
        amount: data.amount,
        currency: data.currency,
        period: data.period,
      };
      if (
        typeof argsB.amount !== "number" ||
        typeof argsB.currency !== "string" ||
        typeof argsB.period !== "string"
      )
        throw new AppError(
          "invalid_request",
          "Resultado A não contém amount numérico, currency e period textuais; B não foi chamado.",
        );
      flow.stage = "B";
      const toolsB = await this.mcps.tools(ctx, input.serverB);
      const b = toolsB.find((tool: any) => tool.name === input.toolB);
      if (!b)
        throw new AppError(
          "unsupported",
          "Ferramenta B não encontrada; etapa B não executada.",
        );
      flow.events.push({
        time: new Date().toISOString(),
        stage: "A",
        state: "concluída",
        detail:
          "Resultado estruturado A preservado; campos amount, currency e period mapeados para B.",
      });
      flow.state =
        b._meta?.["tesseract/approval"] === "each-call"
          ? "awaiting_b_confirmation"
          : "running_b";
      if (flow.state === "awaiting_b_confirmation") {
        flow.events.push({
          time: new Date().toISOString(),
          stage: "B",
          state: "aguardando_autorização",
          detail: `Confirme ${input.toolB} no servidor selecionado; campos amount, currency e period serão enviados. Valores não são registrados na atividade.`,
        });
        return flow;
      }
      return await this.runB(ctx, flow, argsB, false);
    } catch (error) {
      if (flow.state === "awaiting_b_confirmation") throw error;
      flow.state = !(error instanceof AppError) ? "indeterminate" : "failed";
      flow.error =
        error instanceof Error ? error.message : "Falha na operação MCP.";
      this.event(
        ctx,
        flow,
        flow.stage,
        flow.state,
        "Etapa interrompida. Nenhuma repetição automática será feita.",
      );
      return flow;
    }
  }
  async confirm(ctx: RequestContext, id: string) {
    const flow = this.get(ctx.sessionId, id);
    if (flow.state !== "awaiting_b_confirmation") return flow;
    const data = outputObject({ result: flow.resultA });
    const argsB = {
      amount: data.amount,
      currency: data.currency,
      period: data.period,
    };
    flow.state = "running_b";
    return this.runB(ctx, flow, argsB, true);
  }
  publicView(flow: McpFlow): Omit<McpFlow, "sessionId"> {
    const { sessionId: _sessionId, ...visible } = flow;
    return visible;
  }
  private async runB(
    ctx: RequestContext,
    flow: McpFlow,
    args: Record<string, unknown>,
    confirmed: boolean,
  ) {
    flow.stage = "B";
    this.event(
      ctx,
      flow,
      "B",
      "enviada",
      "Argumentos mapeados enviados a B após autorização aplicável; execução sem retry.",
    );
    try {
      const b = await this.mcps.call(
        ctx,
        flow.serverB.id,
        flow.serverB.tool,
        args,
        undefined,
        confirmed,
      );
      flow.resultB = b.result;
      flow.state = "succeeded";
      this.event(ctx, flow, "B", "concluída", "Resultado MCP B registrado.");
    } catch (error) {
      flow.state = !(error instanceof AppError) ? "indeterminate" : "failed";
      flow.error = error instanceof Error ? error.message : "Falha na etapa B.";
      this.event(
        ctx,
        flow,
        "B",
        flow.state,
        "Resultado A mantido; nenhuma repetição automática será feita.",
      );
    }
    return flow;
  }
  private event(
    ctx: RequestContext,
    flow: McpFlow,
    stage: "A" | "B",
    state: string,
    detail: string,
  ) {
    flow.events.push({ time: new Date().toISOString(), stage, state, detail });
    ctx.diagnose?.({
      requestId: flow.requestId,
      source: "MCP",
      operation: `orquestração ${flow.id} / etapa ${stage} / ${stage === "A" ? flow.serverA.tool : flow.serverB.tool}`,
      status: state,
      detail,
    });
  }
}
