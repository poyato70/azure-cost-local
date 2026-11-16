import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { RequestContext } from "../../shared/contracts.js";
import type { McpRegistry } from "./registry.js";
import { AppError } from "../errors.js";
import { OrchestrationStore, type StoredFlow } from "./orchestration-store.js";
import { sanitizeEvidence } from "../multicloud/sanitize.js";
import { resolveTesseractDataDirectory } from "../storage/data-directory.js";
import { correlateFinOps, finOpsPeriodSchema, hasFinOpsCostOutsideScope, projectFinOpsCostRows, type FinOpsPeriod } from "../finops/correlation.js";

export type McpFlow = Omit<
  StoredFlow,
  "ownerId" | "createdAt" | "updatedAt" | "idempotencyKey"
> &
  Partial<
    Pick<StoredFlow, "ownerId" | "createdAt" | "updatedAt" | "idempotencyKey">
  >;
export type FinOpsCorrelationRequest = {
  serverA: string;
  toolA: string;
  serverB: string;
  toolB: string;
  idempotencyKey?: string;
  scope: string;
  period: FinOpsPeriod;
  confirmedA: true;
};
const outputObject = (result: any) => {
  const value = result?.result?.structuredContent ?? result?.structuredContent;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError(
      "invalid_request",
      "A etapa A não retornou conteúdo estruturado utilizável.",
    );
  return value as Record<string, unknown>;
};
const safeError = (e: unknown) =>
  e instanceof AppError
    ? `${e.code}: ${e.message}`
    : "Falha inesperada; resultado externo pode ser desconhecido. Consulte o servidor MCP antes de qualquer repetição.";
const isIndeterminate = (e: unknown) =>
  !(e instanceof AppError) || e.code === "mcp_result_indeterminate";
const persistableResult = (value: any) => {
  const source =
    value?.structuredContent && typeof value.structuredContent === "object"
      ? { structuredContent: value.structuredContent, isError: !!value.isError }
      : { summary: "Resultado estruturado omitido por não estar disponível." };
  const json = JSON.stringify(source);
  return json.length <= 16384
    ? source
    : { summary: "Resultado omitido: excedeu o limite de retenção (16 KiB)." };
};

export class McpOrchestration {
  constructor(
    private mcps: McpRegistry,
    private store = new OrchestrationStore(
      resolveTesseractDataDirectory("Tesseract", "orchestrations.json"),
    ),
  ) {}
  async init() {
    await this.store.locked(() => this.store.init());
  }
  private async persist(flow: McpFlow) {
    flow.updatedAt = new Date().toISOString();
    await this.store.locked(() => this.store.save(flow as StoredFlow));
  }
  async get(sessionId: string, id: string, ownerId = `session:${sessionId}`) {
    const flow = (await this.store.get(id)) as McpFlow | undefined;
    if (!flow || flow.ownerId !== ownerId)
      throw new AppError(
        "not_found",
        "Execução não encontrada para este proprietário.",
        404,
      );
    return flow;
  }
  async list(ownerId: string) {
    return (await this.store.list(ownerId)).map((x) =>
      this.publicView(x as McpFlow),
    );
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
    const ownerId = ctx.userId
      ? `user:${ctx.userId}`
      : `session:${ctx.sessionId}`;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          serverA: input.serverA,
          toolA: input.toolA,
          argsA: input.argsA,
          serverB: input.serverB,
          toolB: input.toolB,
        }),
      )
      .digest("hex");
    const flow: McpFlow = {
      id: randomUUID(),
      ownerId,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      processId: process.pid,
      sessionId: ctx.sessionId,
      requestId: ctx.requestId || randomUUID(),
      state: "running_a",
      stage: "A",
      serverA: { id: input.serverA, tool: input.toolA },
      serverB: { id: input.serverB, tool: input.toolB },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [],
    };
    let externalCallIssued = false;
    const reserved=await this.store.withLock(async()=>{
      const old=input.idempotencyKey?await this.store.findIdempotency(ownerId,input.idempotencyKey):undefined;
      if(old) {
        if(old.fingerprint!==fingerprint) throw new AppError("invalid_request","Chave idempotente já vinculada a outra solicitação.",409);
        return old as McpFlow;
      }
      flow.state="running_a";
      await this.store.save(flow as StoredFlow);
      return undefined;
    });
    if (reserved) return reserved;
    try {
      flow.state="running_a";
      this.event(ctx,flow,"A","enviada","Chamada MCP A enviada; execução sem retry.");
      await this.persist(flow);
      externalCallIssued = true;
      const a = await this.mcps.call(
        ctx,
        input.serverA,
        input.toolA,
        input.argsA,
        undefined,
        input.confirmedA,
      );
      flow.resultA = persistableResult(sanitizeEvidence(a.result));
      await this.persist(flow);
      const data = outputObject(a),
        argsB = {
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
      const bProfile = await this.mcps.get(input.serverB);
      flow.bConfigurationVersion = bProfile.configurationVersion;
      const toolsB = await this.mcps.tools(ctx, input.serverB),
        b = toolsB.find((tool: any) => tool.name === input.toolB);
      if (!b)
        throw new AppError(
          "unsupported",
          "Ferramenta B não encontrada; etapa B não executada.",
        );
      this.event(
        ctx,
        flow,
        "A",
        "concluída",
        "Resultado estruturado A preservado; campos necessários mapeados para B.",
      );
      flow.state =
        b._meta?.["tesseract/approval"] === "each-call"
          ? "awaiting_b_confirmation"
          : "running_b";
      if (flow.state === "awaiting_b_confirmation") {
        flow.sessionId = ctx.sessionId;
        flow.approvalSessionId = ctx.sessionId;
        flow.bSchemaHash = b.schemaHash;
        this.event(
          ctx,
          flow,
          "B",
          "aguardando_autorização",
          `Confirmação explícita necessária para ${input.toolB}.`,
        );
        await this.persist(flow);
        return flow;
      }
      await this.persist(flow);
      return await this.runB(ctx, flow, argsB, false);
    } catch (error) {
      if (flow.state === "awaiting_b_confirmation") throw error;
      const persistenceFailure =
        error instanceof AppError && error.code.startsWith("storage_");
      flow.state =
        isIndeterminate(error) ||
        (externalCallIssued && persistenceFailure)
          ? "indeterminate"
          : "failed";
      flow.error = safeError(error);
      this.event(
        ctx,
        flow,
        flow.stage,
        flow.state,
        "Etapa interrompida. Nenhuma repetição automática será feita.",
      );
      await this.persist(flow);
      return flow;
    }
  }
  async startFinOpsCorrelation(ctx: RequestContext, input: FinOpsCorrelationRequest) {
    const period = finOpsPeriodSchema.safeParse(input.period);
    if (!period.success || !input.scope.trim() || input.scope.length > 512)
      throw new AppError("invalid_request", "Informe um escopo e intervalo de datas válido.");
    const ownerId = ctx.userId ? `user:${ctx.userId}` : `session:${ctx.sessionId}`;
    const fingerprint = createHash("sha256").update(JSON.stringify({
      serverA: input.serverA, toolA: input.toolA, serverB: input.serverB,
      toolB: input.toolB, scope: input.scope, period: period.data,
    })).digest("hex");
    const flow: McpFlow = {
      id: randomUUID(), kind: "finops-correlation", ownerId,
      finopsRequest: { scope: input.scope, period: period.data },
      idempotencyKey: input.idempotencyKey, fingerprint, processId: process.pid,
      sessionId: ctx.sessionId, requestId: ctx.requestId || randomUUID(),
      state: "running_a", stage: "A",
      serverA: { id: input.serverA, tool: input.toolA },
      serverB: { id: input.serverB, tool: input.toolB },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [],
    };
    const existing = await this.store.withLock(async () => {
      const old = input.idempotencyKey ? await this.store.findIdempotency(ownerId, input.idempotencyKey) : undefined;
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new AppError("invalid_request", "Chave idempotente já vinculada a outra solicitação.", 409);
        return old as McpFlow;
      }
      await this.store.save(flow as StoredFlow);
      return undefined;
    });
    if (existing) return existing;
    let issued = false;
    try {
      const args = { scope: input.scope, from: input.period.from, toExclusive: input.period.toExclusive };
      this.event(ctx, flow, "A", "enviada", "Consulta sintética de custos enviada sem retry.");
      await this.persist(flow);
      issued = true;
      const a = await this.mcps.call(ctx, input.serverA, input.toolA, args, undefined, input.confirmedA);
      const aData = outputObject(a);
      if (!Array.isArray(aData.rows))
        throw new AppError("invalid_request", "A tool A não retornou uma lista de linhas de custos; B não foi chamado.");
      if (hasFinOpsCostOutsideScope(aData.rows, input.scope))
        throw new AppError("invalid_request", "A tool A retornou custos fora do escopo solicitado; B não foi chamado.");
      if (aData.rows.length > 250)
        throw new AppError("invalid_request", "A consulta excede o limite de 250 linhas de custos; B não foi chamado.");
      const persistedA = { structuredContent: { rows: projectFinOpsCostRows(aData.rows) } };
      if (JSON.stringify(persistedA).length > 16384)
        throw new AppError("invalid_request", "Resultado de custos excede o limite seguro de persistência (16 KiB); B não foi chamado.");
      flow.resultA = persistedA;
      await this.persist(flow);
      flow.stage = "B";
      const profileB = await this.mcps.get(input.serverB);
      flow.bConfigurationVersion = profileB.configurationVersion;
      const toolB = (await this.mcps.tools(ctx, input.serverB)).find((t: any) => t.name === input.toolB);
      if (!toolB) throw new AppError("unsupported", "Ferramenta de inventário B não encontrada.");
      this.event(ctx, flow, "A", "concluída", "Linhas de custo estruturadas preservadas para correlação local.");
      if (toolB._meta?.["tesseract/approval"] === "each-call") {
        flow.state = "awaiting_b_confirmation";
        flow.sessionId = ctx.sessionId;
        flow.approvalSessionId = ctx.sessionId;
        flow.bSchemaHash = toolB.schemaHash;
        this.event(ctx, flow, "B", "aguardando_autorização", `Confirmação independente necessária para ${input.toolB}.`);
        await this.persist(flow);
        return flow;
      }
      return await this.runFinOpsB(ctx, flow, false);
    } catch (error) {
      if (flow.state === "awaiting_b_confirmation") throw error;
      const persistenceFailure = error instanceof AppError && error.code.startsWith("storage_");
      flow.state = isIndeterminate(error) || (issued && persistenceFailure) ? "indeterminate" : "failed";
      flow.error = safeError(error);
      this.event(ctx, flow, flow.stage, flow.state, "Etapa interrompida; nenhuma chamada será repetida automaticamente.");
      await this.persist(flow);
      return flow;
    }
  }
  async confirm(ctx: RequestContext, id: string) {
    const flow = await this.get(
      ctx.sessionId,
      id,
      ctx.userId ? `user:${ctx.userId}` : `session:${ctx.sessionId}`,
    );
    if (flow.state !== "awaiting_b_confirmation") return flow;
    if (flow.sessionId !== ctx.sessionId)
      throw new AppError(
        "forbidden",
        "A aprovação pendente pertence a outra sessão; inicie uma nova autorização.",
        403,
      );
    const current = await this.mcps.get(flow.serverB.id);
    if (current.configurationVersion !== flow.bConfigurationVersion)
      throw new AppError(
        "configuration_changed",
        "A conexão B mudou desde a aprovação; revise e inicie uma nova execução.",
        409,
      );
    const currentTools = await this.mcps.tools(ctx, flow.serverB.id),
      currentTool = currentTools.find((t: any) => t.name === flow.serverB.tool);
    if (
      !currentTool ||
      currentTool.schemaHash !== flow.bSchemaHash ||
      currentTool._meta?.["tesseract/approval"] !== "each-call"
    )
      throw new AppError(
        "configuration_changed",
        "Schema ou política de B mudou desde a aprovação; inicie uma nova execução.",
        409,
      );
    const data = outputObject({ result: flow.resultA }),
      args = {
        amount: data.amount,
        currency: data.currency,
        period: data.period,
      };
    if (flow.kind === "finops-correlation") {
      flow.state = "running_b";
      await this.persist(flow);
      return this.runFinOpsB(ctx, flow, true);
    }
    flow.state = "running_b";
    await this.persist(flow);
    return this.runB(ctx, flow, args, true);
  }
  publicView(
    flow: McpFlow,
  ): Omit<
    McpFlow,
    | "sessionId"
    | "ownerId"
    | "idempotencyKey"
    | "approvalSessionId"
    | "fingerprint"
    | "processId"
  > {
    const {
      sessionId: _s,
      ownerId: _o,
      idempotencyKey: _k,
      approvalSessionId: _approval,
      fingerprint: _fingerprint,
      processId: _processId,
      ...visible
    } = flow;
    return visible;
  }
  private async runB(
    ctx: RequestContext,
    flow: McpFlow,
    args: Record<string, unknown>,
    confirmed: boolean,
  ) {
    flow.stage = "B";
    flow.state = "running_b";
    this.event(ctx,flow,"B","enviada","Argumentos mapeados enviados a B após autorização aplicável; execução sem retry.");
    await this.persist(flow);
    try {
      const b = await this.mcps.call(
        ctx,
        flow.serverB.id,
        flow.serverB.tool,
        args,
        undefined,
        confirmed,
      );
      flow.resultB = persistableResult(sanitizeEvidence(b.result));
      flow.state = "succeeded";
      this.event(ctx, flow, "B", "concluída", "Resultado MCP B registrado.");
    } catch (error) {
      flow.state = isIndeterminate(error) ? "indeterminate" : "failed";
      flow.error = safeError(error);
      this.event(
        ctx,
        flow,
        "B",
        flow.state,
        "Resultado A mantido; nenhuma repetição automática será feita.",
      );
    }
    await this.persist(flow);
    return flow;
  }
  private async runFinOpsB(ctx: RequestContext, flow: McpFlow, confirmed: boolean) {
    flow.stage = "B";
    flow.state = "running_b";
    this.event(ctx, flow, "B", "enviada", "Consulta de inventário enviada após autorização aplicável; execução sem retry.");
    await this.persist(flow);
    try {
      const request = flow.finopsRequest!;
      const b = await this.mcps.call(ctx, flow.serverB.id, flow.serverB.tool, {
        scope: request.scope, from: request.period.from, toExclusive: request.period.toExclusive,
      }, undefined, confirmed);
      const aData = outputObject({ result: flow.resultA });
      const bData = outputObject(b);
      if (!Array.isArray(aData.rows) || !Array.isArray(bData.rows))
        throw new AppError("invalid_request", "A ou B não retornou linhas estruturadas compatíveis.");
      flow.resultB = { summary: "Inventário consultado; resposta original omitida após projeção das linhas permitidas." };
      flow.correlation = correlateFinOps({
        correlationId: flow.id,
        requestedScope: request.scope,
        requestedPeriod: request.period,
        sources: {
          costs: { serverId: flow.serverA.id, tool: flow.serverA.tool, executionId: `${flow.requestId}:A` },
          inventory: { serverId: flow.serverB.id, tool: flow.serverB.tool, executionId: `${flow.requestId}:B` },
        },
        costRows: aData.rows,
        inventoryRows: bData.rows,
      });
      if (JSON.stringify(flow.correlation).length > 131072)
        throw new AppError("invalid_request", "Correlação excede o limite de retenção seguro (128 KiB).");
      flow.resultA = { summary: "Linhas de custo projetadas para correlação; detalhes derivados preservados na correlação." };
      flow.state = "succeeded";
      this.event(ctx, flow, "B", "concluída", "Inventário consultado e correlação local concluída com proveniência.");
    } catch (error) {
      flow.state = isIndeterminate(error) ? "indeterminate" : "failed";
      flow.error = safeError(error);
      this.event(ctx, flow, "B", flow.state, "Nenhuma repetição automática será feita.");
    }
    await this.persist(flow);
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
