import { handler, json, readJson } from "@/lib/server/http";
import { submitAnswer, submitAnswerSchema } from "@/lib/server/games/service";
import { playerTokenFrom } from "@/lib/server/games/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const token = playerTokenFrom(request);
  await enforceRateLimit("answer", `${id}:${token ?? "none"}`, 40, 60);
  const input = submitAnswerSchema.parse(await readJson(request));
  return json(await submitAnswer(id, token, input));
});
