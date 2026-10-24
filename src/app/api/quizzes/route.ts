import { quizDocumentSchema, quizExportSchema } from "@/lib/domain/schema";
import { requireUser } from "@/lib/server/auth";
import { badRequest, handler, json, readJson } from "@/lib/server/http";
import { createQuiz, prepareImport } from "@/lib/server/quizzes";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getServerSupabase } from "@/lib/supabase/server";

/** Creates an empty quiz, or imports one from a JSON export (`{ import: {...} }`). */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  await enforceRateLimit("quiz-create", user.id, 60, 3600);
  const body = (await readJson(request).catch(() => ({}))) as { import?: unknown } | null;
  const supabase = await getServerSupabase();

  if (body && body.import !== undefined) {
    const parsed = quizExportSchema.safeParse(body.import);
    if (!parsed.success) {
      // Accept a bare quiz document too, for hand-written files.
      const bare = quizDocumentSchema.safeParse(body.import);
      if (!bare.success) throw badRequest("Datoteka nije ispravan izvoz kviza.", "invalid_import");
      const id = await createQuiz(supabase, user.id, prepareImport(bare.data));
      return json({ id }, { status: 201 });
    }
    const id = await createQuiz(supabase, user.id, prepareImport(parsed.data.quiz));
    return json({ id }, { status: 201 });
  }

  const id = await createQuiz(supabase, user.id);
  return json({ id }, { status: 201 });
});
