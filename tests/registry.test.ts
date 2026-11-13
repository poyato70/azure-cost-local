import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Registry } from "../src/server/registry.js";
import { isReadOnlyTool } from "../src/server/mcp.js";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe("Registry persistente", () => {
  it("persiste bindings e eventos entre instâncias", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tesseract-registry-")); dirs.push(directory);
    const registry = await new Registry(directory).load();
    const binding = await registry.add("Demo local", "http://localhost:8765/mcp");
    await registry.event(binding.id, "tools/list", "success");
    const reopened = await new Registry(directory).load();
    expect(reopened.get(binding.id)?.name).toBe("Demo local");
    expect(reopened.events()[0]?.operation).toBe("tools/list");
    expect(JSON.parse(await readFile(join(directory, "registry.json"), "utf8")).schemaVersion).toBe(1);
  });
  it("rejects insecure remote endpoints", async () => {
    const registry = await new Registry().load();
    await expect(registry.add("insecure", "http://example.com/mcp")).rejects.toThrow("HTTPS");
  });
  it("persists stdio configuration without exposing environment values", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tesseract-stdio-")); dirs.push(directory);
    const registry = await new Registry(directory).load();
    const binding = await registry.addStdio("Azure MCP local", "npx", ["-y", "@azure/mcp@latest", "server", "start"], { SAMPLE_TOKEN: "never-return-this" });
    expect(binding.transport).toBe("stdio");
    expect(registry.list()[0]).not.toHaveProperty("env");
    expect(JSON.parse(await readFile(join(directory, "registry.json"), "utf8")).bindings[0].env.SAMPLE_TOKEN).toBe("never-return-this");
  });
});

describe("política read-only provisória", () => {
  it("permite nomes aparentemente consultivos e bloqueia verbos de mutação", () => {
    expect(isReadOnlyTool("list_resources")).toBe(true);
    expect(isReadOnlyTool("query_costs")).toBe(true);
    expect(isReadOnlyTool("delete_resource")).toBe(false);
    expect(isReadOnlyTool("execute_command")).toBe(false);
    expect(isReadOnlyTool("foundry")).toBe(false);
    expect(isReadOnlyTool("foundry", { learn: true })).toBe(true);
    expect(isReadOnlyTool("foundry", { command: "models_list" })).toBe(true);
    expect(isReadOnlyTool("foundry", { command: "agents_create" })).toBe(false);
  });
});
