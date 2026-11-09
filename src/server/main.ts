import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { readFileSync } from "node:fs";
import { staticPolicy } from "./web-policy.js";
const config = readConfig();
const app = await buildApp({ config });
const root = fileURLToPath(new URL("../../dist/web/", import.meta.url));
if (existsSync(root + "index.html")) {
  const shellPolicy = staticPolicy(readFileSync(root + "index.html", "utf8"));
  const framePolicy = existsSync(root + "tesseract-4d.html")
    ? staticPolicy(readFileSync(root + "tesseract-4d.html", "utf8"), true)
    : shellPolicy;
  app.addHook("onSend", async (req, reply, payload) => {
    if (!req.url.startsWith("/api/"))
      reply.header(
        "Content-Security-Policy",
        req.url.split("?")[0] === "/tesseract-4d.html"
          ? framePolicy
          : shellPolicy,
      );
    return payload;
  });
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
