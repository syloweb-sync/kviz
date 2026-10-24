import "server-only";

import { cloneQuestionWithNewIds } from "@/lib/domain/question-defaults";
import { questionSchema, quizDocumentSchema, type Question, type QuizDocument } from "@/lib/domain/schema";
import { validateQuizForPlay } from "@/lib/domain/validation";
import type { Json } from "@/lib/supabase/database.types";
import { getAdminSupabase, type TypedClient } from "@/lib/supabase/server";
import { notFound } from "./http";

export interface StoredQuiz {
  id: string;
  ownerId: string;
  document: QuizDocument;
  practiceShared: boolean;
  updatedAt: string;
  /** Questions that could not be parsed (corrupted rows) and were skipped. */
  skipped: number;
}

/** Loads a quiz as a validated document. Uses the caller's client, so RLS enforces ownership. */
export async function loadQuizDocument(supabase: TypedClient, quizId: string): Promise<StoredQuiz> {
  const { data: quiz, error } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle();
  if (error) throw error;
  if (!quiz) throw notFound("Kviz ne postoji.");
  const { data: rows, error: qError } = await supabase
    .from("quiz_questions")
    .select("data")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  if (qError) throw qError;

  const questions: Question[] = [];
  let skipped = 0;
  for (const row of rows) {
    const parsed = questionSchema.safeParse(row.data);
    if (parsed.success) questions.push(parsed.data);
    else skipped++;
  }
  const document = quizDocumentSchema.parse({
    title: quiz.title,
    description: quiz.description,
    coverImage: quiz.cover_image ?? null,
    category: quiz.category,
    tags: quiz.tags,
    questions,
  });
  return {
    id: quiz.id,
    ownerId: quiz.owner_id,
    document,
    practiceShared: quiz.practice_shared,
    updatedAt: quiz.updated_at,
    skipped,
  };
}

/** Persists a full quiz document atomically (see `save_quiz` in the migration). */
export async function saveQuizDocument(supabase: TypedClient, quizId: string, document: QuizDocument) {
  const issues = validateQuizForPlay(document);
  const { questions, ...meta } = document;
  const { data, error } = await supabase.rpc("save_quiz", {
    p_quiz_id: quizId,
    p_meta: meta as unknown as NonNullable<Json>,
    p_questions: questions as unknown as NonNullable<Json>,
    p_is_playable: issues.length === 0,
    p_issue_count: issues.length,
  });
  if (error) {
    if (error.code === "P0002") throw notFound("Kviz ne postoji.");
    throw error;
  }
  return { updatedAt: data, issues };
}

export async function createQuiz(supabase: TypedClient, ownerId: string, document?: QuizDocument) {
  const { data, error } = await supabase
    .from("quizzes")
    .insert({ owner_id: ownerId, title: document?.title ?? "" })
    .select("id")
    .single();
  if (error) throw error;
  if (document) await saveQuizDocument(supabase, data.id, document);
  return data.id;
}

/**
 * Prepares an imported document: every question and option gets a fresh ID so imports can
 * never collide with (or reveal answers through) identifiers chosen by someone else.
 */
export function prepareImport(document: QuizDocument): QuizDocument {
  return { ...document, questions: document.questions.map(cloneQuestionWithNewIds) };
}

/** Media paths referenced by a document (cover, question media, options, pairs). */
export function referencedMediaPaths(document: QuizDocument): Set<string> {
  const paths = new Set<string>();
  if (document.coverImage) paths.add(document.coverImage.path);
  for (const q of document.questions) {
    if (q.media) paths.add(q.media.path);
    switch (q.type) {
      case "single_choice":
      case "multi_select":
      case "poll":
        q.config.options.forEach((o) => o.media && paths.add(o.media.path));
        break;
      case "image_choice":
        q.config.options.forEach((o) => o.media && paths.add(o.media.path));
        break;
      case "pin_image":
        if (q.config.image) paths.add(q.config.image.path);
        break;
      case "matching":
        q.config.pairs.forEach((p) => {
          if (p.leftMedia) paths.add(p.leftMedia.path);
          if (p.rightMedia) paths.add(p.rightMedia.path);
        });
        break;
      default:
        break;
    }
  }
  return paths;
}

/**
 * Deletes an owner's uploaded images that no quiz and no running game references any more.
 * Uploads younger than one hour are kept, so files being attached right now are never lost.
 */
export async function cleanupOrphanMedia(ownerId: string): Promise<number> {
  const admin = getAdminSupabase();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: media, error } = await admin
    .from("quiz_media")
    .select("id, path")
    .eq("owner_id", ownerId)
    .lt("created_at", cutoff);
  if (error) throw error;
  if (!media.length) return 0;

  const used = new Set<string>();
  const { data: quizzes } = await admin.from("quizzes").select("id, cover_image").eq("owner_id", ownerId);
  for (const quiz of quizzes ?? []) {
    const cover = quiz.cover_image as { path?: string } | null;
    if (cover?.path) used.add(cover.path);
  }
  const quizIds = (quizzes ?? []).map((q) => q.id);
  if (quizIds.length) {
    const { data: rows } = await admin.from("quiz_questions").select("data").in("quiz_id", quizIds);
    for (const row of rows ?? []) {
      for (const match of JSON.stringify(row.data).matchAll(/"path":"([^"]+)"/g)) used.add(match[1] as string);
    }
  }
  const { data: live } = await admin
    .from("game_sessions")
    .select("quiz_snapshot")
    .eq("host_id", ownerId)
    .not("state", "in", "(finished,cancelled)");
  for (const session of live ?? []) {
    for (const match of JSON.stringify(session.quiz_snapshot).matchAll(/"path":"([^"]+)"/g)) used.add(match[1] as string);
  }

  const orphans = media.filter((m) => !used.has(m.path));
  if (!orphans.length) return 0;
  const { error: removeError } = await admin.storage.from("quiz-media").remove(orphans.map((m) => m.path));
  if (removeError) throw removeError;
  await admin.from("quiz_media").delete().in("id", orphans.map((m) => m.id));
  return orphans.length;
}
