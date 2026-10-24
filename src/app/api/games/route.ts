import { createGameSchema } from "@/lib/domain/schema";
import { requireUser } from "@/lib/server/auth";
import { handler, json, readJson } from "@/lib/server/http";
import { QuizNotPlayableError, createGame } from "@/lib/server/games/service";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  await enforceRateLimit("game-create", user.id, 30, 3600);
  const input = createGameSchema.parse(await readJson(request));
  try {
    const game = await createGame(user.id, input);
    return json(game, { status: 201 });
  } catch (error) {
    if (error instanceof QuizNotPlayableError) {
      return json({ error: { code: error.code, message: error.message, issues: error.issues } }, { status: 422 });
    }
    throw error;
  }
});
