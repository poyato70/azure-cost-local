import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { McpIdentity } from "../../src/web/components/McpDetails.js";
it("does not call a delegated MCP ready when the active identity is an application", () => {
  const html = renderToStaticMarkup(
    createElement(McpIdentity, {
      profile: {
        preset: "arm",
        transport: "http",
        authMode: "delegated",
        accessId: "a",
      },
      accesses: [{ id: "a", name: "FinOps" }],
      activeAccessId: "a",
      principalKind: "application",
    }),
  );
  expect(html).not.toContain("Identidade conectada nesta sessão.");
  expect(html).toContain("Conectar identidade FinOps");
});
it("keeps resource authorization available even after a user has signed in", () => {
  const html = renderToStaticMarkup(
    createElement(McpIdentity, {
      profile: {
        preset: "arm",
        transport: "http",
        authMode: "delegated",
        accessId: "a",
      },
      accesses: [{ id: "a", name: "FinOps" }],
      activeAccessId: "a",
      principalKind: "user",
    }),
  );
  expect(html).toContain("Autorizar recurso MCP");
});
