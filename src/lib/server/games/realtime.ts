import "server-only";

import { randomUUID } from "node:crypto";
import { requirePublicEnv } from "@/lib/env";
import { channelName, type GameEvent, type GameEventType } from "@/lib/game/types";
import { getAdminSupabase, secretKey } from "@/lib/supabase/server";

/**
 * Publishes a game event through Supabase Realtime Broadcast (REST endpoint) and records it
 * in `game_events`. Payloads never contain answers or scores — clients refetch their own
 * authorised view, which makes handling idempotent and robust to missed events.
 */
export async function publishGameEvent(sessionId: string, type: GameEventType, version: number) {
  const event: GameEvent = { id: randomUUID(), type, sessionId, version, at: Date.now() };
  const { supabaseUrl } = requirePublicEnv();
  const key = secretKey();

  const persist = getAdminSupabase()
    .from("game_events")
    .insert({ session_id: sessionId, type, state_version: version, payload: { id: event.id } })
    .then(({ error }) => {
      if (error) console.error("[realtime] persist failed", error.message);
    });

  const send = fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      messages: [{ topic: channelName(sessionId), event: "game", payload: event, private: false }],
    }),
    signal: AbortSignal.timeout(4000),
  })
    .then((res) => {
      if (!res.ok) console.error("[realtime] broadcast failed", res.status);
    })
    .catch((error: unknown) => console.error("[realtime] broadcast error", error));

  await Promise.all([persist, send]);
  return event;
}
