import "server-only";

import { getAdminSupabase } from "@/lib/supabase/server";
import { sha256 } from "./crypto";
import { tooManyRequests } from "./http";

/**
 * Database-backed fixed-window limiter, so it works across serverless instances.
 * Keys are hashed so raw IP addresses are never stored.
 */
export async function enforceRateLimit(scope: string, identifier: string, limit: number, windowSeconds: number) {
  const key = `${scope}:${sha256(identifier).slice(0, 32)}`;
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
