import "server-only";

import { getAdminSupabase } from "@/lib/supabase/server";
import { sha256 } from "./crypto";
import { tooManyRequests } from "./http";

/**
 * Database-backed fixed-window limiter, so it works across serverless instances.
 * Keys are hashed so raw IP addresses are never stored.
 */
const limiterKey = (scope: string, identifier: string) => `${scope}:${sha256(identifier).slice(0, 32)}`;

export async function enforceRateLimit(scope: string, identifier: string, limit: number, windowSeconds: number) {
  const key = limiterKey(scope, identifier);
  const { data, error } = await getAdminSupabase().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Fail open on limiter errors: availability matters more than a missed limit here.
    console.error("[rate-limit] error", error.message);
    return;
  }
  if (data === false) throw tooManyRequests();
}

/** Read-only check: true when the caller already used up the window (does not count a hit). */
export async function isRateLimited(scope: string, identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await getAdminSupabase()
    .from("rate_limits")
    .select("hits, window_start")
    .eq("key", limiterKey(scope, identifier))
    .maybeSingle();
  if (error || !data) return false;
  const fresh = Date.now() - Date.parse(data.window_start) < windowSeconds * 1000;
  return fresh && data.hits >= limit;
}
