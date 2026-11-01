import { it, expect } from "vitest";
import { resolveCopilotPath } from "../../src/server/chat/runtime.js";
it("resolves an absolute executable path on Windows without shell", () => {
  expect(
    resolveCopilotPath(
      { PATH: "C:\\tools;C:\\cli" } as any,
      "win32",
      (p) => p === "C:\\cli\\copilot.exe",
    ),
  ).toBe("C:\\cli\\copilot.exe");
});
