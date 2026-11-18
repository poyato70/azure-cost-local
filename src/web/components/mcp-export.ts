export type ExportProfile = {
  name?: string;
  preset?: string;
  transport?: string;
  endpoint?: string;
  authMode?: string;
  resourceContext?: Record<string, string>;
  [key: string]: unknown;
};

const REDACTED = "[REMOVIDO]";
const secretKey =
  /(?:secret|password|passwd|token|cookie|authorization|authheader|authentication|authparams|authconfig|api.?key|credential|vault|session|access.?id|client.?id|tenant.?id|refresh|private.?key)/i;
const sensitiveQueryKey =
  /(?:token|secret|password|key|signature|sig|code|auth|credential|session|tenant.?id|client.?id|subscription.?id)/i;
const credentialPattern =
  /(?:https?:\/\/[^/\s:@]+:[^/\s@]+@|\b(?:authorization\s*[:=]\s*bearer|bearer\s+[a-z0-9._~+/=-]{8,}|(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]{4,}))/i;

function decodePercent(value: string) {
  let decoded = value;
  for (let index = 0; index < 3; index++) {
    try {
      const next = decodeURIComponent(decoded.replace(/\+/g, "%20"));
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function hasEncodedCredential(value: string) {
  const decoded = decodePercent(value);
  if (decoded !== value && credentialPattern.test(decoded)) return true;
  const chunks = value.match(/[A-Za-z0-9_-]{24,}={0,2}/g) || [];
  return chunks.some((chunk) => {
    try {
      const normalized = chunk.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(
        Math.ceil(normalized.length / 4) * 4,
        "=",
      );
      const decodedChunk = atob(padded);
      return credentialPattern.test(decodedChunk);
    } catch {
      return false;
    }
  });
}

export function sanitizeText(value: string): string {
  if (hasEncodedCredential(value)) return REDACTED;
  const text = value
    .replace(/\b(?:vault|secret|keyvault):\/\/[^\s"'<>]+/gi, REDACTED)
    .replace(/@Microsoft\.KeyVault\([^)]*\)/gi, REDACTED)
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REMOVIDO]@")
    .replace(
      /\b(authorization|cookie|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|secret)\b\s*[:=]\s*["']?[^\s,"'};]+/gi,
      "$1=[REMOVIDO]",
    )
    .replace(
      /([?&](?:token|access_token|refresh_token|client_secret|api_key|apikey|sig|signature|code|key)=)[^&#\s]*/gi,
      "$1[REMOVIDO]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REMOVIDO]")
    .replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
      REDACTED,
    );
  return text
    .replace(
      /([?&])([^=&#\s]+)=([^&#\s]*)/g,
      (whole, prefix: string, key: string) =>
        sensitiveQueryKey.test(key) ? `${prefix}${key}=${REDACTED}` : whole,
    )
    .replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) => {
      try {
        const url = new URL(candidate);
        url.username = "";
        url.password = "";
        for (const key of [...url.searchParams.keys()])
          if (sensitiveQueryKey.test(key)) url.searchParams.set(key, REDACTED);
        return url.toString();
      } catch {
        return candidate;
      }
    });
}

/** Deep, deterministic display sanitizer. Export manifests use explicit allowlists below. */
export function sanitizeExport<T>(
  value: T,
  key = "",
  context: { inSchema: boolean; sensitiveProperty: boolean } = {
    inSchema: false,
    sensitiveProperty: false,
  },
  parentKey = "",
): T {
  const schemaProperty = context.inSchema && parentKey === "properties";
  if (secretKey.test(key) && !schemaProperty) return REDACTED as T;
  if (
    context.sensitiveProperty &&
    ["default", "examples", "example", "enum", "const"].includes(key)
  )
    return REDACTED as T;
  if (typeof value === "string") return sanitizeText(value) as T;
  if (Array.isArray(value))
    return value.map((item) =>
      sanitizeExport(item, "", context, parentKey),
    ) as T;
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = Object.create(null);
    for (const [childKey, childValue] of Object.entries(value))
      output[childKey] = sanitizeExport(
        childValue,
        childKey,
        {
          inSchema:
            context.inSchema ||
            ["inputSchema", "outputSchema"].includes(childKey),
          sensitiveProperty:
            context.sensitiveProperty ||
            (schemaProperty && secretKey.test(key)),
        },
        key,
      );
    return output as T;
  }
  return value;
}

export function sanitizeSchemaForExport<T>(schema: T): T {
  const schemaKeywords = new Set([
    "$schema",
    "$id",
    "$ref",
    "$dynamicRef",
    "$anchor",
    "$dynamicAnchor",
    "$defs",
    "definitions",
    "$comment",
    "title",
    "description",
    "default",
    "deprecated",
    "readOnly",
    "writeOnly",
    "examples",
    "type",
    "enum",
    "const",
    "multipleOf",
    "maximum",
    "exclusiveMaximum",
    "minimum",
    "exclusiveMinimum",
    "maxLength",
    "minLength",
    "pattern",
    "format",
    "contentEncoding",
    "contentMediaType",
    "contentSchema",
    "maxItems",
    "minItems",
    "uniqueItems",
    "maxContains",
    "minContains",
    "maxProperties",
    "minProperties",
    "required",
    "properties",
    "patternProperties",
    "additionalProperties",
    "unevaluatedProperties",
    "propertyNames",
    "dependentRequired",
    "dependentSchemas",
    "if",
    "then",
    "else",
    "allOf",
    "anyOf",
    "oneOf",
    "not",
    "items",
    "prefixItems",
    "contains",
  ]);
  const schemaMaps = new Set([
    "$defs",
    "definitions",
    "properties",
    "patternProperties",
    "dependentSchemas",
  ]);
  function clean(value: any, propertyName = "", schemaMap = false): any {
    if (Array.isArray(value))
      return value.map((item) => clean(item, propertyName));
    if (!value || typeof value !== "object") {
      if (secretKey.test(propertyName)) return REDACTED;
      return typeof value === "string" ? sanitizeText(value) : value;
    }
    const output: Record<string, unknown> = Object.create(null);
    for (const [key, child] of Object.entries(value)) {
      if (schemaMap) {
        output[key] = clean(child, key);
        continue;
      }
      if (!schemaKeywords.has(key)) continue;
      if (
        secretKey.test(propertyName) &&
        ["default", "examples", "enum", "const"].includes(key)
      ) {
        output[key] = REDACTED;
      } else {
        output[key] = clean(child, key, schemaMaps.has(key));
      }
    }
    return output;
  }
  return clean(schema) as T;
}

function safeUrl(endpoint?: string) {
  if (!endpoint) return "https://[ENDPOINT-MCP]";
  try {
    const url = new URL(endpoint);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()])
      if (sensitiveQueryKey.test(key)) url.searchParams.set(key, REDACTED);
    return sanitizeText(url.toString());
  } catch {
    return sanitizeText(endpoint);
  }
}

function nextRepresentableUp(value: number) {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, value > 0 ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
}

function nextIntegerUp(value: number) {
  const candidate = Math.floor(value) + 1;
  return candidate > value ? candidate : nextRepresentableUp(value);
}

function stdioEntry(profile: ExportProfile) {
  const namespace =
    profile.preset === "adx"
      ? "kusto"
      : profile.preset === "azure"
        ? profile.resourceContext?.namespace || "pricing"
        : "";
  if (
    profile.preset === "azure" &&
    !["pricing", "advisor", "optimization", "subscription", "group"].includes(
      namespace,
    )
  )
    return undefined;
  const packages: Record<string, { package: string; bin: string }> = {
    azure: { package: "@azure/mcp@3.0.0", bin: "azmcp" },
    adx: { package: "@azure/mcp@3.0.0", bin: "azmcp" },
    fabric: { package: "@microsoft/fabric-mcp@1.7.0", bin: "fabmcp" },
  };
  const preset = packages[profile.preset || ""];
  if (!preset) return undefined;
  const args = [
    "--yes",
    "--package",
    preset.package,
    "--",
    preset.bin,
    "server",
    "start",
    "--mode",
    "all",
  ];
  if (profile.preset !== "fabric") args.push("--read-only");
  if (namespace) args.push("--namespace", namespace);
  return {
    type: "stdio",
    command: "npx",
    args,
    env: {
      AZURE_TENANT_ID: "${AZURE_TENANT_ID}",
      AZURE_CLIENT_ID: "${AZURE_CLIENT_ID}",
      AZURE_CLIENT_SECRET: "${AZURE_CLIENT_SECRET}",
    },
  };
}

function serverEntry(profile: ExportProfile) {
  if (profile.transport === "http") {
    const entry: Record<string, unknown> = {
      type: "http",
      url: safeUrl(profile.endpoint),
    };
    return entry;
  }
  if (profile.transport === "stdio") return stdioEntry(profile);
  return undefined;
}

export function vscodeConfig(profile: ExportProfile) {
  const entry = serverEntry(profile);
  if (!entry) return undefined;
  return JSON.stringify(
    {
      mcpServers: { tesseractMcp: entry },
    },
    null,
    2,
  );
}

/** Informative text only: no currently documented PowerShell MCP client format was validated. */
export function powershellInfo(profile: ExportProfile) {
  const details =
    profile.transport === "http"
      ? `Transporte anunciado: HTTP\nEndpoint sanitizado: ${safeUrl(profile.endpoint)}`
      : profile.transport === "stdio"
        ? `Transporte anunciado: stdio\nPreset: ${sanitizeText(String(profile.preset || "não identificado"))}`
        : "Transporte MCP não identificado.";
  return [
    "Exemplo informativo — não é uma configuração operacional de cliente PowerShell.",
    "Não foi validado um cliente PowerShell atual com formato documentado e importação reproduzível.",
    "O AI Shell foi arquivado pela Microsoft em janeiro de 2026; seu formato legado não é oferecido como compatibilidade atual.",
    "Use o formato MCP nativo Copilot para VS Code ou um manifesto Tesseract identificado como proprietário.",
    details,
    "Nenhuma credencial foi exportada. Configure autenticação diretamente no cliente compatível.",
  ].join("\n\n");
}

export function capabilityManifest(profile: ExportProfile, catalog: any) {
  const pick = (item: any, keys: string[]) => {
    if (!item || typeof item !== "object") return undefined;
    const output: Record<string, unknown> = Object.create(null);
    for (const key of keys)
      if (item[key] !== undefined) output[key] = item[key];
    return output;
  };
  const list = (items: any, keys: string[]) =>
    Array.isArray(items)
      ? items.map((item) => pick(item, keys)).filter(Boolean)
      : [];
  const schema = (value: any) =>
    value === undefined ? undefined : sanitizeSchemaForExport(value);
  const safeAnnotations = (value: any) =>
    pick(value, [
      "title",
      "readOnlyHint",
      "destructiveHint",
      "idempotentHint",
      "openWorldHint",
    ]);
  const tools = list(catalog?.tools, [
    "name",
    "title",
    "description",
    "inputSchema",
    "outputSchema",
    "annotations",
  ]).map((tool: any) => ({
    ...tool,
    inputSchema: schema(tool.inputSchema),
    outputSchema: schema(tool.outputSchema),
    annotations: safeAnnotations(tool.annotations),
  }));
  const resources = {
    status: catalog?.resources?.status || "unavailable",
    items: list(catalog?.resources?.items, [
      "name",
      "title",
      "uri",
      "description",
      "mimeType",
      "annotations",
    ]).map((item: any) => ({
      ...item,
      annotations: safeAnnotations(item.annotations),
    })),
  };
  const prompts = {
    status: catalog?.prompts?.status || "unavailable",
    items: list(catalog?.prompts?.items, [
      "name",
      "title",
      "description",
      "arguments",
    ]).map((prompt: any) => ({
      ...prompt,
      arguments: list(prompt.arguments, [
        "name",
        "title",
        "description",
        "required",
      ]),
    })),
  };
  const resourceTemplates = {
    status:
      catalog?.resourceTemplates?.status ||
      "not_returned_by_existing_discovery",
    items: list(catalog?.resourceTemplates?.items, [
      "name",
      "title",
      "uriTemplate",
      "description",
      "mimeType",
      "annotations",
    ]).map((item: any) => ({
      ...item,
      annotations: safeAnnotations(item.annotations),
    })),
  };
  const capabilities = pick(catalog?.capabilities, [
    "tools",
    "resources",
    "prompts",
    "logging",
    "completions",
    "tasks",
  ]);
  if (capabilities) {
    for (const key of Object.keys(capabilities)) {
      const safe = pick(capabilities[key], ["listChanged"]);
      capabilities[key] = safe || {};
    }
  }
  return JSON.stringify(
    sanitizeExport({
      format: "tesseract.capability-manifest",
      version: "1.0",
      generatedAt: new Date().toISOString(),
      formatNotice:
        "Formato próprio do Tesseract; não é um padrão MCP de portabilidade.",
      connection: {
        name: sanitizeText(String(profile.name || "Conexão MCP")),
        transport: profile.transport || "unknown",
        preset: profile.preset || "unknown",
        endpoint:
          profile.transport === "http" ? safeUrl(profile.endpoint) : undefined,
        discoveryState: catalog ? "discovered" : "not_verified",
      },
      server: pick(catalog?.server, ["name", "version", "title"]),
      capabilities,
      tools,
      resources,
      prompts,
      resourceTemplates,
    }),
    null,
    2,
  );
}

export function exampleArguments(schema: any): {
  value?: unknown;
  reason?: string;
} {
  function valueFor(node: any, name = ""): any {
    if (!node || typeof node !== "object")
      throw new Error("Schema incompleto.");
    if (node.$ref || node.oneOf || node.anyOf || node.allOf || node.not)
      throw new Error("Schema avançado requer edição manual do JSON.");
    if (secretKey.test(name))
      throw new Error(
        "Campo potencialmente sensível não recebe valor sintético.",
      );
    if (node.const !== undefined) {
      const safe = sanitizeExport(node.const);
      if (JSON.stringify(safe) !== JSON.stringify(node.const))
        throw new Error("Const potencialmente sensível foi removida.");
      return safe;
    }
    if (Array.isArray(node.enum)) {
      const selected = node.enum.find(
        (item: unknown) =>
          JSON.stringify(sanitizeExport(item)) === JSON.stringify(item),
      );
      if (selected === undefined)
        throw new Error("Enum sem opção sintética segura.");
      return selected;
    }
    if (node.type === "object" || node.properties) {
      const output: Record<string, unknown> = {};
      for (const key of node.required || []) {
        if (!(key in (node.properties || {})))
          throw new Error("Propriedade obrigatória sem definição.");
        output[key] = valueFor(node.properties[key], key);
      }
      return output;
    }
    if (node.type === "array") {
      if ((node.minItems || 0) > 0)
        throw new Error(
          "Array mínimo não pode ser preenchido sem inventar dados.",
        );
      return [];
    }
    if (node.type === "string") {
      if (node.pattern || node.format)
        throw new Error("Formato/padrão exige exemplo específico do domínio.");
      const sample = "example";
      if (
        (node.minLength || 0) > sample.length ||
        (node.maxLength !== undefined && node.maxLength < sample.length)
      )
        throw new Error(
          "Restrições de tamanho não permitem um exemplo genérico seguro.",
        );
      return sample;
    }
    if (node.type === "integer" || node.type === "number") {
      const exclusiveLow =
        typeof node.exclusiveMinimum === "number"
          ? node.exclusiveMinimum
          : undefined;
      const exclusiveHigh =
        typeof node.exclusiveMaximum === "number"
          ? node.exclusiveMaximum
          : undefined;
      const low = Math.max(
        0,
        node.minimum ?? 0,
        exclusiveLow === undefined
          ? 0
          : node.type === "integer"
            ? nextIntegerUp(exclusiveLow)
            : nextRepresentableUp(exclusiveLow),
      );
      const high = Math.min(
        node.maximum ?? Infinity,
        exclusiveHigh ?? Infinity,
      );
      const sample = low;
      if (
        sample > high ||
        (exclusiveHigh !== undefined && sample >= exclusiveHigh)
      )
        throw new Error(
          "Restrições numéricas incompatíveis com exemplo genérico.",
        );
      return sample;
    }
    if (node.type === "boolean") return false;
    throw new Error("Tipo ausente ou não suportado para geração segura.");
  }
  try {
    return { value: valueFor(schema) };
  } catch (error) {
    return { reason: (error as Error).message };
  }
}
