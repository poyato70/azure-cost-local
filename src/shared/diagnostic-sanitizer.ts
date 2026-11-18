const sensitiveKey =
  "(?:client[_-]?secret|password|refresh[_-]?token|access[_-]?token|id[_-]?token|token|cookie|set-cookie|authorization|api[_-]?key|secret|credential|code|state)";

/** Defense-in-depth sanitizer for diagnostic strings before display/export. */
export function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [oculto]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token oculto]")
    .replace(/\b(?:cookie|set-cookie)\s*:\s*[^\r\n]*/gi, "Cookie: [oculto]")
    .replace(
      new RegExp(
        `(${sensitiveKey}\\s*[=:]\\s*)(?:"[^"]*"|'[^']*'|[^\\s&,;]+)`,
        "gi",
      ),
      "$1[oculto]",
    )
    .replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, "https://[credencial]@")
    .slice(0, 1500);
}
