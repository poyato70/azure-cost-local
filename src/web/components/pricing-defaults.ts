import { resolveSchema } from "./SchemaInputs.js";
const pricingDefaults: Record<string, string> = {
  currency: "BRL",
  currencyCode: "BRL",
  sku: "Standard_D4s_v5",
  service: "Virtual Machines",
  "service-family": "Compute",
  serviceFamily: "Compute",
  "price-type": "Consumption",
  priceType: "Consumption",
};
export function applyPricingDefaults(
  name: string,
  schema: any,
  input: any,
  preferDefaults = false,
): any {
  if (name !== "pricing_get") return input;
  function fill(raw: any, value: any, depth: number): any {
    if (
      depth > 6 ||
      (value !== undefined &&
        (value === null || typeof value !== "object" || Array.isArray(value)))
    )
      return value;
    const s = resolveSchema(raw, schema),
      out = { ...(value || {}) };
    for (const [key, definition] of Object.entries(s?.properties || {})) {
      const field = resolveSchema(definition, schema),
        preset = pricingDefaults[key];
      if (field?.type === "object" || field?.properties) {
        const nested = fill(field, out[key], depth + 1);
        if (nested && Object.keys(nested).length) out[key] = nested;
      } else if (
        preset !== undefined &&
        (!field.type || field.type === "string") &&
        (!field.enum || field.enum.includes(preset)) &&
        (preferDefaults ||
          out[key] == null ||
          (typeof out[key] === "string" && !out[key].trim()))
      )
        out[key] = preset;
    }
    return out;
  }
  return fill(schema, input, 0);
}
