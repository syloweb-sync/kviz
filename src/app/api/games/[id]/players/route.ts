import { z } from "zod";
import { clientIp, handler, json, readJson } from "@/lib/server/http";
import { changeOwnTeam, joinGame, leaveGame } from "@/lib/server/games/service";
import { playerTokenFrom } from "@/lib/server/games/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const joinSchema = z.object({
  nickname: z.string().max(60),
  teamId: z.uuid().nullable().optional(),
});

/** Join a game as a guest. Returns the player's secret token (shown only once). */
export const POST = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await enforceRateLimit("join", clientIp(request), 120, 60);
  const input = joinSchema.parse(await readJson(request));
  return json(await joinGame(id, input), { status: 201 });
});

export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { teamId } = z.object({ teamId: z.uuid() }).parse(await readJson(request));
  return json(await changeOwnTeam(id, playerTokenFrom(request), teamId));
});

export const DELETE = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await leaveGame(id, playerTokenFrom(request)));
});
