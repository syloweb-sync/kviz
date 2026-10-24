"use client";

import { useMemo, useSyncExternalStore } from "react";

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

const SERVER_SNAPSHOT = "__server__";

function readRaw(sessionId: string): string | null {
  try {
    const raw = localStorage.getItem(key(sessionId));
    if (raw) return raw;
  } catch {
    // ignore
  }
  const fromMemory = memory.get(sessionId);
  return fromMemory ? JSON.stringify(fromMemory) : null;
}

/**
 * Reads the stored player for a game. Returns `undefined` during server rendering (unknown),
 * `null` when this device has not joined the game.
 */
export function useStoredPlayer(sessionId: string): StoredPlayer | null | undefined {
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => readRaw(sessionId),
    () => SERVER_SNAPSHOT,
  );
  return useMemo(() => {
    if (raw === SERVER_SNAPSHOT) return undefined;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StoredPlayer;
      return typeof parsed?.token === "string" ? parsed : null;
    } catch {
      return null;
    }
  }, [raw]);
}
