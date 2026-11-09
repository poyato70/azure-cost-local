import { it, expect } from "vitest";
import { applyPricingDefaults } from "../../src/web/components/pricing-defaults.js";
const properties = {
  currency: { type: "string" },
  sku: { type: "string" },
  service: { type: "string" },
  "service-family": { type: "string" },
  "price-type": { type: "string" },
  region: { type: "string" },
};
it("fills only blank pricing fields present in the discovered schema", () => {
  const schema = {
    type: "object",
    properties: { request: { type: "object", properties } },
  };
  expect(
    applyPricingDefaults("pricing_get", schema, {
      request: { currency: " ", sku: "Standard_D2s_v5", region: "brazilsouth" },
    }),
  ).toEqual({
    request: {
      currency: "BRL",
      sku: "Standard_D2s_v5",
      service: "Virtual Machines",
      "service-family": "Compute",
      "price-type": "Consumption",
      region: "brazilsouth",
    },
  });
});
it("does not invent fields or affect other tools and resolves referenced parameter objects", () => {
  const schema = {
    $defs: { args: { type: "object", properties } },
    type: "object",
    properties: { request: { $ref: "#/$defs/args" } },
  };
  expect(
    (applyPricingDefaults("pricing_get", schema, {}) as any).request.currency,
  ).toBe("BRL");
  expect(applyPricingDefaults("other_tool", schema, {})).toEqual({});
  expect(
    applyPricingDefaults(
      "pricing_get",
      { type: "object", properties: { sku: properties.sku } },
      {},
    ),
  ).toEqual({ sku: "Standard_D4s_v5" });
});
