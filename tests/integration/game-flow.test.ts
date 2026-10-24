import { beforeAll, describe, expect, it } from "vitest";
import type { QuizDocument } from "@/lib/domain/schema";
import { ApiError } from "@/lib/server/http";
import {
  createGame,
  createPractice,
  getHostView,
  getPlayerView,
  joinGame,
  lookupPin,
  performAction,
  submitAnswer,
} from "@/lib/server/games/service";
import { createQuiz, loadQuizDocument, saveQuizDocument } from "@/lib/server/quizzes";
import { getAdminSupabase } from "@/lib/supabase/server";
import { correctPayload, wrongPayload } from "../support/answers";
import * as f from "../unit/fixtures";
import { anonClient, createUser, expireCurrentQuestion, openCurrentQuestion, sessionRow, type Client } from "./helpers";

function document(questions = f.allQuestionTypes()): QuizDocument {
  return { title: "Integracijski kviz", description: "", coverImage: null, category: "Test", tags: ["it"], questions };
}

async function expectApiError(promise: Promise<unknown>, status: number, code?: string) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    if (code) expect((error as ApiError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ApiError ${status}`);
}

let host: { id: string; client: Client };
let other: { id: string; client: Client };
let quizId: string;
const doc = document();

beforeAll(async () => {
  host = await createUser("Domaćin");
  other = await createUser("Netko drugi");
  quizId = await createQuiz(host.client, host.id, doc);
});

describe("quiz persistence and authorisation", () => {
  it("persists every question type in order", async () => {
    const stored = await loadQuizDocument(host.client, quizId);
    expect(stored.document.questions.map((q) => q.type)).toEqual(doc.questions.map((q) => q.type));
    expect(stored.document.questions).toEqual(doc.questions);
    const { data } = await host.client.from("quizzes").select("is_playable, question_count").eq("id", quizId).single();
    expect(data).toEqual({ is_playable: true, question_count: 12 });
  });

  it("reorders and removes questions atomically", async () => {
    const reordered = document([...doc.questions].reverse().slice(0, 5));
    await saveQuizDocument(host.client, quizId, reordered);
    const stored = await loadQuizDocument(host.client, quizId);
    expect(stored.document.questions.map((q) => q.id)).toEqual(reordered.questions.map((q) => q.id));
    await saveQuizDocument(host.client, quizId, doc);
  });

  it("marks incomplete quizzes as not playable", async () => {
    const draftId = await createQuiz(host.client, host.id);
    const result = await saveQuizDocument(host.client, draftId, document([]));
    expect(result.issues.length).toBeGreaterThan(0);
    const { data } = await host.client.from("quizzes").select("is_playable").eq("id", draftId).single();
    expect(data?.is_playable).toBe(false);
  });

  it("hides quizzes from other users and blocks their writes", async () => {
    const { data: read } = await other.client.from("quizzes").select("id").eq("id", quizId);
    expect(read).toEqual([]);
    const { data: questions } = await other.client.from("quiz_questions").select("data").eq("quiz_id", quizId);
    expect(questions).toEqual([]);
    const { data: updated } = await other.client.from("quizzes").update({ title: "hacked" }).eq("id", quizId).select("id");
    expect(updated).toEqual([]);
    await expect(saveQuizDocument(other.client, quizId, document([]))).rejects.toMatchObject({ status: 404 });
    const { data: deleted } = await other.client.from("quizzes").delete().eq("id", quizId).select("id");
    expect(deleted).toEqual([]);
  });

  it("does not let users insert quizzes for someone else", async () => {
    const { error } = await other.client.from("quizzes").insert({ owner_id: host.id, title: "x" });
    expect(error).not.toBeNull();
  });

  it("gives anonymous clients no access to quizzes or games", async () => {
    const anon = anonClient();
    for (const table of ["quizzes", "quiz_questions", "game_sessions", "game_players", "game_answers"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
    const { error } = await anon.rpc("submit_answer", {
      p_session_id: quizId,
      p_player_id: quizId,
      p_question_index: 0,
      p_question_key: "x",
      p_answer: {},
      p_status: "correct",
      p_fraction: 1,
      p_points: 99999,
      p_response_ms: 0,
      p_allow_change: true,
    });
    expect(error).not.toBeNull();
  });

  it("only lets the owner start a game", async () => {
    await expectApiError(createGame(other.id, { quizId, mode: "classic", settings: {} }), 403);
  });

  it("refuses to start a quiz that is not playable", async () => {
    const draftId = await createQuiz(host.client, host.id, document([f.singleChoice(), createEmptyQuestion()]));
    await expectApiError(createGame(host.id, { quizId: draftId, mode: "classic", settings: {} }), 422, "quiz_not_playable");
  });
});

function createEmptyQuestion() {
  const q = f.singleChoice();
  q.config.correctOptionId = null;
  return q;
}

describe("a full classic game with two players and all question types", () => {
  let sessionId: string;
  let seed: string;
  let ana: { playerId: string; token: string };
  let ivo: { playerId: string; token: string };

  it("creates a game with a unique 6-digit PIN that players can look up", async () => {
    const game = await createGame(host.id, { quizId, mode: "classic", settings: { speedBonus: false } });
    expect(game.pin).toMatch(/^[1-9][0-9]{5}$/);
    sessionId = game.sessionId;
    seed = (await sessionRow(sessionId)).seed;
    const lookup = await lookupPin(game.pin!);
    expect(lookup.sessionId).toBe(sessionId);
    await expectApiError(lookupPin("000000"), 404);
  });

  it("lets guests join with unique nicknames", async () => {
    ana = await joinGame(sessionId, { nickname: "Ana" });
    ivo = await joinGame(sessionId, { nickname: "Ivo" });
    await expectApiError(joinGame(sessionId, { nickname: "ana" }), 409, "nickname_taken");
    await expectApiError(joinGame(sessionId, { nickname: "x" }), 400, "invalid_nickname");
    const view = await getHostView(sessionId, host.id);
    expect(view.session.state).toBe("lobby");
    expect(view.players.map((p) => p.nickname).sort()).toEqual(["Ana", "Ivo"]);
  });

  it("rejects unknown tokens and other hosts", async () => {
    await expectApiError(getPlayerView(sessionId, "f".repeat(64)), 401);
    await expectApiError(getHostView(sessionId, other.id), 403);
    await expectApiError(
      performAction(sessionId, { kind: "host", userId: other.id }, { action: "start", expectedVersion: null }),
      403,
    );
    await expectApiError(performAction(sessionId, { kind: "player", token: ana.token }, { action: "start", expectedVersion: null }), 403);
  });

  it("never sends answers to players while a question is open", async () => {
    const before = await sessionRow(sessionId);
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: before.state_version });
    const view = await getPlayerView(sessionId, ana.token);
    expect(view.session.state).toBe("question_active");
    expect(view.reveal).toBeNull();
    const json = JSON.stringify(view);
    expect(json).not.toContain("correctOptionId");
    expect(json).not.toContain(seed);
    expect(view.session.pin).toBeNull();
  });

  it("rejects a double advance with a stale version", async () => {
    const row = await sessionRow(sessionId);
    await expectApiError(
      performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: row.state_version - 1 }),
      409,
      "stale_version",
    );
  });

  it("rejects answers during the lead-in", async () => {
    const q = doc.questions[0]!;
    await expectApiError(submitAnswer(sessionId, ana.token, { questionIndex: 0, answer: correctPayload(q, seed) }), 409, "not_started");
  });

  it("plays every question: correct for Ana, wrong for Ivo", async () => {
    for (let index = 0; index < doc.questions.length; index++) {
      const question = doc.questions[index]!;
      await openCurrentQuestion(sessionId);

      const a = await submitAnswer(sessionId, ana.token, { questionIndex: index, answer: correctPayload(question, seed) });
      expect(a.status).toBe("accepted");
      await expectApiError(
        submitAnswer(sessionId, ana.token, { questionIndex: index, answer: correctPayload(question, seed) }),
        409,
        "duplicate",
      );
      const mid = await getPlayerView(sessionId, ana.token);
      expect(mid.me?.currentAnswer.submitted).toBe(true);
      expect(mid.me?.currentAnswer.status).toBeNull();

      await submitAnswer(sessionId, ivo.token, { questionIndex: index, answer: wrongPayload(question, seed) });

      // Both answered → the question closes on its own.
      const revealed = await getHostView(sessionId, host.id);
      expect([question.type, revealed.session.state]).toEqual([question.type, "question_revealing"]);
      expect(revealed.reveal?.stats?.responseCount).toBe(2);

      const anaView = await getPlayerView(sessionId, ana.token);
      const ivoView = await getPlayerView(sessionId, ivo.token);
      if (question.type === "poll" || question.type === "ranking") {
        expect(anaView.me?.currentAnswer.status).toBe("ungraded");
        expect(anaView.me?.currentAnswer.points).toBe(0);
      } else {
        expect([question.type, anaView.me?.currentAnswer.status]).toEqual([question.type, "correct"]);
        expect(anaView.me?.currentAnswer.points).toBe(1000);
        expect([question.type, ivoView.me?.currentAnswer.status]).toEqual([question.type, "incorrect"]);
        expect(ivoView.me?.currentAnswer.points).toBe(0);
      }
      expect(anaView.reveal?.answer?.type).toBe(question.type);

      const row = await sessionRow(sessionId);
      await performAction(sessionId, { kind: "host", userId: host.id }, { action: "next", expectedVersion: row.state_version });
      const after = await sessionRow(sessionId);
      if (index < doc.questions.length - 1) {
        expect(after.state).toBe("leaderboard");
        await performAction(sessionId, { kind: "host", userId: host.id }, { action: "next", expectedVersion: after.state_version });
      } else {
        expect(after.state).toBe("finished");
      }
    }
  });

  it("finishes with an authoritative final leaderboard", async () => {
    const view = await getHostView(sessionId, host.id);
    expect(view.session.state).toBe("finished");
    const [first, second] = view.players;
    expect(first?.nickname).toBe("Ana");
    expect(first?.score).toBe(10 * 1000);
    expect(first?.correctCount).toBe(10);
    expect(second?.nickname).toBe("Ivo");
    expect(second?.score).toBe(0);
    const { data: results } = await getAdminSupabase().from("game_question_results").select("question_index").eq("session_id", sessionId);
    expect(results).toHaveLength(12);
    const { data: quiz } = await host.client.from("quizzes").select("last_played_at").eq("id", quizId).single();
    expect(quiz?.last_played_at).not.toBeNull();
  });

  it("refuses answers and actions after the game is finished", async () => {
    await expectApiError(submitAnswer(sessionId, ana.token, { questionIndex: 11, answer: {} }), 409);
    await expectApiError(performAction(sessionId, { kind: "host", userId: host.id }, { action: "next", expectedVersion: null }), 409);
    await expectApiError(joinGame(sessionId, { nickname: "Kasno" }), 409);
  });

  it("lets the host read the finished game through RLS", async () => {
    const { data } = await host.client.from("game_players").select("nickname, score").eq("session_id", sessionId);
    expect(data).toHaveLength(2);
    const { data: forOther } = await other.client.from("game_players").select("nickname").eq("session_id", sessionId);
    expect(forOther).toEqual([]);
  });
});

describe("timing, pause, review, kicking", () => {
  it("closes a question lazily once the deadline has passed and rejects late answers", async () => {
    const quiz = await createQuiz(host.client, host.id, document([f.singleChoice(), f.trueFalse()]));
    const { sessionId } = await createGame(host.id, { quizId: quiz, mode: "classic", settings: {} });
    const p = await joinGame(sessionId, { nickname: "Spori" });
    await joinGame(sessionId, { nickname: "Drugi" });
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: null });
    await expireCurrentQuestion(sessionId);
    const seed = (await sessionRow(sessionId)).seed;
    await expectApiError(
      submitAnswer(sessionId, p.token, { questionIndex: 0, answer: correctPayload(document().questions[0]!, seed) }),
      409,
      "deadline_passed",
    );
    const view = await getPlayerView(sessionId, p.token);
    expect(view.session.state).toBe("question_revealing");
    expect(view.reveal?.stats?.responseCount).toBe(0);
  });

  it("awards speed bonus by server time and supports pause/resume", async () => {
    const q = f.singleChoice();
    const quiz = await createQuiz(host.client, host.id, document([q]));
    const { sessionId } = await createGame(host.id, { quizId: quiz, mode: "classic", settings: {} });
    const a = await joinGame(sessionId, { nickname: "Brzi" });
    await joinGame(sessionId, { nickname: "Treći" });
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: null });
    await openCurrentQuestion(sessionId);
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "pause", expectedVersion: null });
    const seed = (await sessionRow(sessionId)).seed;
    await expectApiError(submitAnswer(sessionId, a.token, { questionIndex: 0, answer: correctPayload(q, seed) }), 409, "paused");
    const paused = await getPlayerView(sessionId, a.token);
    expect(paused.session.pausedRemainingMs).toBeGreaterThan(15_000);
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "resume", expectedVersion: null });
    await submitAnswer(sessionId, a.token, { questionIndex: 0, answer: correctPayload(q, seed) });
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "close_question", expectedVersion: null });
    const view = await getPlayerView(sessionId, a.token);
    expect(view.me?.currentAnswer.points).toBeGreaterThan(900);
    expect(view.me?.currentAnswer.points).toBeLessThanOrEqual(1000);
  });

  it("holds unmatched short answers for host review", async () => {
    const q = f.shortAnswer({ manualReview: true });
    const quiz = await createQuiz(host.client, host.id, document([q]));
    const { sessionId } = await createGame(host.id, { quizId: quiz, mode: "host_controlled", settings: { speedBonus: false } });
    const a = await joinGame(sessionId, { nickname: "Pisac" });
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: null });
    await openCurrentQuestion(sessionId);
    await submitAnswer(sessionId, a.token, { questionIndex: 0, answer: { text: "rijeka Sava" } });
    // Host-controlled: the question stays open until the host closes it.
    expect((await sessionRow(sessionId)).state).toBe("question_active");
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "close_question", expectedVersion: null });

    const hostView = await getHostView(sessionId, host.id);
    expect(hostView.host?.pendingReviews).toHaveLength(1);
    const pending = await getPlayerView(sessionId, a.token);
    expect(pending.me?.currentAnswer.status).toBe("pending_review");
    expect(pending.me?.score).toBe(0);

    const answerId = hostView.host!.pendingReviews[0]!.answerId;
    await expectApiError(
      performAction(sessionId, { kind: "player", token: a.token }, { action: "review", answerId, accept: true }),
      403,
    );
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "review", answerId, accept: true });
    const accepted = await getPlayerView(sessionId, a.token);
    expect(accepted.me?.currentAnswer.status).toBe("correct");
    expect(accepted.me?.score).toBe(1000);
    await expectApiError(
      performAction(sessionId, { kind: "host", userId: host.id }, { action: "review", answerId, accept: false }),
      409,
      "already_reviewed",
    );
  });

  it("removes kicked players and blocks their token", async () => {
    const quiz = await createQuiz(host.client, host.id, document([f.trueFalse()]));
    const { sessionId } = await createGame(host.id, { quizId: quiz, mode: "classic", settings: {} });
    const bad = await joinGame(sessionId, { nickname: "Napast" });
    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "kick", playerId: bad.playerId });
    await expectApiError(getPlayerView(sessionId, bad.token), 409, "kicked");
    // The nickname becomes free again.
    await joinGame(sessionId, { nickname: "Napast" });
  });

  it("disallows late joins when disabled", async () => {
    const quiz = await createQuiz(host.client, host.id, document([f.trueFalse()]));
    const game = await createGame(host.id, { quizId: quiz, mode: "classic", settings: { allowLateJoin: false } });
    await joinGame(game.sessionId, { nickname: "Prvi" });
    await performAction(game.sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: null });
    await expectApiError(lookupPin(game.pin!), 409, "late_join_disabled");
    await expectApiError(joinGame(game.sessionId, { nickname: "Kasni" }), 409, "late_join_disabled");
  });
});

describe("team mode", () => {
  it("aggregates team scores as member averages and locks teams after start", async () => {
    const q = f.trueFalse(true);
    const quiz = await createQuiz(host.client, host.id, document([q]));
    const { sessionId } = await createGame(host.id, {
      quizId: quiz,
      mode: "team",
      settings: { teamNames: ["Plavi", "Crveni"], speedBonus: false },
    });
    const lookup = await getHostView(sessionId, host.id);
    const [blue, red] = lookup.teams;
    const p1 = await joinGame(sessionId, { nickname: "P1", teamId: blue!.id });
    const p2 = await joinGame(sessionId, { nickname: "P2", teamId: blue!.id });
    const p3 = await joinGame(sessionId, { nickname: "P3", teamId: red!.id });
    const p4 = await joinGame(sessionId, { nickname: "P4" }); // auto-balanced at start → red

    await performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: null });
    await expectApiError(
      performAction(sessionId, { kind: "host", userId: host.id }, { action: "assign_team", playerId: p1.playerId, teamId: red!.id }),
      409,
      "teams_locked",
    );
    await openCurrentQuestion(sessionId);
    await submitAnswer(sessionId, p1.token, { questionIndex: 0, answer: { value: true } });
    await submitAnswer(sessionId, p2.token, { questionIndex: 0, answer: { value: false } });
    await submitAnswer(sessionId, p3.token, { questionIndex: 0, answer: { value: true } });
    await submitAnswer(sessionId, p4.token, { questionIndex: 0, answer: { value: true } });

    const view = await getHostView(sessionId, host.id);
    expect(view.session.state).toBe("question_revealing");
    expect(view.teams.map((t) => [t.name, t.score, t.memberCount])).toEqual([
      ["Crveni", 1000, 2],
      ["Plavi", 500, 2],
    ]);
  });
});

describe("practice mode", () => {
  it("lets the owner play solo and controls the pace with the player token", async () => {
    const questions = [f.singleChoice(), f.numeric()];
    const quiz = await createQuiz(host.client, host.id, document(questions));
    const practice = await createPractice(quiz, { id: host.id, nickname: "Domaćin" });
    const seed = (await sessionRow(practice.sessionId)).seed;
    await openCurrentQuestion(practice.sessionId);
    await submitAnswer(practice.sessionId, practice.token, { questionIndex: 0, answer: correctPayload(questions[0]!, seed) });
    let view = await getPlayerView(practice.sessionId, practice.token);
    expect(view.session.state).toBe("question_revealing");
    await performAction(practice.sessionId, { kind: "player", token: practice.token }, { action: "next", expectedVersion: view.session.version });
    await openCurrentQuestion(practice.sessionId);
    await submitAnswer(practice.sessionId, practice.token, { questionIndex: 1, answer: wrongPayload(questions[1]!, seed) });
    view = await getPlayerView(practice.sessionId, practice.token);
    await performAction(practice.sessionId, { kind: "player", token: practice.token }, { action: "next", expectedVersion: view.session.version });
    view = await getPlayerView(practice.sessionId, practice.token);
    expect(view.session.state).toBe("finished");
    expect(view.me?.correctCount).toBe(1);
    // Saved for the signed-in user.
    const { data } = await host.client.from("game_sessions").select("mode").eq("id", practice.sessionId).single();
    expect(data?.mode).toBe("practice");
  });

  it("requires sharing before others can practise", async () => {
    const quiz = await createQuiz(host.client, host.id, document([f.trueFalse()]));
    await expectApiError(createPractice(quiz, null), 403);
    await getAdminSupabase().from("quizzes").update({ practice_shared: true }).eq("id", quiz);
    const practice = await createPractice(quiz, null);
    expect(practice.token).toHaveLength(64);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within the window", async () => {
    const admin = getAdminSupabase();
    const key = `it:${Math.random()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await admin.rpc("hit_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });
      results.push(Boolean(data));
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
