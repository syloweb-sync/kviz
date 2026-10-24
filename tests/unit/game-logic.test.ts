import { describe, expect, it } from "vitest";
import { checkNickname } from "@/lib/domain/nickname";
import { createQuestion } from "@/lib/domain/question-defaults";
import { publicId } from "@/lib/domain/random";
import { rankPlayers, rankTeams } from "@/lib/domain/ranking";
import { buildQuestionStats, type GradedAnswer } from "@/lib/domain/results";
import {
  SUBMISSION_GRACE_MS,
  isWithinDeadline,
  transition,
  type MachineSnapshot,
} from "@/lib/domain/state-machine";
import { QUESTION_TYPES, quizDocumentSchema } from "@/lib/domain/schema";
import { validateQuestionForPlay, validateQuizForPlay } from "@/lib/domain/validation";
import { allQuestionTypes } from "./fixtures";
import * as f from "./fixtures";

const ctx = { showLeaderboard: true, playerCount: 3 };
const snap = (s: Partial<MachineSnapshot>): MachineSnapshot => ({
  state: "lobby",
  currentIndex: -1,
  totalQuestions: 3,
  paused: false,
  ...s,
});

describe("state machine", () => {
  it("runs a full game with leaderboards", () => {
    let s = snap({});
    const steps = ["start", "close_question", "next", "next", "close_question", "next", "next", "close_question", "next"] as const;
    const states: string[] = [];
    for (const action of steps) {
      const r = transition(s, action, ctx);
      if (!r.ok) throw new Error(`${action}: ${r.error}`);
      s = r.next;
      states.push(`${s.state}:${s.currentIndex}`);
    }
    expect(states).toEqual([
      "question_active:0",
      "question_revealing:0",
      "leaderboard:0",
      "question_active:1",
      "question_revealing:1",
      "leaderboard:1",
      "question_active:2",
      "question_revealing:2",
      "finished:2",
    ]);
  });

  it("skips leaderboards when disabled", () => {
    const r = transition(snap({ state: "question_revealing", currentIndex: 0 }), "next", { ...ctx, showLeaderboard: false });
    expect(r.ok && r.next).toMatchObject({ state: "question_active", currentIndex: 1 });
  });

  it("cannot start without players or questions, or twice", () => {
    expect(transition(snap({}), "start", { ...ctx, playerCount: 0 }).ok).toBe(false);
    expect(transition(snap({ totalQuestions: 0 }), "start", ctx).ok).toBe(false);
    expect(transition(snap({ state: "question_active", currentIndex: 0 }), "start", ctx).ok).toBe(false);
  });

  it("rejects advancing while a question is active (no double-advance)", () => {
    const active = snap({ state: "question_active", currentIndex: 0 });
    expect(transition(active, "next", ctx).ok).toBe(false);
    const closed = transition(active, "close_question", ctx);
    expect(closed.ok).toBe(true);
    if (closed.ok) expect(transition(closed.next, "close_question", ctx).ok).toBe(false);
  });

  it("pauses and resumes only active questions", () => {
    const active = snap({ state: "question_active", currentIndex: 0 });
    const paused = transition(active, "pause", ctx);
    expect(paused.ok && paused.next.paused).toBe(true);
    if (paused.ok) {
      expect(transition(paused.next, "pause", ctx).ok).toBe(false);
      const resumed = transition(paused.next, "resume", ctx);
      expect(resumed.ok && resumed.next.paused).toBe(false);
    }
    expect(transition(snap({ state: "leaderboard", currentIndex: 0 }), "pause", ctx).ok).toBe(false);
  });

  it("ending in the lobby cancels, ending mid-game finishes", () => {
    const lobby = transition(snap({}), "end", ctx);
    expect(lobby.ok && lobby.next.state).toBe("cancelled");
    const mid = transition(snap({ state: "leaderboard", currentIndex: 1 }), "end", ctx);
    expect(mid.ok && mid.next.state).toBe("finished");
  });

  it("terminal states accept no actions", () => {
    for (const state of ["finished", "cancelled"] as const) {
      for (const action of ["start", "next", "close_question", "pause", "resume", "end", "cancel"] as const) {
        expect(transition(snap({ state }), action, ctx).ok).toBe(false);
      }
    }
  });
});

describe("deadlines", () => {
  it("accepts answers until deadline + grace", () => {
    expect(isWithinDeadline(10_000, 10_000 + SUBMISSION_GRACE_MS, SUBMISSION_GRACE_MS)).toBe(true);
    expect(isWithinDeadline(10_000, 10_001 + SUBMISSION_GRACE_MS, SUBMISSION_GRACE_MS)).toBe(false);
    expect(isWithinDeadline(null, 0, SUBMISSION_GRACE_MS)).toBe(false);
  });
});

describe("ranking", () => {
  const p = (id: string, score: number, correctCount = 0, totalResponseMs = 0, joinedAt = "2026-01-01T00:00:00Z") => ({
    id,
    score,
    correctCount,
    totalResponseMs,
    joinedAt,
  });

  it("sorts by score and shares ranks on ties (1, 1, 3)", () => {
    const ranked = rankPlayers([p("a", 500), p("b", 900), p("c", 900), p("d", 100)]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["b", 1],
      ["c", 1],
      ["a", 3],
      ["d", 4],
    ]);
  });

  it("orders tied players deterministically by correct answers, speed, then join time", () => {
    const ranked = rankPlayers([
      p("slow", 800, 2, 9000),
      p("fast", 800, 2, 3000),
      p("more", 800, 3, 99000),
      p("late", 800, 2, 3000, "2026-01-01T00:00:05Z"),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["more", "fast", "late", "slow"]);
    expect(new Set(ranked.map((r) => r.rank))).toEqual(new Set([1]));
  });

  it("averages team scores and ranks teams", () => {
    const teams = [
      { id: "t1", name: "A", color: "coral", position: 0 },
      { id: "t2", name: "B", color: "cyan", position: 1 },
      { id: "t3", name: "C", color: "sun", position: 2 },
    ];
    const standings = rankTeams(teams, [
      { teamId: "t1", score: 1000 },
      { teamId: "t1", score: 0 },
      { teamId: "t2", score: 600 },
      { teamId: null, score: 5000 },
    ]);
    expect(standings.map((t) => [t.id, t.score, t.rank, t.memberCount])).toEqual([
      ["t2", 600, 1, 1],
      ["t1", 500, 2, 2],
      ["t3", 0, 3, 0],
    ]);
  });

  it("shares team ranks on ties", () => {
    const teams = [
      { id: "t1", name: "A", color: "coral", position: 0 },
      { id: "t2", name: "B", color: "cyan", position: 1 },
    ];
    const standings = rankTeams(teams, [
      { teamId: "t1", score: 300 },
      { teamId: "t2", score: 300 },
    ]);
    expect(standings.map((t) => t.rank)).toEqual([1, 1]);
  });
});

describe("nicknames", () => {
  it("normalises whitespace and enforces length", () => {
    expect(checkNickname("  Ana   M  ", { filter: true })).toEqual({ ok: true, nickname: "Ana M" });
    expect(checkNickname("A", { filter: true }).ok).toBe(false);
    expect(checkNickname("x".repeat(21), { filter: true }).ok).toBe(false);
  });
  it("blocks control characters and markup", () => {
    expect(checkNickname("Ana\u0000", { filter: false }).ok).toBe(false);
    expect(checkNickname("<b>Ana</b>", { filter: false }).ok).toBe(false);
  });
  it("filters offensive words only when enabled", () => {
    expect(checkNickname("Kurva123", { filter: true }).ok).toBe(false);
    expect(checkNickname("K u r v a", { filter: true }).ok).toBe(false);
    expect(checkNickname("Kurva123", { filter: false }).ok).toBe(true);
    expect(checkNickname("Đurđica", { filter: true }).ok).toBe(true);
  });
});

describe("quiz validation", () => {
  it("accepts fully configured questions of every type", () => {
    for (const q of allQuestionTypes()) expect([q.type, validateQuestionForPlay(q)]).toEqual([q.type, []]);
  });

  it("flags fresh (empty) questions of every type", () => {
    for (const type of QUESTION_TYPES) expect(validateQuestionForPlay(createQuestion(type)).length).toBeGreaterThan(0);
  });

  it("requires a title and at least one question", () => {
    expect(validateQuizForPlay({ title: "", questions: [] }).map((i) => i.questionIndex)).toEqual([null, null]);
  });

  it("checks slider ranges", () => {
    expect(validateQuestionForPlay(f.slider({ min: 10, max: 5 })).length).toBeGreaterThan(0);
    expect(validateQuestionForPlay(f.slider({ target: 5000 })).length).toBeGreaterThan(0);
  });

  it("allows short answers without accepted answers only with manual review", () => {
    expect(validateQuestionForPlay(f.shortAnswer({ acceptedAnswers: [] })).length).toBe(1);
    expect(validateQuestionForPlay(f.shortAnswer({ acceptedAnswers: [], manualReview: true }))).toEqual([]);
  });

  it("round-trips every type through the document schema", () => {
    const doc = { title: "T", description: "", coverImage: null, category: null, tags: [], questions: allQuestionTypes() };
    expect(quizDocumentSchema.parse(doc)).toEqual(doc);
  });

  it("rejects malicious media paths", () => {
    const q = f.pinImage();
    q.config.image = { path: "../../etc/passwd", width: 10, height: 10 };
    const doc = { title: "T", questions: [q] };
    expect(quizDocumentSchema.safeParse(doc).success).toBe(false);
  });
});

describe("question statistics", () => {
  const SEED = "s";
  const graded = (answer: GradedAnswer["answer"], status: GradedAnswer["status"], nickname = "x"): GradedAnswer => ({
    playerId: nickname,
    nickname,
    answer,
    status,
    fraction: status === "correct" ? 1 : 0,
    points: status === "correct" ? 1000 : 0,
  });

  it("counts option distribution with public IDs", () => {
    const q = f.singleChoice();
    const [a, b] = q.config.options;
    const stats = buildQuestionStats(
      q,
      [
        graded({ type: "single_choice", optionId: b!.id }, "correct"),
        graded({ type: "single_choice", optionId: b!.id }, "correct"),
        graded({ type: "single_choice", optionId: a!.id }, "incorrect"),
      ],
      SEED,
    );
    expect(stats.responseCount).toBe(3);
    expect(stats.correctCount).toBe(2);
    expect(stats.averagePoints).toBe(667);
    if (stats.distribution.kind !== "options") throw new Error("wrong kind");
    expect(stats.distribution.counts[publicId(SEED, b!.id)]).toBe(2);
    expect(stats.distribution.voters).toBeNull();
  });

  it("shows poll voters only when enabled", () => {
    const q = f.poll();
    q.config.showVoterNames = true;
    const stats = buildQuestionStats(q, [graded({ type: "poll", optionId: q.config.options[0]!.id }, "ungraded", "Ana")], SEED);
    if (stats.distribution.kind !== "options") throw new Error("wrong kind");
    expect(stats.distribution.voters?.[publicId(SEED, q.config.options[0]!.id)]).toEqual(["Ana"]);
  });

  it("aggregates rankings with a Borda count", () => {
    const q = f.ranking();
    const [a, b, c, d] = q.config.options.map((o) => o.id) as [string, string, string, string];
    const stats = buildQuestionStats(
      q,
      [
        graded({ type: "ranking", order: [a, b, c, d] }, "ungraded"),
        graded({ type: "ranking", order: [b, a, c, d] }, "ungraded"),
        graded({ type: "ranking", order: [b, c, a, d] }, "ungraded"),
      ],
      SEED,
    );
    if (stats.distribution.kind !== "ranking") throw new Error("wrong kind");
    expect(stats.distribution.order.map((o) => o.id)).toEqual([b, a, c, d].map((id) => publicId(SEED, id)));
  });

  it("groups short answers by normalised text", () => {
    const q = f.shortAnswer();
    const stats = buildQuestionStats(
      q,
      [
        graded({ type: "short_answer", text: "Sava" }, "correct"),
        graded({ type: "short_answer", text: " sava" }, "correct"),
        graded({ type: "short_answer", text: "Drava" }, "incorrect"),
      ],
      SEED,
    );
    if (stats.distribution.kind !== "texts") throw new Error("wrong kind");
    expect(stats.distribution.groups[0]).toMatchObject({ text: "Sava", count: 2, status: "correct" });
  });

  it("buckets slider values over the slider range", () => {
    const q = f.slider();
    const stats = buildQuestionStats(q, [graded({ type: "slider", value: 1831 }, "correct"), graded({ type: "slider", value: 0 }, "incorrect")], SEED);
    if (stats.distribution.kind !== "numbers") throw new Error("wrong kind");
    expect(stats.distribution.buckets).toHaveLength(10);
    expect(stats.distribution.average).toBeCloseTo(915.5);
  });
});
