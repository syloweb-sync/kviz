import "server-only";

import { z } from "zod";
import { AnswerError, resolveAnswer } from "@/lib/domain/answers";
import { checkNickname } from "@/lib/domain/nickname";
import { pointsMultiplier } from "@/lib/domain/question-defaults";
import { toRevealedAnswer } from "@/lib/domain/public-view";
import { randomToken, shuffle } from "@/lib/domain/random";
import {
  DEFAULT_GAME_SETTINGS,
  gameSettingsSchema,
  questionSchema,
  type CreateGameInput,
  type GameMode,
  type GameSettings,
  type Question,
} from "@/lib/domain/schema";
import { computePoints, evaluateAnswer } from "@/lib/domain/scoring";
import { HOST_ACTIONS, SUBMISSION_GRACE_MS, isTerminal, type HostAction } from "@/lib/domain/state-machine";
import { validateQuizForPlay, type ValidationIssue } from "@/lib/domain/validation";
import type { GameView, SubmitAnswerResult } from "@/lib/game/types";
import type { Json } from "@/lib/supabase/database.types";
import { getAdminSupabase } from "@/lib/supabase/server";
import { generatePin, sha256 } from "../crypto";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../http";
import { applyAction, closeIfEveryoneAnswered, reconcile, refreshCurrentStats } from "./lifecycle";
import { publishGameEvent } from "./realtime";
import {
  activePlayers,
  authenticatePlayer,
  loadSession,
  questionAt,
  timeLimitSeconds,
  type PlayerRow,
  type SessionRecord,
} from "./session";
import { buildGameView } from "./view";

export const TEAM_COLORS = ["coral", "cyan", "sun", "mint"] as const;
const PIN_TTL_MS = 12 * 60 * 60 * 1000;

export type Actor = { kind: "host"; userId: string } | { kind: "player"; token: string | null };

// ---------------------------------------------------------------------------
// Creating games
// ---------------------------------------------------------------------------

export class QuizNotPlayableError extends ApiError {
  constructor(public readonly issues: ValidationIssue[]) {
    super(422, "quiz_not_playable", "Kviz još nije spreman za igru.");
  }
}

/** Loads a quiz and its questions, re-validating every stored question. */
export async function loadQuizForPlay(quizId: string) {
  const admin = getAdminSupabase();
  const { data: quiz, error } = await admin.from("quizzes").select("*").eq("id", quizId).maybeSingle();
  if (error) throw error;
  if (!quiz) throw notFound("Kviz ne postoji.");
  const { data: rows, error: qError } = await admin
    .from("quiz_questions")
    .select("data, position")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  if (qError) throw qError;

  const questions: Question[] = [];
  for (const row of rows) {
    const parsed = questionSchema.safeParse(row.data);
    if (!parsed.success) {
      throw new QuizNotPlayableError([
        { questionIndex: row.position, questionId: null, message: "Pitanje je oštećeno — otvorite ga u uređivaču i spremite ponovno." },
      ]);
    }
    questions.push(parsed.data);
  }
  const issues = validateQuizForPlay({ title: quiz.title, questions });
  if (issues.length) throw new QuizNotPlayableError(issues);
  return { quiz, questions };
}

async function insertSession(values: {
  quizId: string;
  hostId: string | null;
  mode: GameMode;
  settings: GameSettings;
  title: string;
  questions: Question[];
  withPin: boolean;
}): Promise<SessionRecord> {
  const seed = randomToken(16);
  const indexes = values.questions.map((_, i) => i);
  const order = values.settings.randomizeQuestions ? shuffle(indexes, `${seed}:order`) : indexes;
  const admin = getAdminSupabase();

  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await admin
      .from("game_sessions")
      .insert({
        quiz_id: values.quizId,
        host_id: values.hostId,
        pin: values.withPin ? generatePin() : null,
        pin_expires_at: values.withPin ? new Date(Date.now() + PIN_TTL_MS).toISOString() : null,
        mode: values.mode,
        settings: values.settings as unknown as NonNullable<Json>,
        quiz_title: values.title,
        quiz_snapshot: { title: values.title, questions: values.questions } as unknown as NonNullable<Json>,
        question_order: order,
        seed,
      })
      .select("*")
      .single();
    if (!error) return loadSession(data.id);
    // 23505 = unique violation on the active-PIN index: try another PIN.
    if (error.code !== "23505") throw error;
  }
  throw new ApiError(503, "pin_exhausted", "Trenutačno nije moguće stvoriti PIN. Pokušajte ponovno.");
}

export async function createGame(userId: string, input: CreateGameInput) {
  if (input.mode === "practice") throw badRequest("Za vježbu koristite način vježbanja.");
  const { quiz, questions } = await loadQuizForPlay(input.quizId);
  if (quiz.owner_id !== userId) throw forbidden("Možete pokrenuti samo vlastite kvizove.");

  const settings = gameSettingsSchema.parse({ ...DEFAULT_GAME_SETTINGS, ...input.settings });
  const record = await insertSession({
    quizId: quiz.id,
    hostId: userId,
    mode: input.mode,
    settings,
    title: quiz.title,
    questions,
    withPin: true,
  });

  if (input.mode === "team") {
    const { error } = await getAdminSupabase()
      .from("game_teams")
      .insert(
        settings.teamNames.map((name, position) => ({
          session_id: record.row.id,
          name,
          color: TEAM_COLORS[position] ?? "violet",
          position,
        })),
      );
    if (error) throw error;
  }
  await publishGameEvent(record.row.id, "lobby_updated", record.row.state_version);
  return { sessionId: record.row.id, pin: record.row.pin };
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

export async function lookupPin(pin: string) {
  if (!/^[0-9]{6}$/.test(pin)) throw badRequest("PIN ima 6 znamenki.");
  const { data, error } = await getAdminSupabase()
    .from("game_sessions")
    .select("id, quiz_title, state, mode, settings, pin_expires_at")
    .eq("pin", pin)
    .not("state", "in", "(finished,cancelled)")
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.pin_expires_at || Date.parse(data.pin_expires_at) < Date.now()) {
    throw notFound("Igra s tim PIN-om ne postoji ili je završila.");
  }
  const settings = gameSettingsSchema.parse(data.settings);
  const accepting = data.state === "lobby" || settings.allowLateJoin;
  if (!accepting) throw conflict("Igra je već počela i ne prima nove igrače.", "late_join_disabled");
  const teams =
    data.mode === "team"
      ? (
          await getAdminSupabase()
            .from("game_teams")
            .select("id, name, color, position")
            .eq("session_id", data.id)
            .order("position")
        ).data ?? []
      : [];
  return { sessionId: data.id, quizTitle: data.quiz_title, state: data.state, teams };
}

const nicknameKey = (nickname: string) => nickname.toLocaleLowerCase("hr");

export async function joinGame(sessionId: string, input: { nickname: string; teamId?: string | null }) {
  const record = await loadSession(sessionId);
  if (record.mode === "practice") throw forbidden("U vježbu se ne može pridružiti.");
  if (isTerminal(record.state)) throw conflict("Igra je završila.", "game_over");
  if (!record.row.pin_expires_at || Date.parse(record.row.pin_expires_at) < Date.now()) {
    throw conflict("PIN je istekao.", "pin_expired");
  }
  if (record.state !== "lobby" && !record.settings.allowLateJoin) {
    throw conflict("Igra je već počela i ne prima nove igrače.", "late_join_disabled");
  }

  const check = checkNickname(input.nickname, { filter: record.settings.nicknameFilter });
  if (!check.ok) throw badRequest(check.error, "invalid_nickname");

  const players = await activePlayers(sessionId);
  if (players.length >= record.settings.maxPlayers) throw conflict("Igra je popunjena.", "game_full");

  let teamId: string | null = null;
  if (record.mode === "team" && input.teamId) {
    const { data } = await getAdminSupabase()
      .from("game_teams")
      .select("id")
      .eq("session_id", sessionId)
      .eq("id", input.teamId)
      .maybeSingle();
    if (!data) throw badRequest("Tim ne postoji.");
    teamId = data.id;
  }
  if (record.mode === "team" && !teamId && record.state !== "lobby") {
    // Late joiner in team mode: put them in the smallest team straight away.
    const { data: teams } = await getAdminSupabase().from("game_teams").select("id").eq("session_id", sessionId);
    const counts = (teams ?? []).map((t) => ({ id: t.id, n: players.filter((p) => p.team_id === t.id).length }));
    teamId = counts.sort((a, b) => a.n - b.n)[0]?.id ?? null;
  }

  const token = randomToken(32);
  const { data, error } = await getAdminSupabase()
    .from("game_players")
    .insert({
      session_id: sessionId,
      nickname: check.nickname,
      nickname_key: nicknameKey(check.nickname),
      token_hash: sha256(token),
      team_id: teamId,
    })
    .select("id, nickname")
    .single();
  if (error) {
    if (error.code === "23505") throw conflict("Taj je nadimak zauzet. Odaberite drugi.", "nickname_taken");
    throw error;
  }
  await publishGameEvent(sessionId, "player_joined", record.row.state_version);
  return { playerId: data.id, nickname: data.nickname, token };
}

// ---------------------------------------------------------------------------
// Reading state
// ---------------------------------------------------------------------------

async function touchPlayer(player: PlayerRow) {
  if (Date.now() - Date.parse(player.last_seen_at) < 20_000) return;
  await getAdminSupabase().from("game_players").update({ last_seen_at: new Date().toISOString() }).eq("id", player.id);
}

export async function getHostView(sessionId: string, userId: string): Promise<GameView> {
  let record = await loadSession(sessionId);
  if (record.row.host_id !== userId || record.mode === "practice") throw forbidden("Ovo nije vaša igra.");
  record = await reconcile(record);
  return buildGameView(record, { role: "host" });
}

export async function getPlayerView(sessionId: string, token: string | null): Promise<GameView> {
  let record = await loadSession(sessionId);
  const player = await authenticatePlayer(sessionId, token);
  record = await reconcile(record);
  await touchPlayer(player);
  return buildGameView(record, { role: "player", player });
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export const submitAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  answer: z.unknown(),
});

export async function submitAnswer(
  sessionId: string,
  token: string | null,
  input: z.infer<typeof submitAnswerSchema>,
): Promise<SubmitAnswerResult> {
  const record = await loadSession(sessionId);
  const player = await authenticatePlayer(sessionId, token);
  const now = Date.now();

  if (record.state !== "question_active" || record.row.current_index !== input.questionIndex) {
    throw conflict("Pitanje je zatvoreno.", "question_closed");
  }
  if (record.row.paused_remaining_ms !== null) throw conflict("Igra je pauzirana.", "paused");
  const startsAt = record.row.question_started_at ? Date.parse(record.row.question_started_at) : null;
  const deadline = record.row.question_deadline ? Date.parse(record.row.question_deadline) : null;
  if (startsAt === null || deadline === null) throw conflict("Pitanje nije aktivno.", "question_closed");
  if (now < startsAt - 250) throw conflict("Pitanje još nije počelo.", "not_started");
  if (now > deadline + SUBMISSION_GRACE_MS) throw conflict("Vrijeme je isteklo.", "deadline_passed");

  const question = questionAt(record, input.questionIndex);
  if (!question) throw notFound("Pitanje ne postoji.");

  let internal;
  try {
    internal = resolveAnswer(question, input.answer, record.row.seed);
  } catch (error) {
    if (error instanceof AnswerError) throw badRequest(error.message, "invalid_answer");
    throw error;
  }

  const evaluation = evaluateAnswer(question, internal);
  const limitMs = timeLimitSeconds(record, question) * 1000;
  const responseMs = Math.min(limitMs, Math.max(0, now - startsAt));
  const points =
    evaluation.status === "pending_review"
      ? 0
      : computePoints({
          fraction: evaluation.fraction,
          multiplier: pointsMultiplier(question),
          basePoints: record.settings.basePoints,
          speedBonus: record.settings.speedBonus,
          responseMs,
          timeLimitMs: limitMs,
        }).total;

  const allowChange = record.settings.allowAnswerChange && question.feedback !== "immediate";
  const { data: outcome, error } = await getAdminSupabase().rpc("submit_answer", {
    p_session_id: sessionId,
    p_player_id: player.id,
    p_question_index: input.questionIndex,
    p_question_key: question.id,
    p_answer: internal as unknown as NonNullable<Json>,
    p_status: evaluation.status,
    p_fraction: evaluation.fraction,
    p_points: points,
    p_response_ms: responseMs,
    p_allow_change: allowChange,
  });
  if (error) throw error;
  if (outcome === "duplicate") throw conflict("Već ste odgovorili na ovo pitanje.", "duplicate");
  if (outcome === "closed" || outcome === "not_found") throw conflict("Pitanje je zatvoreno.", "question_closed");
  if (outcome === "paused") throw conflict("Igra je pauzirana.", "paused");

  await publishGameEvent(sessionId, "answer_submitted", record.row.state_version);
  await closeIfEveryoneAnswered(record);

  return {
    status: outcome === "updated" ? "updated" : "accepted",
    feedback:
      question.feedback === "immediate"
        ? {
            status: evaluation.status,
            points,
            correctAnswer: record.settings.showCorrectAnswers ? toRevealedAnswer(question, record.row.seed) : null,
            explanation:
              record.settings.showExplanations && question.explanation.trim() ? question.explanation.trim() : null,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Host controls
// ---------------------------------------------------------------------------

export const hostActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(HOST_ACTIONS), expectedVersion: z.number().int().nullable().default(null) }),
  z.object({ action: z.literal("kick"), playerId: z.uuid() }),
  z.object({ action: z.literal("assign_team"), playerId: z.uuid(), teamId: z.uuid().nullable() }),
  z.object({ action: z.literal("review"), answerId: z.uuid(), accept: z.boolean() }),
]);
export type HostActionInput = z.infer<typeof hostActionSchema>;

async function authorizeController(record: SessionRecord, actor: Actor): Promise<void> {
  if (actor.kind === "host") {
    if (record.mode === "practice" || record.row.host_id !== actor.userId) throw forbidden("Ovo nije vaša igra.");
    return;
  }
  if (record.mode !== "practice") throw forbidden("Samo domaćin upravlja igrom.");
  await authenticatePlayer(record.row.id, actor.token);
}

export async function performAction(sessionId: string, actor: Actor, input: HostActionInput) {
  const record = await loadSession(sessionId);
  await authorizeController(record, actor);
  const admin = getAdminSupabase();

  switch (input.action) {
    case "kick": {
      if (actor.kind !== "host") throw forbidden();
      const { error } = await admin
        .from("game_players")
        .update({ kicked: true })
        .eq("session_id", sessionId)
        .eq("id", input.playerId);
      if (error) throw error;
      await publishGameEvent(sessionId, "player_left", record.row.state_version);
      if (record.state === "question_active") await closeIfEveryoneAnswered(record);
      return { ok: true };
    }
    case "assign_team": {
      if (actor.kind !== "host") throw forbidden();
      if (record.state !== "lobby") throw conflict("Timovi se mogu mijenjati samo prije početka igre.", "teams_locked");
      if (input.teamId) {
        const { data } = await admin.from("game_teams").select("id").eq("session_id", sessionId).eq("id", input.teamId).maybeSingle();
        if (!data) throw badRequest("Tim ne postoji.");
      }
      const { error } = await admin
        .from("game_players")
        .update({ team_id: input.teamId })
        .eq("session_id", sessionId)
        .eq("id", input.playerId);
      if (error) throw error;
      await publishGameEvent(sessionId, "lobby_updated", record.row.state_version);
      return { ok: true };
    }
    case "review": {
      if (actor.kind !== "host") throw forbidden();
      if (record.state !== "question_revealing" && record.state !== "leaderboard") {
        throw conflict("Odgovori se mogu pregledati dok su rezultati pitanja prikazani.", "review_closed");
      }
      const question = questionAt(record, record.row.current_index);
      if (!question) throw notFound();
      const { data: answer, error } = await admin
        .from("game_answers")
        .select("*")
        .eq("id", input.answerId)
        .eq("session_id", sessionId)
        .eq("question_index", record.row.current_index)
        .maybeSingle();
      if (error) throw error;
      if (!answer) throw notFound("Odgovor ne postoji.");
      if (answer.status !== "pending_review") throw conflict("Odgovor je već pregledan.", "already_reviewed");

      const limitMs = timeLimitSeconds(record, question) * 1000;
      const points = input.accept
        ? computePoints({
            fraction: 1,
            multiplier: pointsMultiplier(question),
            basePoints: record.settings.basePoints,
            speedBonus: record.settings.speedBonus,
            responseMs: answer.response_ms,
            timeLimitMs: limitMs,
          }).total
        : 0;
      const { error: updateError } = await admin
        .from("game_answers")
        .update({ status: input.accept ? "correct" : "incorrect", fraction: input.accept ? 1 : 0, points })
        .eq("id", answer.id)
        .eq("status", "pending_review");
      if (updateError) throw updateError;
      await refreshCurrentStats(record);
      await publishGameEvent(sessionId, "results_published", record.row.state_version);
      return { ok: true };
    }
    default: {
      const updated = await applyAction(record, input.action as HostAction, input.expectedVersion);
      return { ok: true, version: updated.row.state_version, state: updated.state };
    }
  }
}

export async function changeOwnTeam(sessionId: string, token: string | null, teamId: string) {
  const record = await loadSession(sessionId);
  const player = await authenticatePlayer(sessionId, token);
  if (record.mode !== "team") throw badRequest("Ova igra nema timove.");
  if (record.state !== "lobby") throw conflict("Tim se ne može mijenjati nakon početka igre.", "teams_locked");
  const admin = getAdminSupabase();
  const { data } = await admin.from("game_teams").select("id").eq("session_id", sessionId).eq("id", teamId).maybeSingle();
  if (!data) throw badRequest("Tim ne postoji.");
  const { error } = await admin.from("game_players").update({ team_id: teamId }).eq("id", player.id);
  if (error) throw error;
  await publishGameEvent(sessionId, "lobby_updated", record.row.state_version);
  return { ok: true };
}

export async function leaveGame(sessionId: string, token: string | null) {
  const record = await loadSession(sessionId);
  const player = await authenticatePlayer(sessionId, token);
  const { error } = await getAdminSupabase().from("game_players").update({ kicked: true }).eq("id", player.id);
  if (error) throw error;
  await publishGameEvent(sessionId, "player_left", record.row.state_version);
  if (record.state === "question_active") await closeIfEveryoneAnswered(record);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Practice mode — a solo session where the player controls the pace
// ---------------------------------------------------------------------------

export async function createPractice(quizId: string, user: { id: string; nickname: string } | null) {
  const { quiz, questions } = await loadQuizForPlay(quizId);
  const isOwner = user !== null && quiz.owner_id === user.id;
  if (!isOwner && !quiz.practice_shared) throw forbidden("Ovaj kviz nije podijeljen za vježbu.");

  const settings = gameSettingsSchema.parse({
    ...DEFAULT_GAME_SETTINGS,
    allowLateJoin: false,
    showLeaderboard: false,
    music: false,
  });
  const record = await insertSession({
    quizId: quiz.id,
    hostId: user?.id ?? null,
    mode: "practice",
    settings,
    title: quiz.title,
    questions,
    withPin: false,
  });

  const token = randomToken(32);
  const nickname = (user?.nickname || "Igrač").slice(0, 20);
  const { data: player, error } = await getAdminSupabase()
    .from("game_players")
    .insert({
      session_id: record.row.id,
      nickname: nickname.length >= 1 ? nickname : "Igrač",
      nickname_key: nicknameKey(nickname),
      token_hash: sha256(token),
      user_id: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await applyAction(record, "start", record.row.state_version);
  return { sessionId: record.row.id, playerId: player.id, token };
}
