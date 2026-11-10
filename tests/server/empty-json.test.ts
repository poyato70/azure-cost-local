import { it, expect } from "vitest";
import { buildApp } from "../../src/server/app.js";
it("classifies empty JSON requests without returning an unexplained internal error", async () => {
  const app = await buildApp();
  try {
    const boot = await app.inject({
      url: "/api/bootstrap",
      headers: { host: "localhost:4317" },
    });
    const response = await app.inject({
      method: "DELETE",
      url: "/api/mcp-connections/11111111-1111-4111-8111-111111111111",
      headers: {
        host: "localhost:4317",
        cookie: String(boot.headers["set-cookie"]).split(";")[0],
        "x-csrf-token": boot.json().csrf,
        "content-type": "application/json",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("invalid_request");
    expect(response.json().requestId).toBeTruthy();
  } finally {
    await app.close();
  }
});
