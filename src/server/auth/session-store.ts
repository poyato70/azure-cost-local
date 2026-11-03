import { randomBytes } from "node:crypto";
import type { PublicClientApplication, AccountInfo } from "@azure/msal-node";
export type Session = {
  accessId?: string;
  accessVersion?: number;
  principalKind?: "user" | "application";
  loginError?: { code: string; message: string };
  id: string;
  userId: string;
  tenantId: string;
  csrf: string;
  controller: AbortController;
  createdAt: number;
  pca?: PublicClientApplication;
  account?: AccountInfo;
};
export class SessionStore {
  private sessions = new Map<string, Session>();
  create(userId: string, tenantId: string) {
    const id = randomBytes(32).toString("base64url");
    this.sessions.set(id, {
      id,
      userId,
      tenantId,
      csrf: randomBytes(32).toString("base64url"),
      controller: new AbortController(),
      createdAt: Date.now(),
    });
    return id;
  }
  get(id?: string) {
    if (!id) return;
    const s = this.sessions.get(id);
    if (s && Date.now() - s.createdAt > 8 * 3600000) {
      this.remove(id);
      return;
    }
    return s;
  }
  remove(id: string) {
    this.sessions.get(id)?.controller.abort();
    this.sessions.delete(id);
  }
  clear() {
    for (const id of this.sessions.keys()) this.remove(id);
  }
}
