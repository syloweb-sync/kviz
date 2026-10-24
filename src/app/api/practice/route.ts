import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { clientIp, handler, json, readJson } from "@/lib/server/http";
import { QuizNotPlayableError, createPractice } from "@/lib/server/games/service";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getServerSupabase } from "@/lib/supabase/server";

export const POST = handler(async (request: Request) => {
  const { quizId } = z.object({ quizId: z.uuid() }).parse(await readJson(request));
  const user = await getCurrentUser();
  await enforceRateLimit("practice", user?.id ?? clientIp(request), 30, 3600);
  let nickname = "Igrač";
  if (user) {
    const supabase = await getServerSupabase();
    const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    nickname = data?.display_name?.trim() || nickname;
  }
  try {
    return json(await createPractice(quizId, user ? { id: user.id, nickname } : null), { status: 201 });
  } catch (error) {
    if (error instanceof QuizNotPlayableError) {
      return json({ error: { code: error.code, message: error.message, issues: error.issues } }, { status: 422 });
    }
    throw error;
  }
});
