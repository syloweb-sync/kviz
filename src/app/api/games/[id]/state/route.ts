import { requireUser } from "@/lib/server/auth";
import { handler, json } from "@/lib/server/http";
import { getHostView, getPlayerView } from "@/lib/server/games/service";
import { playerTokenFrom } from "@/lib/server/games/session";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Authoritative game snapshot. Players identify with `x-player-token`; otherwise the caller
 * must be the signed-in host. Each read also performs lazy timeouts (see `reconcile`).
 */
export const GET = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const token = playerTokenFrom(request);
  if (token) return json(await getPlayerView(id, token));
  const user = await requireUser();
  return json(await getHostView(id, user.id));
});
