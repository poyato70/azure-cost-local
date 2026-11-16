import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { RequestContext } from "../../shared/contracts.js";
import type { McpRegistry } from "./registry.js";
import { AppError } from "../errors.js";
import { OrchestrationStore, type StoredFlow } from "./orchestration-store.js";
import { sanitizeEvidence } from "../multicloud/sanitize.js";
import { resolveTesseractDataDirectory } from "../storage/data-directory.js";
import { correlateFinOps, finOpsPeriodSchema, hasFinOpsCostOutsideScope, projectFinOpsCostRows, type FinOpsPeriod } from "../finops/correlation.js";
import {
  adaptAzureArmCostResult,
  adaptAzureArmInventoryResult,
  buildAzureCostQueryArguments,
  buildAzureInventoryArguments,
  type AzureCostMetric,
} from "../finops/azure-arm-mcp-adapter.js";

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
  sourceMode?: "synthetic" | "azure-arm-mcp";
  metric?: AzureCostMetric;
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
    const sourceMode = input.sourceMode || "synthetic";
    const metric = input.metric || "ActualCost";
    if (!period.success || !input.scope.trim() || input.scope.length > 512)
      throw new AppError("invalid_request", "Informe um escopo e intervalo de datas válido.");
    if (sourceMode === "azure-arm-mcp") {
      if (input.serverA !== input.serverB || input.toolA !== "query_costs" || input.toolB !== "execute_query")
        throw new AppError("forbidden", "Azure real requer a mesma conexão ARM MCP, query_costs e execute_query.", 403);
      const profile = await this.mcps.get(input.serverA);
      if (profile.preset !== "arm" || profile.resourceContext.scope !== input.scope)
        throw new AppError("forbidden", "O escopo precisa coincidir com o ARM MCP cadastrado.", 403);
      const discovered = await this.mcps.tools(ctx, input.serverA);
      const costTool = discovered.find((tool: any) => tool.name === "query_costs");
      const inventoryTool = discovered.find((tool: any) => tool.name === "execute_query");
      if (!costTool?.reviewable || !costTool.approved || !inventoryTool?.reviewable || !inventoryTool.approved)
        throw new AppError("forbidden", "Aprove individualmente os schemas atuais query_costs e execute_query no Registry.", 403);
      buildAzureCostQueryArguments({ scope: input.scope, period: period.data, metric }, costTool.inputSchema);
      buildAzureInventoryArguments(input.scope, inventoryTool.inputSchema);
    } else if (sourceMode !== "synthetic" || input.serverA === input.serverB) {
      throw new AppError("invalid_request", "O fluxo sintético requer servidores MCP A e B distintos.");
    }
    const ownerId = ctx.userId ? `user:${ctx.userId}` : `session:${ctx.sessionId}`;
    const fingerprint = createHash("sha256").update(JSON.stringify({
      serverA: input.serverA, toolA: input.toolA, serverB: input.serverB,
      toolB: input.toolB, scope: input.scope, period: period.data, sourceMode, metric,
    })).digest("hex");
    const flow: McpFlow = {
      id: randomUUID(), kind: "finops-correlation", ownerId,
      finopsRequest: { scope: input.scope, period: period.data, sourceMode, ...(sourceMode === "azure-arm-mcp" ? { metric } : {}) },
      collection: { sourceMode, ...(sourceMode === "azure-arm-mcp" ? { metric } : {}) },
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
      const costTool = sourceMode === "azure-arm-mcp"
        ? (await this.mcps.tools(ctx, input.serverA)).find((tool: any) => tool.name === input.toolA)
        : undefined;
      const args = sourceMode === "azure-arm-mcp"
        ? buildAzureCostQueryArguments({ scope: input.scope, period: period.data, metric }, costTool?.inputSchema)
        : { scope: input.scope, from: input.period.from, toExclusive: input.period.toExclusive };
      this.event(ctx, flow, "A", "enviada", sourceMode === "azure-arm-mcp"
        ? `Consulta ARM MCP somente leitura enviada; métrica ${metric}; sem retry.`
        : "Consulta sintética de custos enviada sem retry.");
      await this.persist(flow);
      issued = true;
      const a = await this.mcps.call(ctx, input.serverA, input.toolA, args, undefined, input.confirmedA);
      const aData = outputObject(a);
      const adaptedCosts = sourceMode === "azure-arm-mcp"
        ? adaptAzureArmCostResult({ payload: aData, scope: input.scope, period: period.data, metric, serverId: input.serverA })
        : { rows: aData.rows as unknown[], status: "complete" as const, reasons: [] as string[], rejectedRows: 0 };
      if (!Array.isArray(adaptedCosts.rows))
        throw new AppError("invalid_request", "A tool A não retornou linhas compatíveis; B não foi chamado.");
      if (hasFinOpsCostOutsideScope(adaptedCosts.rows, input.scope))
        throw new AppError("invalid_request", "A tool A retornou custos fora do escopo solicitado; B não foi chamado.");
      if (adaptedCosts.rows.length > 250)
        throw new AppError("invalid_request", "A consulta excede o limite de 250 linhas de custos; B não foi chamado.");
      flow.collection!.costs = { status: adaptedCosts.status, reasons: adaptedCosts.reasons, rejectedRows: adaptedCosts.rejectedRows };
      const persistedA = { structuredContent: { rows: projectFinOpsCostRows(adaptedCosts.rows) } };
      if (JSON.stringify(persistedA).length > 16384)
        throw new AppError("invalid_request", "Resultado de custos excede o limite seguro de persistência (16 KiB); B não foi chamado.");
      flow.resultA = persistedA;
      await this.persist(flow);
      flow.stage = "B";
      const profileB = await this.mcps.get(input.serverB);
      flow.bConfigurationVersion = profileB.configurationVersion;
      const toolB = (await this.mcps.tools(ctx, input.serverB)).find((t: any) => t.name === input.toolB);
      if (!toolB) throw new AppError("unsupported", "Ferramenta de inventário B não encontrada.");
      this.event(ctx, flow, "A", "concluída", sourceMode === "azure-arm-mcp"
        ? `Linhas de custo adaptadas; coleta ${adaptedCosts.status}; métrica ${metric}.`
        : "Linhas de custo estruturadas preservadas para correlação local.");
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
      const sourceMode = request.sourceMode || "synthetic";
      const inventoryTool = sourceMode === "azure-arm-mcp"
        ? (await this.mcps.tools(ctx, flow.serverB.id)).find((tool: any) => tool.name === flow.serverB.tool)
        : undefined;
      const args = sourceMode === "azure-arm-mcp"
        ? buildAzureInventoryArguments(request.scope, inventoryTool?.inputSchema)
        : { scope: request.scope, from: request.period.from, toExclusive: request.period.toExclusive };
      const b = await this.mcps.call(ctx, flow.serverB.id, flow.serverB.tool, args, undefined, confirmed);
      const aData = outputObject({ result: flow.resultA });
      const bData = outputObject(b);
      if (!Array.isArray(aData.rows) || (sourceMode === "synthetic" && !Array.isArray(bData.rows)))
        throw new AppError("invalid_request", "A ou B não retornou linhas estruturadas compatíveis.");
      const adaptedInventory = sourceMode === "azure-arm-mcp"
        ? adaptAzureArmInventoryResult({ payload: bData, scope: request.scope, serverId: flow.serverB.id })
        : { rows: bData.rows as unknown[], status: "complete" as const, reasons: [] as string[], rejectedRows: 0 };
      flow.collection!.inventory = { status: adaptedInventory.status, reasons: adaptedInventory.reasons, rejectedRows: adaptedInventory.rejectedRows };
      flow.resultB = { summary: "Inventário consultado; resposta original omitida após projeção das linhas permitidas." };
      const correlation = correlateFinOps({
        correlationId: flow.id,
        requestedScope: request.scope,
        requestedPeriod: request.period,
        sources: {
          costs: { serverId: flow.serverA.id, tool: flow.serverA.tool, executionId: `${flow.requestId}:A` },
          inventory: { serverId: flow.serverB.id, tool: flow.serverB.tool, executionId: `${flow.requestId}:B` },
        },
        costRows: aData.rows,
        inventoryRows: adaptedInventory.rows,
      });
      flow.correlation = correlation;
      if (sourceMode === "azure-arm-mcp" || flow.collection?.costs?.status !== "complete" || adaptedInventory.status !== "complete")
        flow.correlation = {
          ...correlation,
          ...(flow.collection?.costs?.status !== "complete" || adaptedInventory.status !== "complete"
            ? { status: "insufficient_data" }
            : {}),
          dataQuality: {
            completeness: flow.collection?.costs?.status === "complete" && adaptedInventory.status === "complete" ? "complete" : "partial",
            sourceTotalReconciliation: "not_available",
            costClassification: "A ferramenta não expôs uma classificação financeira por linha; nenhum crédito foi inferido.",
            note: flow.collection?.costs?.status === "complete" && adaptedInventory.status === "complete"
              ? "Correlação calculada a partir das linhas recebidas; a resposta MCP não fornece um total independente da fonte para reconciliação financeira."
              : "Os resultados são parciais ou contêm linhas inválidas; totais e associações não representam uma reconciliação completa.",
            costs: flow.collection?.costs,
            inventory: flow.collection?.inventory,
          },
        };
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
