import { test, expect } from "@playwright/test";
test("4D frame runs its projection and draws visible edges", async ({
  page,
}) => {
  page.on("pageerror", (e) => console.log("Animation page error:", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("Animation console error:", m.text());
  });
  await page.goto("/");
  const frame = page.frameLocator('iframe[title="Tesseract 4D interativo"]');
  await expect(frame.locator("#info")).toHaveAttribute("data-ready", "true", {
    timeout: 20000,
  });
  const count = await frame.locator("canvas").evaluate((canvas) => {
    const c = canvas as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return 0;
    const pixels = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let bright = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 60 && pixels[i + 2] > 90) bright++;
    return bright;
  });
  expect(count).toBeGreaterThan(50);
});
