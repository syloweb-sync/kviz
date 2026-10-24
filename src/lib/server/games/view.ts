import "server-only";

import { toPublicAnswer, type InternalAnswer } from "@/lib/domain/answers";
import { toPublicQuestion, toRevealedAnswer } from "@/lib/domain/public-view";
import { rankPlayers, rankTeams } from "@/lib/domain/ranking";
import type { QuestionStats } from "@/lib/domain/results";
import type { EvaluationStatus } from "@/lib/domain/scoring";
import type { GameView, MyAnswerState, PlayerSummary, PublicGameSettings } from "@/lib/game/types";
import { getAdminSupabase } from "@/lib/supabase/server";
import {
  activePlayers,
  answersFor,
  manualPacing,
  questionAt,
  teamsEnabled,
  teamsFor,
  timeLimitSeconds,
  type PlayerRow,
  type SessionRecord,
} from "./session";

const PLAYER_LEADERBOARD_SIZE = 10;

function publicSettings(record: SessionRecord): PublicGameSettings {
  const s = record.settings;
  return {
    basePoints: s.basePoints,
    speedBonus: s.speedBonus,
    showLeaderboard: s.showLeaderboard,
    showCorrectAnswers: s.showCorrectAnswers,
    showExplanations: s.showExplanations,
    allowLateJoin: s.allowLateJoin,
    allowAnswerChange: s.allowAnswerChange,
    soundEffects: s.soundEffects,
    music: s.music,
    reducedMotion: s.reducedMotion,
  };
}

const ms = (value: string | null) => (value ? Date.parse(value) : null);

export async function buildGameView(
  record: SessionRecord,
  viewer: { role: "host" } | { role: "player"; player: PlayerRow },
): Promise<GameView> {
  const { row } = record;
  const index = row.current_index;
  const question = index >= 0 ? questionAt(record, index) : null;
  const questionVisible =
    question !== null &&
    (record.state === "question_active" || record.state === "question_revealing" || record.state === "leaderboard");
  const revealed =
    question !== null &&
    (record.state === "question_revealing" || record.state === "leaderboard" || record.state === "finished");

  const [players, teams, answers, resultRow] = await Promise.all([
    activePlayers(row.id),
    teamsEnabled(record) ? teamsFor(row.id) : Promise.resolve([]),
    index >= 0 ? answersFor(row.id, index) : Promise.resolve([]),
    revealed
      ? getAdminSupabase()
          .from("game_question_results")
          .select("stats")
          .eq("session_id", row.id)
          .eq("question_index", index)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error;
            return data;
          })
      : Promise.resolve(null),
  ]);

  const activeIds = new Set(players.map((p) => p.id));
  const currentAnswers = answers.filter((a) => activeIds.has(a.player_id));
  const answerByPlayer = new Map(currentAnswers.map((a) => [a.player_id, a]));

  const ranked = rankPlayers(
    players.map((p) => ({
      id: p.id,
      score: p.score,
      correctCount: p.correct_count,
      totalResponseMs: p.total_response_ms,
      joinedAt: p.joined_at,
      nickname: p.nickname,
      teamId: p.team_id,
      previousRank: p.previous_rank,
      answeredCount: p.answered_count,
    })),
  );

  const summaries: PlayerSummary[] = ranked.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    teamId: p.teamId,
    score: p.score,
    rank: p.rank,
    previousRank: p.previousRank,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
    lastPoints: revealed ? (answerByPlayer.get(p.id)?.points ?? 0) : null,
  }));

  const teamStandings = teamsEnabled(record)
    ? rankTeams(
        teams.map((t) => ({ id: t.id, name: t.name, color: t.color, position: t.position })),
        players.map((p) => ({ teamId: p.team_id, score: p.score })),
      )
    : [];

  const publicQuestion =
    questionVisible && question
      ? toPublicQuestion(question, {
          seed: row.seed,
          randomizeAnswers: record.settings.randomizeAnswers,
          timeLimit: timeLimitSeconds(record, question),
        })
      : null;

  const reveal =
    revealed && question
      ? {
          answer: record.settings.showCorrectAnswers ? toRevealedAnswer(question, row.seed) : null,
          stats: (resultRow?.stats as unknown as QuestionStats | undefined) ?? null,
          explanation:
            record.settings.showExplanations && question.explanation.trim() ? question.explanation.trim() : null,
        }
      : null;

  let me: GameView["me"] = null;
  if (viewer.role === "player") {
    const summary = summaries.find((p) => p.id === viewer.player.id);
    const own = answerByPlayer.get(viewer.player.id);
    const showResult = revealed || (question?.feedback === "immediate" && Boolean(own));
    const currentAnswer: MyAnswerState = {
      submitted: Boolean(own),
      answer: own ? toPublicAnswer(own.answer as unknown as InternalAnswer, row.seed) : null,
      status: own && showResult ? (own.status as EvaluationStatus) : null,
      points: own && showResult ? own.points : null,
    };
    if (summary) me = { ...summary, currentAnswer };
  }

  const visiblePlayers =
    viewer.role === "host"
      ? summaries
      : summaries.filter((p, i) => i < PLAYER_LEADERBOARD_SIZE || p.id === (viewer.role === "player" ? viewer.player.id : ""));

  const pendingReviews =
    viewer.role === "host" && revealed
      ? currentAnswers
          .filter((a) => a.status === "pending_review")
          .map((a) => {
            const answer = a.answer as unknown as InternalAnswer;
            return {
              answerId: a.id,
              nickname: players.find((p) => p.id === a.player_id)?.nickname ?? "?",
              text: answer.type === "short_answer" ? answer.text : "",
            };
          })
      : [];

  return {
    role: viewer.role,
    session: {
      id: row.id,
      pin: viewer.role === "host" || record.state === "lobby" ? row.pin : null,
      state: record.state,
      version: row.state_version,
      mode: record.mode,
      quizTitle: row.quiz_title,
      currentIndex: index,
      totalQuestions: record.order.length,
      questionStartsAt: ms(row.question_started_at),
      deadline: ms(row.question_deadline),
      pausedRemainingMs: row.paused_remaining_ms,
      serverNow: Date.now(),
      settings: publicSettings(record),
      teamsEnabled: teamsEnabled(record),
      manualPacing: manualPacing(record),
    },
    players: visiblePlayers,
    playerCount: players.length,
    teams: teamStandings,
    question: publicQuestion,
    answeredCount: currentAnswers.length,
    reveal,
    me,
    host: viewer.role === "host" ? { pendingReviews } : null,
  };
}
