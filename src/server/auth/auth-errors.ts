import { AppError } from "../errors.js";

export type AuthErrorContext = {
  tenantId?: string;
  resourceName?: string;
  resourceAppId?: string;
};

const safeGuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : undefined;

const safeIdentifier = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_]{2,79}$/.test(value)
    ? value
    : undefined;
/** Expose diagnostic identifiers, never raw MSAL messages, authorization codes or URLs. */
export function authError(
  error: unknown,
  context: AuthErrorContext = {},
): AppError {
  if (error instanceof AppError) return error;
  const e =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const cause =
    e.cause && typeof e.cause === "object"
      ? (e.cause as Record<string, unknown>)
      : {};
  const msal = safeIdentifier(e.errorCode);
  const nodeCode = safeIdentifier(e.code) || safeIdentifier(cause.code);
  const exceptionName = [
    "TypeError",
    "ReferenceError",
    "SyntaxError",
    "RangeError",
    "Error",
  ].includes(String(e.name))
    ? String(e.name)
    : undefined;
  const text =
    typeof e.errorMessage === "string"
      ? e.errorMessage
      : typeof e.message === "string"
        ? e.message
        : "";
  const aad = text.match(/\bAADSTS(\d{4,9})\b/)?.[1];
  const tenantId = safeGuid(context.tenantId) || safeGuid(e.tenantId);
  const resourceAppId =
    safeGuid(context.resourceAppId) ||
    safeGuid(e.resourceAppId) ||
    safeGuid(text.match(/resource(?: application)?(?: app)? id\s*[:=]\s*([0-9a-f-]{36})/i)?.[1]);
  const resourceName =
    context.resourceName ||
    (typeof e.resourceName === "string" &&
    /^[\p{L}\p{N} .()_-]{1,100}$/u.test(e.resourceName)
      ? e.resourceName
      : undefined) ||
    text.match(/service\s+["(]([^"\r\n)]+)[")]/i)?.[1];
  const correlationId =
    safeGuid(e.correlationId) ||
    safeGuid(text.match(/correlation\s+id\s*:\s*([0-9a-f-]{36})/i)?.[1]);
  const traceId =
    safeGuid(e.traceId) || safeGuid(text.match(/trace\s+id\s*:\s*([0-9a-f-]{36})/i)?.[1]);
  const label = aad
    ? `AADSTS${aad}`
    : msal || nodeCode || exceptionName || "erro_interno";
  if (aad === "7000218" || aad === "9002327")
    return new AppError(
      "auth_configuration",
      `${label}: a plataforma do redirect URI precisa ser Aplicativos móveis e de desktop (cliente público), compatível com este MVP sem segredo. Verifique esse URI no registro Entra e inicie um novo login.`,
      400,
    );
  if (aad === "65001" || msal === "consent_required")
    return new AppError(
      "auth_consent",
      `${label}: falta consentimento para acessar o Azure em nome do usuário. Verifique a permissão delegada Azure Service Management e as políticas do tenant.`,
      403,
    );
  if (aad === "650052") {
    const details = [
      tenantId && `Tenant ID: ${tenantId}`,
      resourceName && `Recurso: ${resourceName}`,
      resourceAppId && `Application ID do recurso: ${resourceAppId}`,
      correlationId && `Correlation ID: ${correlationId}`,
      traceId && `Trace ID: ${traceId}`,
    ].filter(Boolean);
    return new AppError(
      "auth_resource_unavailable",
      `AADSTS650052: o Microsoft Entra informa que o tenant não tem o recurso solicitado habilitado/provisionado ou seu service principal disponível. Para o ARM MCP, o administrador deve confirmar o service principal do recurso, a permissão delegada MCP.Access e o consentimento exigido pela organização. Isso é diferente de autenticação do usuário e de RBAC nas subscriptions; o Tesseract não cria service principals nem concede consentimento. ${details.length ? "Diagnóstico: " + details.join(" · ") + "." : "Consulte o registro de entrada do Entra para obter o tenant e os IDs de correlação."}`,
      403,
    );
  }
  if (aad === "50020" || aad === "500200" || aad === "500202")
    return new AppError(
      "auth_account",
      `${label}: a conta selecionada não está autorizada para este tenant/recurso. Entre com a conta que possui acesso à assinatura ou com a identidade convidada correspondente.`,
      403,
    );
  if (aad === "54005" || msal === "invalid_grant")
    return new AppError(
      "auth_expired",
      `${label}: a tentativa expirou ou o código de autorização não pode ser reutilizado. Volte ao dashboard e inicie um novo login.`,
      400,
    );
  if (
    nodeCode ||
    (msal &&
      [
        "post_request_failed",
        "get_request_failed",
        "network_error",
        "endpoints_resolution_error",
        "openid_config_error",
      ].includes(msal))
  )
    return new AppError(
      "auth_network",
      `${label}: falha de conexão do serviço local com a Microsoft. Verifique rede, proxy e certificados corporativos e inicie um novo login.`,
      502,
    );
  if (msal === "access_denied")
    return new AppError(
      "auth_denied",
      "Login cancelado ou acesso recusado pela Microsoft. Inicie uma nova tentativa se desejar.",
      403,
    );
  return new AppError(
    "auth_microsoft",
    `Falha ao concluir o login Microsoft (${label}). Verifique a configuração do aplicativo e tente um novo login. Compartilhe somente esta mensagem de erro, sem a URL de retorno.`,
    400,
  );
}
