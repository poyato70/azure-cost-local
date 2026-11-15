export const azureAiResourceIdPattern =
  /^\/subscriptions\/[a-f0-9-]{36}\/resourceGroups\/[\p{L}\p{N}_.() -]{1,90}\/providers\/Microsoft\.CognitiveServices\/accounts\/[a-z0-9-]{2,64}$/iu;

const resourceRoutePattern =
  /(?:^|\/)resource(\/subscriptions\/[a-f0-9-]{36}\/resourceGroups\/[\p{L}\p{N}_.() -]{1,90}\/providers\/Microsoft\.CognitiveServices\/accounts\/[a-z0-9-]{2,64})(?:\/|$)/iu;

export type AzureAiResourceIdResult =
  | { resourceId: string; extractedFromPortal: boolean; error?: never }
  | { resourceId?: never; extractedFromPortal: false; error: string };

export function parseAzureAiResourceId(value: string): AzureAiResourceIdResult {
  const input = value.trim();
  if (azureAiResourceIdPattern.test(input))
    return { resourceId: input, extractedFromPortal: false };
  if (!/^https?:\/\//i.test(input))
    return {
      extractedFromPortal: false,
      error:
        "Use o Resource ID completo iniciado por /subscriptions/… ou cole uma URL HTTPS do portal Azure que contenha esse recurso.",
    };

  let portal: URL;
  try {
    portal = new URL(input);
  } catch {
    return {
      extractedFromPortal: false,
      error: "A URL informada não é válida.",
    };
  }
  if (
    portal.protocol !== "https:" ||
    portal.origin !== "https://portal.azure.com" ||
    /%(?:2f|5c)/i.test(portal.pathname + portal.hash)
  )
    return {
      extractedFromPortal: false,
      error:
        "Só é possível extrair o Resource ID de uma URL HTTPS do portal.azure.com. Cole o Resource ID diretamente para outros hosts.",
    };

  for (const route of [portal.hash.slice(1), portal.pathname]) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(route);
    } catch {
      continue;
    }
    const match = decoded.match(resourceRoutePattern);
    if (match?.[1] && azureAiResourceIdPattern.test(match[1]))
      return { resourceId: match[1], extractedFromPortal: true };
  }
  return {
    extractedFromPortal: false,
    error:
      "Não encontrei um Azure OpenAI em uma rota de recurso reconhecida nessa página. Abra o recurso no portal e copie o Resource ID em Visão geral.",
  };
}

export function validateAzureAiUsagePeriod(from: string, toExclusive: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(toExclusive))
    return "Informe as datas inicial e final.";
  const fromTime = Date.parse(from + "T00:00:00Z");
  const toTime = Date.parse(toExclusive + "T00:00:00Z");
  if (
    !Number.isFinite(fromTime) ||
    !Number.isFinite(toTime) ||
    new Date(fromTime).toISOString().slice(0, 10) !== from ||
    new Date(toTime).toISOString().slice(0, 10) !== toExclusive
  )
    return "Informe datas válidas no calendário.";
  const days = (toTime - fromTime) / 86400000;
  if (days <= 0) return "A data final exclusiva precisa ser posterior à data inicial.";
  if (days > 30) return "O intervalo máximo é de 30 dias (fim exclusivo).";
  return undefined;
}
