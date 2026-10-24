import { stripAccents } from "./normalize";

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/**
 * A short, conservative block list (Croatian + English). It is only applied when the host
 * enables the nickname filter, and matches whole words after removing accents and
 * common character substitutions.
 */
const BLOCKED = [
  "kurac",
  "picka",
  "pizda",
  "jebem",
  "jebi",
  "jebo",
  "kurva",
  "drolja",
  "debil",
  "kreten",
  "idiot",
  "seljacina",
  "fuck",
  "bitch",
  "cunt",
  "nigger",
  "nigga",
  "whore",
  "slut",
  "hitler",
  "ustasa",
  "cetnik",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

function canonical(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[013457@$]/g, (ch) => LEET[ch] ?? ch);
}

export function containsBlockedWord(nickname: string): boolean {
  const compact = canonical(nickname).replace(/[^a-z]/g, "");
  return BLOCKED.some((word) => compact.includes(word));
}

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; error: string };

export function checkNickname(raw: string, options: { filter: boolean }): NicknameCheck {
  const nickname = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (nickname.length < NICKNAME_MIN) return { ok: false, error: `Nadimak treba barem ${NICKNAME_MIN} znaka.` };
  if (nickname.length > NICKNAME_MAX) return { ok: false, error: `Nadimak smije imati najviše ${NICKNAME_MAX} znakova.` };
  if (/[\p{C}<>]/u.test(nickname)) return { ok: false, error: "Nadimak sadrži nedopuštene znakove." };
  if (options.filter && containsBlockedWord(nickname)) return { ok: false, error: "Odaberite pristojniji nadimak." };
  return { ok: true, nickname };
}
