import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
const config = readConfig();
const app = await buildApp({ config });
const root = fileURLToPath(new URL("../../dist/web/", import.meta.url));
if (existsSync(root + "index.html")) {
  await app.register(fastifyStatic, { root });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/")
      ? reply
          .status(404)
          .send({ code: "not_found", message: "Rota não encontrada." })
      : reply.sendFile("index.html"),
  );
} else
  app.get("/", async (_req, reply) =>
    reply
      .type("text/plain")
      .send("Execute npm run build e reinicie para abrir o dashboard."),
  );
await app.listen({ host: "127.0.0.1", port: config.port });
console.log(`Dashboard: ${config.origin} • Ctrl+C para encerrar`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
