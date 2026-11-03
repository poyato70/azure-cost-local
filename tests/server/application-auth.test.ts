import { it, expect } from "vitest";
import { ApplicationProvider } from "../../src/server/auth/application-provider.js";
it("uses client credentials for a specific audience without interactive login", async () => {
  let args: any, config: any;
  const profile = {
    id: "a",
    tenantId: "tenant",
    clientId: "client",
    secretRef: "ref",
    credentialVersion: 1,
    configurationVersion: 1,
  };
  const provider = new ApplicationProvider(
    { get: async () => profile } as any,
    { read: async () => "synthetic" } as any,
    (c: any) => {
      config = c;
      return {
        acquireTokenByClientCredential: async (a: any) => {
          args = a;
          return {
            accessToken: "token",
            expiresOn: new Date(Date.now() + 3600000),
          };
        },
      } as any;
    },
  );
  expect(await provider.token("a", "https://management.azure.com")).toBe(
    "token",
  );
  expect(args.scopes).toEqual(["https://management.azure.com/.default"]);
  expect(config.auth.clientSecret).toBe("synthetic");
});
