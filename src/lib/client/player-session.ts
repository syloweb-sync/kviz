"use client";

/** Per-game player credentials, kept on this device so a reload or reconnect resumes the game. */
export interface StoredPlayer {
  playerId: string;
  token: string;
  nickname: string;
}

const key = (sessionId: string) => `pitalica:player:${sessionId}`;

export function savePlayer(sessionId: string, player: StoredPlayer) {
  try {
    localStorage.setItem(key(sessionId), JSON.stringify(player));
  } catch {
    // Private mode without storage: the in-memory fallback below still lets this tab play.
  }
  memory.set(sessionId, player);
}

const memory = new Map<string, StoredPlayer>();

export function loadPlayer(sessionId: string): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(key(sessionId));
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPlayer;
      if (parsed && typeof parsed.token === "string") return parsed;
    }
  } catch {
    // ignore
  }
  return memory.get(sessionId) ?? null;
}

export function forgetPlayer(sessionId: string) {
  try {
    localStorage.removeItem(key(sessionId));
  } catch {
    // ignore
  }
  memory.delete(sessionId);
}

const NICK_KEY = "pitalica:last-nickname";
export function lastNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}
export function rememberNickname(nickname: string) {
  try {
    localStorage.setItem(NICK_KEY, nickname);
  } catch {
    // ignore
  }
}
