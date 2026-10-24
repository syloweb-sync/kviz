import { describe, expect, it } from "vitest";
import { createGame, getHostView, joinGame, performAction, submitAnswer } from "@/lib/server/games/service";
import { createQuiz } from "@/lib/server/quizzes";
import { getAdminSupabase } from "@/lib/supabase/server";
import { correctPayload, wrongPayload } from "../support/answers";
import * as f from "../unit/fixtures";
import { createUser, openCurrentQuestion, sessionRow } from "./helpers";

describe("20 players in one room", () => {
  it("handles simultaneous joins and answers, closing each question exactly once", async () => {
    const host = await createUser("Domaćin 20");
    const questions = [f.singleChoice(), f.slider(), f.matching()];
    const quizId = await createQuiz(host.client, host.id, {
      title: "Velika soba",
      description: "",
      coverImage: null,
      category: null,
      tags: [],
      questions,
    });
    const { sessionId } = await createGame(host.id, { quizId, mode: "classic", settings: { speedBonus: false } });

    const players = await Promise.all(Array.from({ length: 20 }, (_, i) => joinGame(sessionId, { nickname: `Igrač ${i + 1}` })));
    expect(new Set(players.map((p) => p.playerId)).size).toBe(20);

    // Two concurrent "start" clicks: exactly one wins.
    const version = (await sessionRow(sessionId)).state_version;
    const starts = await Promise.allSettled([
      performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: version }),
      performAction(sessionId, { kind: "host", userId: host.id }, { action: "start", expectedVersion: version }),
    ]);
    expect(starts.filter((s) => s.status === "fulfilled")).toHaveLength(1);

    const seed = (await sessionRow(sessionId)).seed;
    for (let index = 0; index < questions.length; index++) {
      await openCurrentQuestion(sessionId);
      const question = questions[index]!;
      // Everyone answers at once; even-numbered players answer correctly. Each player also
      // fires a duplicate submission that must be rejected.
      const results = await Promise.allSettled(
        players.flatMap((p, i) => {
          const payload = i % 2 === 0 ? correctPayload(question, seed) : wrongPayload(question, seed);
          return [
            submitAnswer(sessionId, p.token, { questionIndex: index, answer: payload }),
            submitAnswer(sessionId, p.token, { questionIndex: index, answer: payload }),
          ];
        }),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);

      const view = await getHostView(sessionId, host.id);
      expect(view.session.state).toBe("question_revealing");
      expect(view.reveal?.stats?.responseCount).toBe(20);
      const { data: resultRows } = await getAdminSupabase()
        .from("game_question_results")
        .select("id")
        .eq("session_id", sessionId)
        .eq("question_index", index);
      expect(resultRows).toHaveLength(1);

      const row = await sessionRow(sessionId);
      await performAction(sessionId, { kind: "host", userId: host.id }, { action: "next", expectedVersion: row.state_version });
      const after = await sessionRow(sessionId);
      if (after.state === "leaderboard") {
        await performAction(sessionId, { kind: "host", userId: host.id }, { action: "next", expectedVersion: after.state_version });
      }
    }

    const final = await getHostView(sessionId, host.id);
    expect(final.session.state).toBe("finished");
    expect(final.players).toHaveLength(20);
    const winners = final.players.filter((p) => p.score === 3000);
    expect(winners).toHaveLength(10);
    // Shared rank for the tie at the top.
    expect(new Set(winners.map((p) => p.rank))).toEqual(new Set([1]));
    expect(final.players.filter((p) => p.score === 0).every((p) => p.rank === 11)).toBe(true);
  });
});
