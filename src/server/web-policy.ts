import { createHash } from "node:crypto";
export function inlineScriptHashes(html: string) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !/\bsrc\s*=/i.test(m[1]))
    .map(
      (m) =>
        `'sha256-${createHash("sha256").update(m[2].replace(/\r\n?/g, "\n")).digest("base64")}'`,
    )
    .join(" ");
}
export function staticPolicy(html: string, frame = false) {
  return `default-src 'self'; script-src 'self' ${inlineScriptHashes(html)}${frame ? " https://cdnjs.cloudflare.com" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors ${frame ? "'self'" : "'none'"}; base-uri 'none'; form-action 'self'`;
}
