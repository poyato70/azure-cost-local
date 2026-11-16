import { OrchestrationStore } from "../../src/server/mcp/orchestration-store.js";
import { buildApp } from "../../src/server/app.js";
import { ConfigStore } from "../../src/server/storage/config-store.js";

if (process.env.TESSERACT_EXPECT_SAFE_TEST === "1") {
  try {
    const store = new OrchestrationStore();
    await store.init();
    process.stdout.write(`SAFE_STORE_INITIALIZED:${store.file}\n`);
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(`SAFE_STORE_REJECTED:${(error as Error).message}\n`);
    process.exitCode = 1;
  }
} else {
  const rejected: string[] = [];
  try {
    new OrchestrationStore();
    process.stdout.write("UNSAFE_STORE_ACCEPTED\n");
  } catch (error) {
    rejected.push("store");
    process.stderr.write(`STORE_REJECTED:${(error as Error).message}\n`);
  }
  try {
    await buildApp();
    process.stdout.write("UNSAFE_APP_ACCEPTED\n");
  } catch (error) {
    rejected.push("app");
    process.stderr.write(`APP_REJECTED:${(error as Error).message}\n`);
  }
  if (process.env.TESSERACT_TEST_RUNTIME !== "1")
    process.stdout.write(`PRODUCTION_CONFIG_ROOT:${new ConfigStore().root}\n`);
  process.exitCode = rejected.length === 2 ? 0 : 1;
}
