import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type McpBinding = { id: string; name: string; endpoint?: string; transport: "streamable-http" | "stdio"; command?: string; args?: string[]; env?: Record<string, string>; status: "configured" | "validated"; createdAt: string; lastDiscovery?: string };
type RegistryData = { schemaVersion: 1; bindings: McpBinding[]; audit: Array<{ id: string; bindingId: string; operation: string; at: string; outcome: string }> };

export class Registry {
  private data: RegistryData = { schemaVersion: 1, bindings: [], audit: [] };
  constructor(readonly directory = join(process.cwd(), "data")) {}
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(join(this.directory, "registry.json"), "utf8")) as RegistryData;
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.bindings) || !Array.isArray(parsed.audit)) throw new Error("Registry schema inválido");
      this.data = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.persist();
    }
    return this;
  }
  list() { return structuredClone(this.data.bindings.map(({ env: _env, ...binding }) => binding)); }
  events() { return structuredClone(this.data.audit).reverse().slice(0, 50); }
  get(id: string) { return this.data.bindings.find((item) => item.id === id); }
  async add(name: string, endpoint: string) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("O endpoint MCP precisa usar HTTPS (HTTP só é permitido em loopback local).");
    const binding: McpBinding = { id: randomUUID(), name: name.trim(), endpoint: url.toString(), transport: "streamable-http", status: "configured", createdAt: new Date().toISOString() };
    this.data.bindings.push(binding); await this.persist(); return binding;
  }
  async addStdio(name: string, command: string, args: string[] = [], env: Record<string, string> = {}) {
    if (!name.trim() || !command.trim() || args.some((arg) => typeof arg !== "string") || Object.values(env).some((value) => typeof value !== "string")) throw new Error("Configuração stdio inválida.");
    const binding: McpBinding = { id: randomUUID(), name: name.trim(), transport: "stdio", command: command.trim(), args, env, status: "configured", createdAt: new Date().toISOString() };
    this.data.bindings.push(binding); await this.persist(); return binding;
  }
  async discovered(id: string) { const item = this.get(id); if (item) { item.status = "validated"; item.lastDiscovery = new Date().toISOString(); await this.persist(); } }
  async event(bindingId: string, operation: string, outcome: string) {
    this.data.audit.push({ id: randomUUID(), bindingId, operation, at: new Date().toISOString(), outcome });
    this.data.audit = this.data.audit.slice(-500); await this.persist();
  }
  private async persist() {
    await mkdir(this.directory, { recursive: true });
    const target = join(this.directory, "registry.json"), temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(this.data, null, 2), { encoding: "utf8", flag: "wx" });
    await rename(temp, target);
  }
}
