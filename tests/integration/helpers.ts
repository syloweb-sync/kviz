import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getAdminSupabase } from "@/lib/supabase/server";

export type Client = SupabaseClient<Database>;

export function anonClient(): Client {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Creates a confirmed user and returns a client signed in as that user. */
export async function createUser(name = "Test"): Promise<{ id: string; email: string; client: Client }> {
  const email = `it-${randomUUID()}@example.com`;
  const password = `Pass-${randomUUID()}`;
  const admin = getAdminSupabase();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

/** Skips the "get ready" lead-in so tests can answer immediately. */
export async function openCurrentQuestion(sessionId: string) {
  const row = await sessionRow(sessionId);
  const limit = Date.parse(row.question_deadline!) - Date.parse(row.question_started_at!);
  const start = Date.now() - 50;
  const { error } = await getAdminSupabase()
    .from("game_sessions")
    .update({ question_started_at: new Date(start).toISOString(), question_deadline: new Date(start + limit).toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function expireCurrentQuestion(sessionId: string) {
  const past = new Date(Date.now() - 10_000).toISOString();
  const { error } = await getAdminSupabase()
    .from("game_sessions")
    .update({ question_started_at: new Date(Date.now() - 40_000).toISOString(), question_deadline: past })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function sessionRow(sessionId: string) {
  const { data, error } = await getAdminSupabase().from("game_sessions").select("*").eq("id", sessionId).single();
  if (error) throw error;
  return data;
}
