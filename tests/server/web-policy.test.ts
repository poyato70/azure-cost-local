import { it, expect } from "vitest";
import { staticPolicy } from "../../src/server/web-policy.js";
it("hashes inline scripts after the HTML parser CRLF normalization", () => {
  expect(staticPolicy("<script>one();\r\ntwo();</script>")).toBe(
    staticPolicy("<script>one();\ntwo();</script>"),
  );
});
it("authorizes exported inline scripts by hash without globally allowing inline JS or CDN", () => {
  const policy = staticPolicy(
    '<script>window.a=1</script><script src="/a.js"></script>',
  );
  expect(policy).toContain("sha256-");
  expect(policy.split("style-src")[0]).not.toContain("unsafe-inline");
  expect(policy).not.toContain("cdnjs");
  expect(policy).toContain("frame-ancestors 'none'");
});
it("isolates Three.js CDN permission to the standalone frame", () => {
  expect(staticPolicy("<script>render()</script>", true)).toContain(
    "https://cdnjs.cloudflare.com",
  );
  expect(staticPolicy("", true)).toContain("frame-ancestors 'self'");
});
