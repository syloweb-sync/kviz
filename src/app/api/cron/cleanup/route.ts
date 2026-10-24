import { safeEqual } from "@/lib/server/crypto";
import { handler, json, unauthorized } from "@/lib/server/http";
import { getAdminSupabase } from "@/lib/supabase/server";

/** Daily retention job (scheduled in vercel.json). Requires `Authorization: Bearer $CRON_SECRET`. */
export const GET = handler(async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) throw unauthorized("Neovlašteno.");
  const { data, error } = await getAdminSupabase().rpc("cleanup_stale_games");
  if (error) throw error;
  return json({ ok: true, result: data });
});
