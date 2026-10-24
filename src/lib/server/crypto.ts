import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Uniformly random 6-digit PIN that never starts with 0 (easier to read aloud). */
export function generatePin(): string {
  return String(randomInt(100_000, 1_000_000));
}
