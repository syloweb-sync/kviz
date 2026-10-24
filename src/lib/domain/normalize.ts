export interface TextMatchOptions {
  caseSensitive: boolean;
  accentSensitive: boolean;
  normalizeWhitespace: boolean;
}

const SPECIAL_LETTERS: Record<string, string> = {
  đ: "d",
  Đ: "D",
  ł: "l",
  Ł: "L",
  ø: "o",
  Ø: "O",
  ß: "ss",
  æ: "ae",
  Æ: "AE",
};

/** Removes diacritics (č→c, ć→c, š→s, ž→z, đ→d, é→e …). */
export function stripAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[đĐłŁøØßæÆ]/g, (ch) => SPECIAL_LETTERS[ch] ?? ch);
}

/**
 * Canonical form of a free-text answer for exact comparison. No fuzzy matching is applied:
 * two answers match only if they are identical after the configured normalisation steps.
 */
export function normalizeAnswerText(value: string, options: TextMatchOptions): string {
  let result = value.normalize("NFC");
  if (options.normalizeWhitespace) result = result.trim().replace(/\s+/gu, " ");
  if (!options.accentSensitive) result = stripAccents(result);
  if (!options.caseSensitive) result = result.toLocaleLowerCase("hr");
  return result;
}

export function textMatches(answer: string, accepted: readonly string[], options: TextMatchOptions): boolean {
  const normalized = normalizeAnswerText(answer, options);
  if (normalized.length === 0) return false;
  return accepted.some((candidate) => {
    const target = normalizeAnswerText(candidate, options);
    return target.length > 0 && target === normalized;
  });
}
