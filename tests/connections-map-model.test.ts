import { describe, expect, it } from "vitest";
import {
  buildMapIntegrations,
  integrationNameForProfile,
  mapProviders,
  providerForProfile,
  type MapProfile,
} from "../src/web/components/connections-map-model.js";

const profile = (overrides: Partial<MapProfile> = {}): MapProfile => ({
  id: "profile-1",
  name: "Azure ARM",
  preset: "arm",
  transport: "http",
  authMode: "delegated",
  connected: false,
  ...overrides,
});

describe("connections map model", () => {
  it("keeps cloud catalog separate from saved profiles and live sessions", () => {
    const catalog = buildMapIntegrations("Azure", []);
    const costManagement = catalog.find(
      (integration) => integration.name === "Azure Cost Management",
    );

    expect(costManagement?.profile).toBeUndefined();
    expect(costManagement?.target).toBe("arm");

    const configured = buildMapIntegrations("Azure", [profile()]).find(
      (integration) => integration.name === "Azure Cost Management",
    );
    expect(configured?.profile?.id).toBe("profile-1");
    expect(configured?.profile?.connected).toBe(false);
  });

  it("labels configured presets from their actual profile details", () => {
    expect(
      integrationNameForProfile(
        profile({ preset: "azure", resourceContext: { namespace: "advisor" } }),
      ),
    ).toBe("Azure Advisor");
    expect(integrationNameForProfile(profile({ preset: "adx" }))).toBe(
      "Azure Data Explorer",
    );
  });

  it("does not infer a cloud provider for custom endpoints", () => {
    expect(providerForProfile(profile({ preset: "custom" }))).toBe(
      "Personalizado",
    );
    expect(mapProviders([profile({ preset: "custom" })])).toContain(
      "Personalizado",
    );
  });

  it("recognizes provider only from explicit presets or well-known endpoint domains", () => {
    expect(
      providerForProfile(
        profile({ preset: "custom", endpoint: "https://mcp.amazonaws.com" }),
      ),
    ).toBe("AWS");
    expect(
      providerForProfile(
        profile({ preset: "custom", endpoint: "https://mcp.example.net" }),
      ),
    ).toBe("Personalizado");
  });

  it("shows AWS and GCP catalog entries without presenting them as configured", () => {
    for (const provider of ["AWS", "GCP"] as const) {
      const entries = buildMapIntegrations(provider, []);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((entry) => entry.profile === undefined)).toBe(true);
    }
  });
});
