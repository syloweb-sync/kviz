/**
 * Explicit, pure game state machine. The server applies these transitions inside a
 * compare-and-swap update on `game_sessions.state_version`, so a double click or two
 * concurrent requests can never advance the same question twice.
 *
 *   lobby ──start──▶ question_active ──close──▶ question_revealing ──next──▶ leaderboard ──next──▶ question_active …
 *                         │  ▲                         │ (last question, or leaderboard disabled)
 *                    pause│  │resume                   └──next──▶ finished / question_active
 *
 *   end:    lobby → cancelled, any running state → finished
 *   cancel: any non-terminal state → cancelled
 */

export const GAME_STATES = [
  "lobby",
  "question_active",
  "question_revealing",
  "leaderboard",
  "finished",
  "cancelled",
] as const;
export type GameState = (typeof GAME_STATES)[number];

export const HOST_ACTIONS = ["start", "close_question", "next", "pause", "resume", "end", "cancel"] as const;
export type HostAction = (typeof HOST_ACTIONS)[number];

export interface MachineSnapshot {
  state: GameState;
  /** -1 while in the lobby. */
  currentIndex: number;
  totalQuestions: number;
  paused: boolean;
}

export interface TransitionContext {
  showLeaderboard: boolean;
  playerCount: number;
}

export type TransitionResult =
  | { ok: true; next: MachineSnapshot; questionStarted: boolean }
  | { ok: false; error: string };

export function isTerminal(state: GameState): boolean {
  return state === "finished" || state === "cancelled";
}

const fail = (error: string): TransitionResult => ({ ok: false, error });

function startQuestion(s: MachineSnapshot, index: number): TransitionResult {
  return { ok: true, questionStarted: true, next: { ...s, state: "question_active", currentIndex: index, paused: false } };
}

export function transition(s: MachineSnapshot, action: HostAction, ctx: TransitionContext): TransitionResult {
  if (isTerminal(s.state)) return fail("Igra je već završena.");
  const isLast = s.currentIndex >= s.totalQuestions - 1;

  switch (action) {
    case "start":
      if (s.state !== "lobby") return fail("Igra je već pokrenuta.");
      if (s.totalQuestions < 1) return fail("Kviz nema pitanja.");
      if (ctx.playerCount < 1) return fail("Pričekajte da se pridruži barem jedan igrač.");
      return startQuestion(s, 0);

    case "close_question":
      if (s.state !== "question_active") return fail("Nijedno pitanje nije aktivno.");
      return { ok: true, questionStarted: false, next: { ...s, state: "question_revealing", paused: false } };

    case "next":
      if (s.state === "question_revealing") {
        if (isLast) return { ok: true, questionStarted: false, next: { ...s, state: "finished", paused: false } };
        if (ctx.showLeaderboard) return { ok: true, questionStarted: false, next: { ...s, state: "leaderboard" } };
        return startQuestion(s, s.currentIndex + 1);
      }
      if (s.state === "leaderboard") {
        if (isLast) return { ok: true, questionStarted: false, next: { ...s, state: "finished" } };
        return startQuestion(s, s.currentIndex + 1);
      }
      if (s.state === "question_active") return fail("Najprije zatvorite trenutačno pitanje.");
      return fail("Igra još nije pokrenuta.");

    case "pause":
      if (s.state !== "question_active") return fail("Pauzirati se može samo aktivno pitanje.");
      if (s.paused) return fail("Igra je već pauzirana.");
      return { ok: true, questionStarted: false, next: { ...s, paused: true } };

    case "resume":
      if (s.state !== "question_active" || !s.paused) return fail("Igra nije pauzirana.");
      return { ok: true, questionStarted: false, next: { ...s, paused: false } };

    case "end":
      if (s.state === "lobby") return { ok: true, questionStarted: false, next: { ...s, state: "cancelled", paused: false } };
      return { ok: true, questionStarted: false, next: { ...s, state: "finished", paused: false } };

    case "cancel":
      return { ok: true, questionStarted: false, next: { ...s, state: "cancelled", paused: false } };
  }
}

/** Whether a submission at `nowMs` is inside the authoritative window. */
export function isWithinDeadline(deadlineMs: number | null, nowMs: number, graceMs: number): boolean {
  if (deadlineMs === null) return false;
  return nowMs <= deadlineMs + graceMs;
}

/** Network grace added to the server deadline before submissions are rejected. */
export const SUBMISSION_GRACE_MS = 600;
