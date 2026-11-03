import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ConfigSnapshot } from "../../shared/connections.js";
import { AppError } from "../errors.js";
import { dpapi } from "./dpapi.js";
const queues = new Map<string, Promise<unknown>>();
export class ConfigStore {
  private initialized?: Promise<void>;
  constructor(
    readonly root = join(
      process.env.LOCALAPPDATA || "",
      "AzureCostLocal",
      "config",
    ),
  ) {
    if (!process.env.LOCALAPPDATA && !root)
      throw new Error("LOCALAPPDATA ausente");
  }
  async init() {
    return (this.initialized ??= (async () => {
      await mkdir(this.root, { recursive: true });
      await dpapi("acl", this.root);
    })());
  }
  async read(): Promise<ConfigSnapshot> {
    await this.init();
    let text: string;
    try {
      text = await readFile(join(this.root, "settings.json"), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return {
          schemaVersion: 1,
          accessProfiles: [],
          mcpProfiles: [],
          agentProfiles: [],
        };
      throw new AppError(
        "storage_unavailable",
        "Não foi possível ler os acessos salvos.",
        503,
      );
    }
    try {
      const s = JSON.parse(text);
      if (
        s.schemaVersion !== 1 ||
        (s.hubProfiles !== undefined && !Array.isArray(s.hubProfiles)) ||
        ![s.accessProfiles, s.mcpProfiles, s.agentProfiles].every(Array.isArray)
      )
        throw new Error();
      return s;
    } catch {
      throw new AppError(
        "storage_corrupt",
        "Configuração inválida. O arquivo original foi preservado para recuperação.",
        503,
      );
    }
  }
  async mutate(fn: (s: ConfigSnapshot) => void | Promise<void>): Promise<void> {
    const prev = queues.get(this.root) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        const snapshot = await this.read();
        await fn(snapshot);
        const temp = join(this.root, `settings-${randomUUID()}.tmp`);
        await writeFile(temp, JSON.stringify(snapshot, null, 2), {
          encoding: "utf8",
          flag: "wx",
        });
        await rename(temp, join(this.root, "settings.json"));
      });
    queues.set(this.root, next);
    return next;
  }
}
