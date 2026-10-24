import { z } from "zod";
import { quizDocumentSchema } from "@/lib/domain/schema";
import { requireUser } from "@/lib/server/auth";
import { handler, json, notFound, readJson } from "@/lib/server/http";
import { cleanupOrphanMedia, loadQuizDocument, saveQuizDocument } from "@/lib/server/quizzes";
import { getServerSupabase } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const idSchema = z.uuid();

async function quizId(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) throw notFound("Kviz ne postoji.");
  return id;
}

export const GET = handler(async (_request: Request, ctx: Ctx) => {
  await requireUser();
  const supabase = await getServerSupabase();
  const quiz = await loadQuizDocument(supabase, await quizId(ctx));
  return json(quiz);
});

/** Autosave / explicit save of the whole document. */
export const PUT = handler(async (request: Request, ctx: Ctx) => {
  await requireUser();
  const id = await quizId(ctx);
  const document = quizDocumentSchema.parse(await readJson(request));
  const supabase = await getServerSupabase();
  const result = await saveQuizDocument(supabase, id, document);
  return json(result);
});

const patchSchema = z.object({ practiceShared: z.boolean() });

export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  await requireUser();
  const id = await quizId(ctx);
  const { practiceShared } = patchSchema.parse(await readJson(request));
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("quizzes")
    .update({ practice_shared: practiceShared })
    .eq("id", id)
    .select("id, practice_shared")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Kviz ne postoji.");
  return json({ practiceShared: data.practice_shared });
});

export const DELETE = handler(async (_request: Request, ctx: Ctx) => {
  const user = await requireUser();
  const id = await quizId(ctx);
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("quizzes").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw notFound("Kviz ne postoji.");
  await cleanupOrphanMedia(user.id).catch((e: unknown) => console.error("[media] cleanup failed", e));
  return json({ ok: true });
});
