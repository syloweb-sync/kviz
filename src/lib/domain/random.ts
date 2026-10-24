/**
 * Small, dependency-free helpers for IDs, hashing and deterministic shuffles.
 * Everything here runs both in the browser and in Node.
 */

const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** Random, URL-safe identifier used for options, items and questions inside a quiz document. */
export function createId(length = 12): string {
  const bytes = randomBytes(length);
  let id = "";
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

/** FNV-1a 32-bit hash. Not cryptographic — used for seeding and public ID derivation only. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG — deterministic, so every client and the server agree on a shuffle. */
export function seededRandom(seed: string): () => number {
  let state = fnv1a(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/**
 * Shuffle that never returns the original order (when more than one distinct order exists).
 * Used for ordering questions so the correct sequence is never shown as the starting state.
 */
export function shuffleAwayFrom<T>(items: readonly T[], seed: string): T[] {
  if (items.length < 2) return [...items];
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = shuffle(items, `${seed}:${attempt}`);
    if (candidate.some((item, index) => item !== items[index])) return candidate;
  }
  // Deterministic fallback: rotate by one.
  return [...items.slice(1), items[0] as T];
}

/**
 * Derives the identifier that clients see for an option/item. Real IDs never leave the server,
 * so the ordering of IDs (or a hand-written import like "a, b, c") cannot leak the answer.
 */
export function publicId(seed: string, realId: string): string {
  const a = fnv1a(`${seed}|${realId}`).toString(36);
  const b = fnv1a(`${realId}|${seed}|x`).toString(36);
  return `p${a}${b}`;
}

export function randomToken(bytes = 32): string {
  return Array.from(randomBytes(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
