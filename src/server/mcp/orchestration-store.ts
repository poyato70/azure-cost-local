import { mkdir, open, readFile, rename, stat, unlink, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../errors.js";
import { resolvePersistentDirectory, resolveTesseractDataDirectory } from "../storage/data-directory.js";

export type StoredFlow = {
  kind?: "finops-correlation";
  finopsRequest?: {
    scope: string;
    period: { from: string; toExclusive: string };
    sourceMode?: "synthetic" | "azure-arm-mcp";
    metric?: "ActualCost" | "AmortizedCost";
  };
  collection?: {
    sourceMode: "synthetic" | "azure-arm-mcp";
    metric?: "ActualCost" | "AmortizedCost";
    costs?: { status: "complete" | "partial" | "invalid"; reasons: string[]; rejectedRows: number };
    inventory?: { status: "complete" | "partial" | "invalid"; reasons: string[]; rejectedRows: number };
  };
  correlation?: unknown;
  id: string;
  ownerId: string;
  sessionId: string;
  requestId: string;
  processId?: number;
  idempotencyKey?: string;
  fingerprint?: string;
  bConfigurationVersion?: number;
  bSchemaHash?: string;
  approvalSessionId?: string;
  state: string;
  stage: "A" | "B";
  serverA: { id: string; tool: string };
  serverB: { id: string; tool: string };
  resultA?: unknown;
  resultB?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
  events: Array<{
    time: string;
    stage: "A" | "B";
    state: string;
    detail: string;
  }>;
};
type Snapshot = { schemaVersion: 1; flows: StoredFlow[] };
const locks = new Map<string, Promise<unknown>>();
export const ORCHESTRATION_RETENTION = { maxTotal: 500, terminalDays: 30 } as const;
export type OrchestrationStoreIO = {
  open: typeof open;
  rename: typeof rename;
  unlink: typeof unlink;
};
const defaultIO: OrchestrationStoreIO = { open, rename, unlink };

export class OrchestrationStore {
  readonly file: string;
  constructor(
    file?: string,
    private readonly maxRuns: number = ORCHESTRATION_RETENTION.maxTotal,
    private readonly retentionDays: number = ORCHESTRATION_RETENTION.terminalDays,
    private readonly io: OrchestrationStoreIO = defaultIO,
  ) {
    this.file = resolvePersistentDirectory(
      file ?? resolveTesseractDataDirectory("Tesseract", "orchestrations.json"),
      "OrchestrationStore",
    );
  }
  private async mutate<T>(fn: (s: Snapshot) => T): Promise<T> {
    const previous = locks.get(this.file) || Promise.resolve();
    let result!: T;
    const next = previous
      .catch(() => {})
      .then(async () => {
        const snapshot = await this.read();
        const previousCount = snapshot.flows.length;
        result = fn(snapshot);
        const cutoff = Date.now() - this.retentionDays * 86400000;
        snapshot.flows = snapshot.flows.filter(
          (x) =>
            x.state === "indeterminate" ||
            !["succeeded", "failed"].includes(x.state) ||
            Date.parse(x.updatedAt) >= cutoff,
        );
        if (snapshot.flows.length > this.maxRuns) {
          const removable = snapshot.flows
            .filter((x) => ["succeeded", "failed"].includes(x.state))
            .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
          while (snapshot.flows.length > this.maxRuns && removable.length)
            snapshot.flows.splice(
              snapshot.flows.indexOf(removable.shift()!),
              1,
            );
        }
        if (snapshot.flows.length > this.maxRuns && snapshot.flows.length > previousCount)
          throw new AppError(
            "storage_retention_limit",
            "O histórico atingiu o limite; execuções pendentes/indeterminadas não foram removidas. Revise e arquive o histórico antes de iniciar outra execução.",
            507,
          );
        const temp = join(
          dirname(this.file),
          `orchestration-${randomUUID()}.tmp`,
        );
        try {
          const handle: FileHandle = await this.io.open(temp, "wx");
          try {
            await handle.writeFile(JSON.stringify(snapshot), "utf8");
            await handle.sync();
          } finally {
            await handle.close();
          }
          await this.io.rename(temp, this.file);
        } catch (error) {
          await this.io.unlink(temp).catch(() => {});
          throw error;
        }
      });
    locks.set(this.file, next);
    await next;
    return result;
  }
  async read(): Promise<Snapshot> {
    await mkdir(dirname(this.file), { recursive: true });
    try {
      const value = JSON.parse(await readFile(this.file, "utf8"));
      const isRecord = (item: any) =>
        item && typeof item === "object" && !Array.isArray(item);
      if (
        value.schemaVersion !== 1 ||
        !Array.isArray(value.flows) ||
        value.flows.some(
          (f: any) =>
            !isRecord(f) ||
            typeof f.id !== "string" ||
            typeof f.ownerId !== "string" ||
            typeof f.sessionId !== "string" ||
            typeof f.requestId !== "string" ||
            !["A", "B"].includes(f.stage) ||
            !isRecord(f.serverA) ||
            typeof f.serverA.id !== "string" ||
            typeof f.serverA.tool !== "string" ||
            !isRecord(f.serverB) ||
            typeof f.serverB.id !== "string" ||
            typeof f.serverB.tool !== "string" ||
            (f.kind !== undefined && f.kind !== "finops-correlation") ||
            (f.finopsRequest !== undefined &&
              (!isRecord(f.finopsRequest) || typeof f.finopsRequest.scope !== "string" ||
                !isRecord(f.finopsRequest.period) || typeof f.finopsRequest.period.from !== "string" ||
                typeof f.finopsRequest.period.toExclusive !== "string" ||
                (f.finopsRequest.sourceMode !== undefined && !["synthetic", "azure-arm-mcp"].includes(f.finopsRequest.sourceMode)) ||
                (f.finopsRequest.metric !== undefined && !["ActualCost", "AmortizedCost"].includes(f.finopsRequest.metric)))) ||
            (f.collection !== undefined && (!isRecord(f.collection) ||
              !["synthetic", "azure-arm-mcp"].includes(f.collection.sourceMode) ||
              (f.collection.metric !== undefined && !["ActualCost", "AmortizedCost"].includes(f.collection.metric)))) ||
            typeof f.createdAt !== "string" ||
            typeof f.updatedAt !== "string" ||
            (f.processId !== undefined && !Number.isInteger(f.processId)) ||
            ![
              "running_a",
              "running_b",
              "awaiting_b_confirmation",
              "approval_required",
              "succeeded",
              "failed",
              "indeterminate",
            ].includes(f.state) ||
            !Array.isArray(f.events) ||
            f.events.some(
              (event: any) =>
                !isRecord(event) ||
                typeof event.time !== "string" ||
                !["A", "B"].includes(event.stage) ||
                typeof event.state !== "string" ||
                typeof event.detail !== "string",
            ),
        )
      )
        throw new Error("schema");
      return value;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { schemaVersion: 1, flows: [] };
      throw new AppError(
        "storage_corrupt",
        "Histórico de orquestração inválido; arquivo preservado.",
        503,
      );
    }
  }
  async init() {
    await this.mutate((snapshot) => {
      const now = new Date().toISOString();
      for (const flow of snapshot.flows) {
        let processAlive = false;
        if (
          ["running_a", "running_b"].includes(flow.state) &&
          Number.isInteger(flow.processId) &&
          flow.processId! > 0
        ) {
          try {
            process.kill(flow.processId!, 0);
            processAlive = true;
          } catch (error) {
            processAlive =
              (error as NodeJS.ErrnoException).code === "EPERM";
          }
        }
        if (["running_a", "running_b"].includes(flow.state) && !processAlive) {
          flow.state = "indeterminate";
          flow.updatedAt = now;
          flow.error =
            "Processo reiniciado durante chamada; resultado externo desconhecido. Não repetir automaticamente.";
          flow.events.push({
            time: now,
            stage: flow.stage,
            state: "indeterminate",
            detail: "Recuperado após reinício; chamada não reenviada.",
          });
        } else if (flow.state === "awaiting_b_confirmation") {
          flow.state = "approval_required";
          flow.updatedAt = now;
          flow.error =
            "Reinício invalidou a confirmação anterior. Revalide conexão, schema e política antes de autorizar uma nova execução.";
          flow.events.push({
            time: now,
            stage: "B",
            state: "approval_required",
            detail: "A confirmação anterior não foi reutilizada após reinício.",
          });
        }
      }
    });
  }
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.file), { recursive: true });
    const lockPath = this.file + ".lock";
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    const token = randomUUID();
    const deadline = Date.now() + 10000;
    while (!handle) {
      try {
        handle = await open(lockPath, "wx");
        await handle.writeFile(
          JSON.stringify({ token, pid: process.pid, createdAt: new Date().toISOString() }),
          "utf8",
        );
        await handle.sync();
      } catch(e) {
        if (handle) {
          await handle.close().catch(() => {});
          handle = undefined;
          try {
            if (JSON.parse(await readFile(lockPath, "utf8")).token === token)
              await unlink(lockPath);
          } catch {}
        }
        if((e as NodeJS.ErrnoException).code!=="EEXIST") throw new AppError("storage_unavailable","Não foi possível criar o lock do histórico MCP.",503);
        let pid:number|undefined;
        try { pid=JSON.parse(await readFile(lockPath,"utf8")).pid; } catch {}
        let alive=false;
        if(Number.isInteger(pid)&&pid!>0) try { process.kill(pid!,0); alive=true; } catch(error) { alive=(error as NodeJS.ErrnoException).code==="EPERM"; }
        if (!Number.isInteger(pid)) {
          try {
            // The exclusive file appears before its JSON header is durable. Treat a
            // recently-created unreadable header as lock initialization, not a stale lock.
            alive = Date.now() - (await stat(lockPath)).mtimeMs < 10000;
          } catch {}
        }
        if(!alive) throw new AppError("storage_unavailable","Lock do histórico abandonado ou inválido. Inspecione o arquivo .lock antes de removê-lo.",503);
        if(Date.now()>=deadline) throw new AppError("storage_unavailable","Tempo de espera pelo histórico MCP excedido.",503);
        await new Promise(resolve=>setTimeout(resolve,25));
      }
    }
    if(!handle) {
      throw new AppError(
        "storage_unavailable",
        "Outro processo pode estar usando o histórico MCP. Feche a instância duplicada e tente novamente.",
        503,
      );
    }
    try {
      return await fn();
    } finally {
      await handle.close();
      try { if (JSON.parse(await readFile(lockPath,"utf8")).token===token) await unlink(lockPath); } catch {}
    }
  }
  async save(flow: StoredFlow) {
    await this.mutate((s) => {
      const i = s.flows.findIndex((x) => x.id === flow.id);
      if (i < 0) s.flows.push(flow);
      else s.flows[i] = flow;
    });
  }
  async findIdempotency(ownerId: string, key: string) {
    return (await this.read()).flows.find(
      (x) => x.ownerId === ownerId && x.idempotencyKey === key,
    );
  }
  async startOnce<T>(ownerId:string,key:string|undefined,fingerprint:string,create:()=>StoredFlow,run:(flow:StoredFlow)=>Promise<T>):Promise<T> {
    return this.withLock(async()=>{
      const existing=key ? await this.findIdempotency(ownerId,key) : undefined;
      if(existing) {
        if(existing.fingerprint!==fingerprint) throw new AppError("invalid_request","Chave idempotente já vinculada a outra solicitação.",409);
        return existing as unknown as T;
      }
      const flow=create(); await this.save(flow); return run(flow);
    });
  }
  async locked<T>(fn: () => Promise<T>) {
    return this.withLock(fn);
  }
  async get(id: string) {
    return (await this.read()).flows.find((x) => x.id === id);
  }
  async list(ownerId: string, limit = 50) {
    return (await this.read()).flows
      .filter((x) => x.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }
}
