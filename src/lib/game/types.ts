import type { PublicQuestion, RevealedAnswer } from "@/lib/domain/public-view";
import type { QuestionStats } from "@/lib/domain/results";
import type { GameMode } from "@/lib/domain/schema";
import type { EvaluationStatus } from "@/lib/domain/scoring";
import type { GameState } from "@/lib/domain/state-machine";
import type { TeamStanding } from "@/lib/domain/ranking";

/**
 * Snapshot of a game as seen by one participant. The server builds a separate view for the
 * host and for each player; neither contains correct answers before the question closes.
 */

export interface PublicGameSettings {
  basePoints: number;
  speedBonus: boolean;
  showLeaderboard: boolean;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  allowLateJoin: boolean;
  allowAnswerChange: boolean;
  soundEffects: boolean;
  music: boolean;
  reducedMotion: boolean;
}

export interface PlayerSummary {
  id: string;
  nickname: string;
  teamId: string | null;
  score: number;
  rank: number;
  previousRank: number | null;
  correctCount: number;
  answeredCount: number;
  /** Points earned on the current question (only after it closed). */
  lastPoints: number | null;
}

export interface MyAnswerState {
  submitted: boolean;
  /** Echo of the submitted payload (public IDs), so the UI can be restored after a reload. */
  answer: Record<string, unknown> | null;
  /** Only present once the result may be shown (immediate feedback or after the reveal). */
  status: EvaluationStatus | null;
  points: number | null;
}

export interface GameView {
  role: "host" | "player";
  session: {
    id: string;
    pin: string | null;
    state: GameState;
    version: number;
    mode: GameMode;
    quizTitle: string;
    currentIndex: number;
    totalQuestions: number;
    /** Epoch ms. Answers are accepted from `questionStartsAt` until `deadline`. */
    questionStartsAt: number | null;
    deadline: number | null;
    pausedRemainingMs: number | null;
    serverNow: number;
    settings: PublicGameSettings;
    teamsEnabled: boolean;
    manualPacing: boolean;
  };
  players: PlayerSummary[];
  playerCount: number;
  teams: TeamStanding[];
  question: PublicQuestion | null;
  answeredCount: number;
  reveal: {
    answer: RevealedAnswer | null;
    stats: QuestionStats | null;
    explanation: string | null;
  } | null;
  me: (PlayerSummary & { currentAnswer: MyAnswerState }) | null;
  host: {
    pendingReviews: { answerId: string; nickname: string; text: string }[];
  } | null;
}

export type GameEventType =
  | "player_joined"
  | "player_left"
  | "lobby_updated"
  | "game_started"
  | "question_started"
  | "answer_submitted"
  | "question_ended"
  | "results_published"
  | "leaderboard_updated"
  | "game_paused"
  | "game_resumed"
  | "game_finished"
  | "game_cancelled";

/** Broadcast payload. Clients treat every event as "state changed — refetch if newer". */
export interface GameEvent {
  id: string;
  type: GameEventType;
  sessionId: string;
  version: number;
  at: number;
}

export interface SubmitAnswerResult {
  status: "accepted" | "updated";
  /** Present only when the question uses immediate feedback. */
  feedback: {
    status: EvaluationStatus;
    points: number;
    correctAnswer: RevealedAnswer | null;
    explanation: string | null;
  } | null;
}

export const channelName = (sessionId: string) => `game:${sessionId}`;
