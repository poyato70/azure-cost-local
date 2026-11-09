// Financial/resource identifiers are retained; authentication material is not.
export function sanitizeEvidence<T>(input: T, secrets: string[] = []): T {
  const clean = (value: string) => {
    let out = value;
    for (const secret of secrets.filter(Boolean))
      out = out.split(secret).join("[oculto]");
    return out
      .replace(/Bearer\s+\S+/gi, "Bearer [oculto]")
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token oculto]")
      .replace(
        /((?:password|client_secret|access_token|refresh_token|api_key)=)[^\s&]+/gi,
        "$1[oculto]",
      );
  };
  const visit = (v: unknown): unknown => {
    if (typeof v === "string") return clean(v);
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, val]) => [
          clean(k),
          /authorization|cookie|password|secret|token|credential|api.?key/i.test(
            k,
          )
            ? "[oculto]"
            : visit(val),
        ]),
      );
    return v;
  };
  return visit(input) as T;
}
