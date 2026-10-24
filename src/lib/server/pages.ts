import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ApiError } from "./http";
import { loadQuizDocument } from "./quizzes";
import { getServerSupabase } from "@/lib/supabase/server";

/** Loads an owned quiz for a page, redirecting to login / 404 as appropriate. */
export async function loadOwnedQuizForPage(id: string, returnTo: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  try {
    return { user, quiz: await loadQuizDocument(supabase, id) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
