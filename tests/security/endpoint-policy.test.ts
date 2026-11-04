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
it("accepts public IPv4/IPv6 while rejecting mapped/private and mixed DNS answers", async () => {
  expect(isPrivateAddress("150.171.110.38")).toBe(false);
  expect(isPrivateAddress("2603:1061:14:125::1")).toBe(false);
  expect(isPrivateAddress("::ffff:150.171.110.38")).toBe(true);
  await expect(
    validateEndpoint("https://public.example", false, async () => [
      { address: "150.171.110.38", family: 4 },
    ]),
  ).resolves.toHaveProperty("url");
  await expect(
    validateEndpoint("https://mixed.example", false, async () => [
      { address: "150.171.110.38", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
  ).rejects.toBeDefined();
});
