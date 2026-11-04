import { scopePath, type Scope } from "../../shared/contracts.js";
import { AppError } from "../errors.js";
export function validArmScope(value: string) {
  return (
    /^\/subscriptions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/resourceGroups\/[\p{L}\p{N}_(). -]{1,90})?$/iu.test(
      value,
    ) && ![".", ".."].includes(value.split("/").at(-1)!)
  );
}
export function authorizeArmScope(
  scope: string,
  args: Record<string, unknown>,
) {
  if (!validArmScope(scope))
    throw new AppError(
      "forbidden",
      "Cadastre o escopo ARM completo da subscription ou RG.",
      403,
    );
  let found = false;
  const walk = (value: unknown, depth: number) => {
    if (depth > 8)
      throw new AppError(
        "forbidden",
        "Estrutura de argumentos ARM não suportada.",
        403,
      );
    if (Array.isArray(value)) {
      for (const x of value) walk(x, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (key.toLowerCase() === "scope") {
        if (typeof v !== "string" || v.toLowerCase() !== scope.toLowerCase())
          throw new AppError(
            "forbidden",
            "A tool ARM tentou usar outro escopo ou formato não revisado.",
            403,
          );
        found = true;
        continue;
      }
      if (
        /(?:scope|subscription|tenant|resourcegroup|resourceid|billingaccount|managementgroup|url|uri|endpoint|authorization|token|secret|headers|query|kql|command)/i.test(
          key,
        )
      )
        throw new AppError(
          "forbidden",
          "Parâmetro de destino ou execução ARM não revisado: " + key,
          403,
        );
      walk(v, depth + 1);
    }
  };
  walk(args, 0);
  if (!found)
    throw new AppError(
      "forbidden",
      "Informe scope com o escopo ARM cadastrado.",
      403,
    );
}

export function assertArmChatScope(configured: string, scope?: Scope) {
  if (
    !scope ||
    decodeURIComponent(scopePath(scope)).toLowerCase() !==
      configured.toLowerCase()
  )
    throw new AppError(
      "forbidden",
      "O escopo selecionado no chat difere do scope do ARM MCP. Selecione a mesma subscription/RG ou ajuste a conexão.",
      403,
    );
}
