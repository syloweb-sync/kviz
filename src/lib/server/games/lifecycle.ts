import "server-only";

import type { InternalAnswer } from "@/lib/domain/answers";
import { rankPlayers } from "@/lib/domain/ranking";
import { buildQuestionStats, type GradedAnswer } from "@/lib/domain/results";
import type { EvaluationStatus } from "@/lib/domain/scoring";
import { SUBMISSION_GRACE_MS, transition, type HostAction } from "@/lib/domain/state-machine";
import type { GameEventType } from "@/lib/game/types";
import type { Json } from "@/lib/supabase/database.types";
import { getAdminSupabase } from "@/lib/supabase/server";
import { ApiError, badRequest, conflict } from "../http";
import { publishGameEvent } from "./realtime";
import {
  QUESTION_LEAD_IN_MS,
  activePlayers,
  answersFor,
  casUpdate,
  loadSession,
  manualPacing,
  questionAt,
  teamsEnabled,
  teamsFor,
  timeLimitSeconds,
  type SessionRecord,
} from "./session";

const EVENT_FOR_ACTION: Record<HostAction, GameEventType> = {
  start: "game_started",
  close_question: "question_ended",
  next: "question_started",
  pause: "game_paused",
  resume: "game_resumed",
  end: "game_finished",
  cancel: "game_cancelled",
};

/**
 * Applies a host (or practice-player) action through the state machine and persists it with
 * a compare-and-swap. `expectedVersion` lets the UI make button presses idempotent: a second
 * click carries a stale version and is rejected instead of advancing twice.
 */
export async function applyAction(
  record: SessionRecord,
  action: HostAction,
  expectedVersion: number | null,
): Promise<SessionRecord> {
  if (expectedVersion !== null && expectedVersion !== record.row.state_version) {
    throw conflict("Stanje igre se u međuvremenu promijenilo.", "stale_version");
  }

  const players = await activePlayers(record.row.id);
  const result = transition(
    {
      state: record.state,
      currentIndex: record.row.current_index,
      totalQuestions: record.order.length,
      paused: record.row.paused_remaining_ms !== null,
    },
    action,
    { showLeaderboard: record.settings.showLeaderboard, playerCount: players.length },
  );
  if (!result.ok) throw conflict(result.error, "invalid_transition");

  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const patch: Parameters<typeof casUpdate>[1] = {
    state: result.next.state,
    current_index: result.next.currentIndex,
  };

  if (result.questionStarted) {
    const question = questionAt(record, result.next.currentIndex);
    if (!question) throw badRequest("Pitanje ne postoji.");
    const startsAt = now + QUESTION_LEAD_IN_MS;
    patch.question_started_at = iso(startsAt);
    patch.question_deadline = iso(startsAt + timeLimitSeconds(record, question) * 1000);
    patch.paused_remaining_ms = null;
    if (action === "start") patch.started_at = iso(now);
  } else if (action === "pause") {
    const deadline = record.row.question_deadline ? Date.parse(record.row.question_deadline) : now;
    patch.paused_remaining_ms = Math.max(0, deadline - now);
    patch.question_deadline = null;
  } else if (action === "resume") {
    const question = questionAt(record, record.row.current_index);
    const remaining = record.row.paused_remaining_ms ?? 0;
    const deadline = now + remaining;
    const limitMs = question ? timeLimitSeconds(record, question) * 1000 : remaining;
    patch.question_deadline = iso(deadline);
    // Shift the start so response times exclude the pause.
    patch.question_started_at = iso(Math.max(deadline - limitMs, now - limitMs));
    patch.paused_remaining_ms = null;
  } else if (action === "close_question") {
    patch.paused_remaining_ms = null;
  }

  if (result.next.state === "finished" || result.next.state === "cancelled") {
    patch.finished_at = iso(now);
    patch.question_deadline = null;
    patch.paused_remaining_ms = null;
  }

  if (action === "start" && teamsEnabled(record)) await balanceTeams(record.row.id, players);

  const updated = await casUpdate(record, patch);
  if (!updated) throw conflict("Stanje igre se u međuvremenu promijenilo.", "stale_version");

  const closedQuestion =
    record.state === "question_active" && updated.state !== "question_active" && updated.state !== "cancelled";
  if (closedQuestion) await finalizeCurrentQuestion(updated);

  if (updated.state === "finished" && updated.row.quiz_id) {
    await getAdminSupabase()
      .from("quizzes")
      .update({ last_played_at: new Date().toISOString() })
      .eq("id", updated.row.quiz_id);
  }

  let eventType = EVENT_FOR_ACTION[action];
  if (action === "next" && updated.state === "leaderboard") eventType = "leaderboard_updated";
  if (action === "next" && updated.state === "finished") eventType = "game_finished";
  if (action === "end" && updated.state === "cancelled") eventType = "game_cancelled";
  await publishGameEvent(updated.row.id, eventType, updated.row.state_version);
  if (closedQuestion) await publishGameEvent(updated.row.id, "results_published", updated.row.state_version);
  return updated;
}

/** Assigns players without a team to the smallest team, so nobody plays without one. */
async function balanceTeams(sessionId: string, players: { id: string; team_id: string | null }[]) {
  const teams = await teamsFor(sessionId);
  if (teams.length === 0) return;
  const counts = new Map(teams.map((t) => [t.id, players.filter((p) => p.team_id === t.id).length]));
  for (const player of players.filter((p) => !p.team_id || !counts.has(p.team_id))) {
    const smallest = [...counts.entries()].sort((a, b) => a[1] - b[1])[0];
    if (!smallest) return;
    const [teamId, count] = smallest;
    counts.set(teamId, count + 1);
    const { error } = await getAdminSupabase().from("game_players").update({ team_id: teamId }).eq("id", player.id);
    if (error) throw error;
  }
}

export function toGradedAnswers(
  answers: { player_id: string; answer: Json; status: string; fraction: number; points: number }[],
  nicknames: Map<string, string>,
): GradedAnswer[] {
  return answers.map((a) => ({
    playerId: a.player_id,
    nickname: nicknames.get(a.player_id) ?? "?",
    answer: a.answer as unknown as InternalAnswer,
    status: a.status as EvaluationStatus,
    fraction: a.fraction,
    points: a.points,
  }));
}

/**
 * Freezes the results of the question that just closed: stores statistics, remembers ranks
 * from before the question and recalculates totals. Safe to call repeatedly.
 */
export async function finalizeCurrentQuestion(record: SessionRecord): Promise<void> {
  const index = record.row.current_index;
  const question = questionAt(record, index);
  if (!question) return;

  const players = await activePlayers(record.row.id);
  const previousRanks = rankPlayers(
    players.map((p) => ({
      id: p.id,
      score: p.score,
      correctCount: p.correct_count,
      totalResponseMs: p.total_response_ms,
      joinedAt: p.joined_at,
    })),
  ).map((p) => ({ id: p.id, rank: p.rank }));

  const nicknames = new Map(players.map((p) => [p.id, p.nickname]));
  const answers = (await answersFor(record.row.id, index)).filter((a) => nicknames.has(a.player_id));
  const stats = buildQuestionStats(question, toGradedAnswers(answers, nicknames), record.row.seed);

  // Before the first question everyone is tied, so there is no meaningful "previous rank".
  const { error } = await getAdminSupabase().rpc("finalize_question", {
    p_session_id: record.row.id,
    p_question_index: index,
    p_question_key: question.id,
    p_stats: stats as unknown as NonNullable<Json>,
    p_previous_ranks: (index === 0 ? [] : previousRanks) as unknown as NonNullable<Json>,
  });
  if (error) throw error;
}

/** Recomputes statistics for the current question after a host review decision. */
export async function refreshCurrentStats(record: SessionRecord): Promise<void> {
  const index = record.row.current_index;
  const question = questionAt(record, index);
  if (!question) return;
  const players = await activePlayers(record.row.id);
  const nicknames = new Map(players.map((p) => [p.id, p.nickname]));
  const answers = (await answersFor(record.row.id, index)).filter((a) => nicknames.has(a.player_id));
  const stats = buildQuestionStats(question, toGradedAnswers(answers, nicknames), record.row.seed);
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("game_question_results")
    .update({ stats: stats as unknown as NonNullable<Json> })
    .eq("session_id", record.row.id)
    .eq("question_index", index);
  if (error) throw error;
  const { error: recalcError } = await admin.rpc("recalculate_scores", { p_session_id: record.row.id });
  if (recalcError) throw recalcError;
}

/**
 * Lazy, idempotent housekeeping run on every state read:
 *  1. closes a timed-out question (no dedicated timer server needed),
 *  2. repairs a question that was closed but never finalised (e.g. a crashed request).
 * Returns the (possibly) updated record.
 */
export async function reconcile(record: SessionRecord): Promise<SessionRecord> {
  const now = Date.now();
  if (
    record.state === "question_active" &&
    !manualPacing(record) &&
    record.row.paused_remaining_ms === null &&
    record.row.question_deadline &&
    now > Date.parse(record.row.question_deadline) + SUBMISSION_GRACE_MS
  ) {
    try {
      return await applyAction(record, "close_question", record.row.state_version);
    } catch (error) {
      // Someone else closed it first — reload the winner's state.
      if (!(error instanceof ApiError && error.status === 409)) throw error;
      return loadSession(record.row.id);
    }
  }

  if (
    record.row.current_index >= 0 &&
    (record.state === "question_revealing" || record.state === "leaderboard" || record.state === "finished")
  ) {
    const { data } = await getAdminSupabase()
      .from("game_question_results")
      .select("id")
      .eq("session_id", record.row.id)
      .eq("question_index", record.row.current_index)
      .maybeSingle();
    if (!data) await finalizeCurrentQuestion(record);
  }
  return record;
}

/** Closes the question early once every active player has answered (auto-paced modes only). */
export async function closeIfEveryoneAnswered(record: SessionRecord): Promise<void> {
  if (manualPacing(record) || record.state !== "question_active") return;
  const players = await activePlayers(record.row.id);
  if (players.length === 0) return;
  const ids = new Set(players.map((p) => p.id));
  const answered = (await answersFor(record.row.id, record.row.current_index)).filter((a) => ids.has(a.player_id));
  if (answered.length < players.length) return;
  try {
    await applyAction(record, "close_question", record.row.state_version);
  } catch (error) {
    // A concurrent request already closed it.
    if (!(error instanceof ApiError && error.status === 409)) throw error;
  }
}
