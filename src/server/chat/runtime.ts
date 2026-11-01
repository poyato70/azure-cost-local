import { existsSync } from "node:fs";
import { join, win32 } from "node:path";
export function resolveCopilotPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  exists: (p: string) => boolean = existsSync,
) {
  const paths = env.PATH || env.Path || "";
  const pathApi = platform === "win32" ? win32 : { join };
  const candidates = [
    env.COPILOT_CLI_PATH,
    ...paths
      .split(platform === "win32" ? ";" : ":")
      .map((p) =>
        pathApi.join(p, platform === "win32" ? "copilot.exe" : "copilot"),
      ),
  ];
  const found = candidates.find((p): p is string => !!p && exists(p));
  if (!found) throw new Error("Copilot CLI não encontrado no PATH.");
  return found;
}
