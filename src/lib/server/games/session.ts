import "server-only";

import { z } from "zod";
import { gameSettingsSchema, questionSchema, type GameMode, type GameSettings, type Question } from "@/lib/domain/schema";
import type { GameState } from "@/lib/domain/state-machine";
import type { Database } from "@/lib/supabase/database.types";
import { getAdminSupabase } from "@/lib/supabase/server";
import { sha256 } from "../crypto";
import { conflict, notFound, unauthorized } from "../http";

export type SessionRow = Database["public"]["Tables"]["game_sessions"]["Row"];
export type PlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
export type AnswerRow = Database["public"]["Tables"]["game_answers"]["Row"];
export type TeamRow = Database["public"]["Tables"]["game_teams"]["Row"];

/** Delay between "question started" and answers opening — the "get ready" countdown. */
export const QUESTION_LEAD_IN_MS = 3000;

const snapshotSchema = z.object({
  title: z.string(),
  questions: z.array(questionSchema),
});
export type QuizSnapshot = z.infer<typeof snapshotSchema>;

export interface SessionRecord {
  row: SessionRow;
  state: GameState;
  mode: GameMode;
  settings: GameSettings;
  snapshot: QuizSnapshot;
  order: number[];
}

export function toRecord(row: SessionRow): SessionRecord {
  return {
    row,
    state: row.state as GameState,
    mode: row.mode as GameMode,
    settings: gameSettingsSchema.parse(row.settings),
    snapshot: snapshotSchema.parse(row.quiz_snapshot),
    order: row.question_order,
  };
}

export async function loadSession(sessionId: string): Promise<SessionRecord> {
  if (!z.uuid().safeParse(sessionId).success) throw notFound("Igra ne postoji.");
  const { data, error } = await getAdminSupabase().from("game_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Igra ne postoji.");
  return toRecord(data);
}

export function questionAt(record: SessionRecord, index: number): Question | null {
  const snapshotIndex = record.order[index];
  if (snapshotIndex === undefined) return null;
  return record.snapshot.questions[snapshotIndex] ?? null;
}

export function timeLimitSeconds(record: SessionRecord, question: Question): number {
  return record.settings.timerOverride ?? question.timeLimit;
}

export const teamsEnabled = (record: SessionRecord) => record.mode === "team";
export const manualPacing = (record: SessionRecord) => record.mode === "host_controlled";

/**
 * Compare-and-swap update: succeeds only if nobody changed the session since it was read.
 * Returns the updated record, or null when another request won the race.
 */
export async function casUpdate(
  record: SessionRecord,
  patch: Database["public"]["Tables"]["game_sessions"]["Update"],
): Promise<SessionRecord | null> {
  const { data, error } = await getAdminSupabase()
    .from("game_sessions")
    .update({ ...patch, state_version: record.row.state_version + 1 })
    .eq("id", record.row.id)
    .eq("state_version", record.row.state_version)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data) : null;
}

export async function activePlayers(sessionId: string): Promise<PlayerRow[]> {
  const { data, error } = await getAdminSupabase()
    .from("game_players")
    .select("*")
    .eq("session_id", sessionId)
    .eq("kicked", false)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function answersFor(sessionId: string, questionIndex: number): Promise<AnswerRow[]> {
  const { data, error } = await getAdminSupabase()
    .from("game_answers")
    .select("*")
    .eq("session_id", sessionId)
    .eq("question_index", questionIndex);
  if (error) throw error;
  return data;
}

export async function teamsFor(sessionId: string): Promise<TeamRow[]> {
  const { data, error } = await getAdminSupabase()
    .from("game_teams")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

/** Resolves the player behind a secret token. Kicked players are rejected. */
export async function authenticatePlayer(sessionId: string, token: string | null): Promise<PlayerRow> {
  if (!token || token.length < 32 || token.length > 128) throw unauthorized("Niste prijavljeni u ovu igru.");
  const { data, error } = await getAdminSupabase()
    .from("game_players")
    .select("*")
    .eq("session_id", sessionId)
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw unauthorized("Niste prijavljeni u ovu igru.");
  if (data.kicked) throw conflict("Više niste u ovoj igri.", "kicked");
  return data;
}

export function playerTokenFrom(request: Request): string | null {
  return request.headers.get("x-player-token");
}
