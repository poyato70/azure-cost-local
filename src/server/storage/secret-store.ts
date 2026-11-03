import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { dpapi } from "./dpapi.js";
import { AppError } from "../errors.js";
export class SecretStore {
  constructor(private root: string) {}
  private path(ref: string) {
    if (!/^[0-9a-f-]{36}$/.test(ref))
      throw new AppError("invalid_request", "Referência de segredo inválida.");
    return join(this.root, "vault", ref + ".bin");
  }
  async put(value: string) {
    await mkdir(join(this.root, "vault"), { recursive: true });
    const encrypted = await dpapi(
      "protect",
      Buffer.from(value, "utf8").toString("base64"),
    );
    const ref = randomUUID();
    await writeFile(this.path(ref), encrypted, { flag: "wx" });
    return ref;
  }
  async read(ref: string) {
    try {
      const encrypted = await readFile(this.path(ref), "utf8");
      return Buffer.from(
        await dpapi("unprotect", encrypted),
        "base64",
      ).toString("utf8");
    } catch {
      throw new AppError(
        "storage_unavailable",
        "Segredo ausente ou indisponível para este usuário Windows.",
        503,
      );
    }
  }
  async remove(ref: string) {
    await unlink(this.path(ref)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
