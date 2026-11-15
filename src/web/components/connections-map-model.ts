import {
  cloudDefaults,
  type CloudDefault,
} from "../../shared/cloud-defaults.js";

export type MapProfile = {
  id: string;
  name: string;
  preset: string;
  endpoint?: string;
  transport: string;
  authMode: string;
  resourceContext?: Record<string, string>;
  connected?: boolean;
  status?: string;
  capability?: { status?: string; reason?: string };
};

export type MapProvider = CloudDefault["provider"] | "Personalizado";

export type MapIntegration = {
  id: string;
  name: string;
  provider: MapProvider;
  category: string;
  supports: string[];
  prerequisite: string;
  target?: string;
  profile?: MapProfile;
};

export function providerForProfile(
  profile: Pick<MapProfile, "preset" | "endpoint">,
): MapProvider {
  if (["azure", "arm", "adx", "foundry", "fabric", "powerbi"].includes(profile.preset)) return "Azure";
  if (profile.preset === "aws" || profile.preset.startsWith("aws-")) return "AWS";
  if (profile.preset === "gcp" || profile.preset.startsWith("gcp-")) return "GCP";
  if (/amazonaws\.com|\.execute-api\.[^.]+\.amazonaws\.com/i.test(profile.endpoint || "")) return "AWS";
  if (/googleapis\.com|googleusercontent\.com/i.test(profile.endpoint || "")) return "GCP";
  if (["custom", "kubernetes"].includes(profile.preset)) return "Personalizado";
  return "Personalizado";
}

export function integrationNameForProfile(profile: MapProfile) {
  switch (profile.preset) {
    case "arm":
      return "Azure Cost Management";
    case "adx":
      return "Azure Data Explorer";
    case "foundry":
      return "Microsoft Foundry";
    case "fabric":
      return "Microsoft Fabric";
    case "powerbi":
      return "Power BI";
    case "azure":
      return profile.resourceContext?.namespace === "advisor"
        ? "Azure Advisor"
        : "Microsoft Azure MCP";
    case "kubernetes":
      return "Kubernetes / OpenShift MCP";
    default:
      return profile.name || "MCP personalizado";
  }
}

function matchesCatalog(profile: MapProfile, entry: CloudDefault) {
  if (entry.target === "arm") return profile.preset === "arm";
  if (entry.target === "advisor")
    return (
      profile.preset === "azure" &&
      profile.resourceContext?.namespace === "advisor"
    );
  return integrationNameForProfile(profile) === entry.name;
}

export function buildMapIntegrations(
  provider: MapProvider,
  profiles: MapProfile[],
): MapIntegration[] {
  const catalog = cloudDefaults
    .filter((entry) => entry.provider === provider)
    .map<MapIntegration>((entry) => ({
      id: `catalog:${entry.provider}:${entry.name}`,
      name: entry.name,
      provider: entry.provider,
      category: entry.connectionType,
      supports: entry.supports,
      prerequisite: entry.prerequisite,
      target:
        entry.target === "arm" || entry.target === "advisor"
          ? entry.target
          : undefined,
      profile: profiles.find((profile) => matchesCatalog(profile, entry)),
    }));

  const additional = profiles
    .filter((profile) => providerForProfile(profile) === provider)
    .filter(
      (profile) => !catalog.some((entry) => entry.profile?.id === profile.id),
    )
    .map<MapIntegration>((profile) => ({
      id: `profile:${profile.id}`,
      name: integrationNameForProfile(profile),
      provider,
      category: `MCP ${profile.transport}`,
      supports: [],
      prerequisite:
        "Consulte a análise do servidor para ver ferramentas e capacidades descobertas.",
      profile,
    }));

  return [...catalog, ...additional];
}

export function catalogProfileCount(
  provider: MapProvider,
  profiles: MapProfile[],
) {
  return new Set(
    profiles
      .filter((profile) => providerForProfile(profile) === provider)
      .map((profile) => profile.id),
  ).size;
}

export function mapProviders(profiles: MapProfile[]) {
  const providers: MapProvider[] = ["Azure", "AWS", "GCP"];
  if (
    profiles.some((profile) => providerForProfile(profile) === "Personalizado")
  )
    providers.push("Personalizado");
  return providers;
}
