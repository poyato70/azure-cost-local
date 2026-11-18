import { describe, expect, it } from "vitest";
import {
  capabilityManifest,
  exampleArguments,
  powershellInfo,
  sanitizeExport,
  sanitizeText,
  vscodeConfig,
} from "../../src/web/components/mcp-export.js";

describe("MCP export sanitizer and formatters", () => {
  it("redacts secret keys, bearer values, URL credentials, sensitive query parameters, and nested metadata", () => {
    const input = {
      endpoint:
        "https://user:pass@example.test/mcp?region=west&api_key=secret-value&session_id=s-123",
      headers: { Authorization: "Bearer abc.def.ghi", Cookie: "sid=private" },
      tokenRef: "vault://secret/ref",
      properties: {
        name: { type: "string", default: "safe" },
        access_token: "opaque",
      },
      description:
        "Bearer top.secret.value see https://host.test/mcp?sig=signature-value",
    };
    const output = JSON.stringify(sanitizeExport(input));
    for (const secret of [
      "user:pass",
      "secret-value",
      "s-123",
      "abc.def.ghi",
      "sid=private",
      "vault://secret/ref",
      "opaque",
      "top.secret.value",
      "signature-value",
    ])
      expect(output).not.toContain(secret);
    expect(output).toContain("[REMOVIDO]");
    expect(output).toContain("region=west");
  });

  it("redacts encoded credentials and authentication-shaped fields", () => {
    const encodedBearer = btoa("Authorization: Bearer fixture-sensitive-token");
    const encodedUrl = encodeURIComponent(
      "https://encoded-user:encoded-pass@example.test/mcp?access_token=encoded-query-secret",
    );
    const output = JSON.stringify(
      sanitizeExport({
        nested: [{ authenticationParams: { arbitraryField: "auth-secret" } }],
        secretReference: "vault://team-prod/secret/api-key",
        encodedBearer,
        encodedUrl,
        jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.c2lnbmF0dXJlLXZhbHVl",
      }),
    );
    for (const secret of [
      "fixture-sensitive-token",
      "encoded-user",
      "encoded-pass",
      "encoded-query-secret",
      "auth-secret",
      "team-prod",
      "eyJhbGciOiJIUzI1NiJ9",
    ])
      expect(output).not.toContain(secret);
    expect(output).toContain("[REMOVIDO]");
  });

  it("redacts tenant, client, and subscription identifiers in endpoint queries", () => {
    const output = JSON.stringify(
      sanitizeExport({
        endpoint:
          "https://mcp.test/path?tenant_id=tenant-fixture&clientId=client-fixture&subscription_id=subscription-fixture&region=west",
      }),
    );
    for (const identifier of [
      "tenant-fixture",
      "client-fixture",
      "subscription-fixture",
    ])
      expect(output).not.toContain(identifier);
    expect(output).toContain("region=west");
    expect(output.match(/%5BREMOVIDO%5D/g)).toHaveLength(3);
  });

  it("exports native VS Code Copilot format and labels PowerShell text informational only", () => {
    const profile = {
      name: "Azure",
      preset: "azure",
      transport: "stdio",
      authMode: "application",
      resourceContext: { namespace: "pricing" },
    };
    const vscode = JSON.parse(vscodeConfig(profile)!);
    expect(vscode.mcpServers.tesseractMcp.type).toBe("stdio");
    expect(vscode.mcpServers.tesseractMcp.args).toContain("--read-only");
    expect(vscode.mcpServers.tesseractMcp.env.AZURE_CLIENT_SECRET).toBe(
      "${AZURE_CLIENT_SECRET}",
    );
    expect(JSON.stringify(vscode)).not.toMatch(/Authorization|Bearer\s+[^[]/i);
    expect(vscode.mcpServers.tesseractMcp.tools).toBeUndefined();
    const powershell = powershellInfo({
      transport: "http",
      endpoint: "https://mcp.test/sse?token=hidden",
    });
    expect(powershell).toContain("Exemplo informativo");
    expect(powershell).toContain("não é uma configuração operacional");
    expect(powershell).toContain("AI Shell foi arquivado");
    expect(powershell).toContain("token=%5BREMOVIDO%5D");
    expect(powershell).not.toContain('"servers"');
    expect(powershell).not.toContain("hidden");
    expect(
      vscodeConfig({ transport: "other", preset: "custom" }),
    ).toBeUndefined();
  });

  it("labels the Tesseract manifest and retains complex schema shape after sanitizing values", () => {
    const schema = {
      type: "object",
      properties: {
        result: {
          oneOf: [
            { $ref: "#/$defs/A" },
            { type: "array", items: { type: "string" } },
          ],
        },
        password: { type: "string", default: "fixture-secret" },
      },
      $defs: { A: { type: "string" } },
      _meta: { api_key: "secret" },
    };
    const result = JSON.parse(
      capabilityManifest(
        { transport: "http", endpoint: "https://mcp.test?key=private" },
        {
          server: { name: "Fixture", version: "1", accessToken: "leak" },
          privateEndpoint: "https://user:pass@internal.test/mcp?tenant=leak",
          capabilities: {
            tools: { listChanged: true, unexpectedCredential: "leak" },
            surprise: { secret: "leak" },
          },
          tools: [
            {
              name: "x",
              inputSchema: schema,
              approved: true,
              _meta: { internalSecret: "leak" },
              sessionRef: "leak",
            },
          ],
          resources: {
            status: "discovered",
            items: [
              {
                name: "r",
                uri: "mcp://fixture/r",
                _meta: { credential: "leak" },
                internalSecret: "leak",
              },
            ],
          },
          prompts: { status: "empty", items: [] },
        },
      ),
    );
    expect(result.format).toBe("tesseract.capability-manifest");
    expect(result.connection.discoveryState).toBe("discovered");
    expect(result.tools[0].inputSchema.properties.result.oneOf[0].$ref).toBe(
      "#/$defs/A",
    );
    expect(result.tools[0].inputSchema.properties.password.default).toBe(
      "[REMOVIDO]",
    );
    expect(result.tools[0].sessionRef).toBeUndefined();
    expect(result.tools[0].approved).toBeUndefined();
    expect(result.tools[0]._meta).toBeUndefined();
    expect(result.resources.items[0]._meta).toBeUndefined();
    expect(result.capabilities.surprise).toBeUndefined();
    expect(result.capabilities.tools.unexpectedCredential).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("fixture-secret");
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain('"secret"');
    expect(JSON.stringify(result)).not.toContain("internal.test");
    expect(JSON.stringify(result)).not.toContain("leak");
    const unverified = JSON.parse(
      capabilityManifest(
        { name: "Local", transport: "stdio", preset: "custom" },
        undefined,
      ),
    );
    expect(unverified.connection.discoveryState).toBe("not_verified");
    expect(unverified.resourceTemplates.status).toBe(
      "not_returned_by_existing_discovery",
    );
  });

  it("creates only safe, synthetic examples and refuses schemas it cannot satisfy confidently", () => {
    expect(
      exampleArguments({
        type: "object",
        required: ["count", "enabled", "label"],
        properties: {
          count: { type: "integer", minimum: 2 },
          enabled: { type: "boolean" },
          label: { type: "string" },
        },
      }).value,
    ).toEqual({ count: 2, enabled: false, label: "example" });
    expect(
      exampleArguments({
        type: "object",
        required: ["subscriptionId"],
        properties: { subscriptionId: { type: "string", format: "uuid" } },
      }).value,
    ).toBeUndefined();
    const exclusiveMinimum = exampleArguments({
      type: "object",
      required: ["value"],
      properties: {
        value: {
          type: "number",
          exclusiveMinimum: 1,
          maximum: 1,
        },
      },
    });
    expect(exclusiveMinimum.value).toBeUndefined();
    expect(exclusiveMinimum.reason).toContain("Restrições numéricas");

    const representableExample = exampleArguments({
      type: "object",
      required: ["value"],
      properties: { value: { type: "number", exclusiveMinimum: 1 } },
    }).value as { value: number };
    expect(representableExample.value).toBeGreaterThan(1);
    expect(representableExample.value).toBe(1.0000000000000002);
    expect(
      exampleArguments({
        type: "object",
        required: ["value"],
        properties: {
          value: {
            type: "integer",
            exclusiveMinimum: Number.MAX_SAFE_INTEGER + 1,
            maximum: Number.MAX_SAFE_INTEGER + 1,
          },
        },
      }).value,
    ).toBeUndefined();
    expect(
      exampleArguments({
        type: "object",
        required: ["value"],
        properties: {
          value: { oneOf: [{ type: "string" }, { type: "null" }] },
        },
      }).value,
    ).toBeUndefined();
    expect(
      sanitizeText("https://host.test/path?session_id=private"),
    ).not.toContain("private");
  });
});
