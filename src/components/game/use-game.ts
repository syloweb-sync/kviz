"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { channelName, type GameEvent, type GameView } from "@/lib/game/types";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export type GameLoadError = { kind: "not_joined" | "kicked" | "not_found" | "forbidden" | "network" | "unknown"; message: string };

const POLL_WHEN_DISCONNECTED_MS = 2500;
const SAFETY_POLL_MS = 12_000;

/**
 * Keeps an authoritative `GameView` in sync:
 *  - subscribes to the game's Realtime broadcast channel and refetches on events,
 *  - coalesces bursts of events into a single request,
 *  - falls back to polling while the socket is down, plus a slow safety poll,
 *  - re-validates on focus / network recovery,
 *  - tracks presence so the host can see who is connected.
 */
export function useGame({ sessionId, token, role }: { sessionId: string; token: string | null; role: "host" | "player" }) {
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<GameLoadError | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const clockOffset = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const pending = useRef(false);
  const versionRef = useRef(-1);
  const lastEventId = useRef<string | null>(null);

  const headers = token ? { "x-player-token": token } : undefined;

  const fetchState = useCallback(async () => {
    const started = Date.now();
    try {
      const next = await apiFetch<GameView>(`/api/games/${sessionId}/state`, { headers });
      const ended = Date.now();
      clockOffset.current = next.session.serverNow - (started + ended) / 2;
      versionRef.current = next.session.version;
      setView(next);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) setError({ kind: "not_joined", message: err.message });
        else if (err.code === "kicked") setError({ kind: "kicked", message: err.message });
        else if (err.status === 404) setError({ kind: "not_found", message: err.message });
        else if (err.status === 403) setError({ kind: "forbidden", message: err.message });
        else if (err.status === 0) setError((e) => e ?? { kind: "network", message: err.message });
        else setError({ kind: "unknown", message: err.message });
      }
    }
    // headers is derived from token, which is stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  /** Coalesced refresh: at most one request in flight, plus one queued. */
  const refresh = useCallback(async () => {
    if (inFlight.current) {
      pending.current = true;
      return inFlight.current;
    }
    const run = (async () => {
      do {
        pending.current = false;
        await fetchState();
      } while (pending.current);
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, [fetchState]);

  // Initial load.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription + presence.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    try {
      const supabase = getBrowserSupabase();
      channel = supabase.channel(channelName(sessionId), {
        config: { broadcast: { self: false }, presence: { key: `${role}:${Math.random().toString(36).slice(2)}` } },
      });
      channel.on("broadcast", { event: "game" }, ({ payload }) => {
        const event = payload as GameEvent;
        if (!event || event.id === lastEventId.current) return;
        lastEventId.current = event.id;
        // Players don't need a refetch for every answer someone else submits.
        if (role === "player" && event.type === "answer_submitted") return;
        void refresh();
      });
      channel.on("presence", { event: "sync" }, () => {
        if (!channel) return;
        const ids = new Set<string>();
        for (const metas of Object.values(channel.presenceState<{ playerId?: string }>())) {
          for (const meta of metas) if (meta.playerId) ids.add(meta.playerId);
        }
        setOnline(ids);
      });
      channel.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnection("live");
          // Catch up on anything missed while disconnected.
          void refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("reconnecting");
        } else if (status === "CLOSED") {
          setConnection("offline");
        }
      });
    } catch {
      setConnection("offline");
    }
    return () => {
      cancelled = true;
      if (channel) void getBrowserSupabase().removeChannel(channel);
    };
  }, [sessionId, role, refresh]);

  // Announce our own presence once we know who we are.
  const playerId = view?.me?.id;
  useEffect(() => {
    if (role !== "player" || !playerId || connection !== "live") return;
    const channel = getBrowserSupabase()
      .getChannels()
      .find((c) => c.topic === `realtime:${channelName(sessionId)}`);
    void channel?.track({ playerId });
  }, [role, playerId, connection, sessionId]);

  // Polling: fast while disconnected, slow safety net while connected.
  useEffect(() => {
    const interval = connection === "live" ? SAFETY_POLL_MS : POLL_WHEN_DISCONNECTED_MS;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, interval);
    return () => window.clearInterval(id);
  }, [connection, refresh]);

  // Revalidate when the tab becomes visible or the network returns.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    const onOnline = () => {
      setConnection((c) => (c === "live" ? c : "reconnecting"));
      void refresh();
    };
    const onOffline = () => setConnection("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  /** Host/practice control action with optimistic-concurrency version. */
  const act = useCallback(
    async (body: Record<string, unknown>) => {
      const result = await apiFetch<{ ok: boolean }>(`/api/games/${sessionId}/actions`, { method: "POST", body, headers });
      await refresh();
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, token, refresh],
  );

  const now = useCallback(() => Date.now() + clockOffset.current, []);

  return { view, error, connection, online, refresh, act, now, setView };
}
