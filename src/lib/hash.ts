import { createHash } from "node:crypto";

export function hashFileBytes(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
