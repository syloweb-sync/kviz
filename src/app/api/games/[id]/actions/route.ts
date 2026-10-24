import { getCurrentUser } from "@/lib/server/auth";
import { handler, json, readJson, unauthorized } from "@/lib/server/http";
import { hostActionSchema, performAction } from "@/lib/server/games/service";
import { playerTokenFrom } from "@/lib/server/games/session";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = hostActionSchema.parse(await readJson(request));
  const token = playerTokenFrom(request);
  if (token) return json(await performAction(id, { kind: "player", token }, input));
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return json(await performAction(id, { kind: "host", userId: user.id }, input));
});
