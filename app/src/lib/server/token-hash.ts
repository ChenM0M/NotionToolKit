import crypto from "node:crypto";

export function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
}
