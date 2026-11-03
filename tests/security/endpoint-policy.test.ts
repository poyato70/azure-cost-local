import { it, expect } from "vitest";
import {
  validateEndpoint,
  isPrivateAddress,
} from "../../src/server/security/endpoint-policy.js";
it("rejects embedded credentials, metadata and private targets unless explicitly allowed", async () => {
  await expect(
    validateEndpoint("https://user:pass@example.com"),
  ).rejects.toMatchObject({ code: "invalid_endpoint" });
  await expect(
    validateEndpoint("http://169.254.169.254/latest"),
  ).rejects.toBeDefined();
  expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
  expect(isPrivateAddress("10.0.0.1")).toBe(true);
  await expect(
    validateEndpoint("https://example.com", false, async () => [
      { address: "127.0.0.1", family: 4 },
    ]),
  ).rejects.toMatchObject({ code: "invalid_endpoint" });
});
