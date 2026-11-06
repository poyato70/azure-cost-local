import { it, expect, vi } from "vitest";
import { ArmHttp } from "../../src/server/azure/http.js";
const ctx = {
  sessionId: "s",
  userId: "u",
  tenantId: "t",
  accessId: "a",
  configurationVersion: 1,
  signal: new AbortController().signal,
};
const path =
  "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CostManagement/query";
it("respects the largest Cost Management wait and prevents a repeated model call", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response("", {
        status: 429,
        headers: {
          "Retry-After": "1",
          "x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after": "45",
          "x-ms-ratelimit-microsoft.consumption-retry-after": "60",
        },
      }),
  );
  const sleep = vi.fn(async () => {});
  const http = new ArmHttp(async () => "secret", fetcher, sleep);
  await expect(http.request(ctx, path, {})).rejects.toMatchObject({
    code: "throttled",
    status: 429,
  });
  await expect(http.request(ctx, path, {})).rejects.toThrow(/aguarde|Aguarde/);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(sleep).not.toHaveBeenCalled();
  await expect(
    http.request({ ...ctx, accessId: "b" }, path, {}),
  ).rejects.toMatchObject({ code: "throttled" });
  await expect(
    http.request(ctx, path.replace("/rg/", "/other/"), {}),
  ).rejects.toMatchObject({ code: "throttled" });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("does not retry aggressively when no valid wait header is supplied", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "nonsense" } }),
  );
  const http = new ArmHttp(
    async () => "secret",
    fetcher,
    async () => {},
  );
  await expect(http.request(ctx, path, {})).rejects.toMatchObject({
    code: "throttled",
  });
  await expect(http.request(ctx, path, {})).rejects.toMatchObject({
    code: "throttled",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("cancels an in-flight short backoff without another HTTP request", async () => {
  const controller = new AbortController();
  const fetcher = vi.fn(
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "2" } }),
  );
  const http = new ArmHttp(
    async () => "secret",
    fetcher,
    async () => {
      controller.abort();
    },
  );
  await expect(
    http.request({ ...ctx, signal: controller.signal }, path, {}),
  ).rejects.toMatchObject({ code: "unauthenticated" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
