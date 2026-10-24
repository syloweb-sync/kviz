import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Podium, TeamStandings } from "@/components/game/game-ui";
import { RevealView } from "@/components/game/reveal";
import { QuestionTypeIcon } from "@/components/quiz/question-type-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { isScoredType } from "@/lib/domain/question-defaults";
import { toPublicQuestion, toRevealedAnswer } from "@/lib/domain/public-view";
import { rankPlayers, rankTeams } from "@/lib/domain/ranking";
import type { QuestionStats } from "@/lib/domain/results";
import { gameSettingsSchema, questionSchema } from "@/lib/domain/schema";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Rezultati igre" };

export default async function GameResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await getServerSupabase();
  const { data: session } = await supabase.from("game_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) notFound();
  const [{ data: players }, { data: results }, { data: teams }] = await Promise.all([
    supabase.from("game_players").select("*").eq("session_id", id).eq("kicked", false),
    supabase.from("game_question_results").select("*").eq("session_id", id).order("question_index"),
    supabase.from("game_teams").select("*").eq("session_id", id).order("position"),
  ]);

  const settings = gameSettingsSchema.parse(session.settings);
  const snapshot = z.object({ questions: z.array(questionSchema) }).parse(session.quiz_snapshot);
  const ranked = rankPlayers(
    (players ?? []).map((p) => ({ ...p, correctCount: p.correct_count, totalResponseMs: p.total_response_ms, joinedAt: p.joined_at })),
  );
  const teamStandings =
    session.mode === "team"
      ? rankTeams(
          (teams ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color, position: t.position })),
          (players ?? []).map((p) => ({ teamId: p.team_id, score: p.score })),
        )
      : [];
  const graded = Math.max(1, snapshot.questions.filter((q) => isScoredType(q.type)).length);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/games">
          <ArrowLeft /> Sve igre
        </Link>
      </Button>
      <h1 className="mt-4 font-display text-4xl font-extrabold">{session.quiz_title || "Bez naslova"}</h1>
      <p className="mt-1 text-ink-muted">
        {formatDateTime(session.created_at)} · {ranked.length} igrača · {snapshot.questions.length} pitanja
      </p>

      {ranked.length > 0 && (
        <section className="mt-10">
          <Podium
            entries={
              teamStandings.length
                ? teamStandings.slice(0, 3).map((t) => ({ id: t.id, name: t.name, score: t.score }))
                : ranked.slice(0, 3).map((p) => ({ id: p.id, name: p.nickname, score: p.score }))
            }
          />
        </section>
      )}

      {teamStandings.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl font-bold">Timovi</h2>
          <TeamStandings teams={teamStandings} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-display text-2xl font-bold">Poredak</h2>
        <div className="surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[32rem] text-left">
            <thead className="text-sm text-ink-subtle">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Igrač</th>
                <th className="px-4 py-3 text-right">Točno</th>
                <th className="px-4 py-3 text-right">Točnost</th>
                <th className="px-4 py-3 text-right">Bodovi</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p) => (
                <tr key={p.id} className="border-t border-white/6">
                  <td className="px-4 py-2.5 font-display font-extrabold">{p.rank}.</td>
                  <td className="px-4 py-2.5 font-bold">{p.nickname}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.correct_count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Math.round((p.correct_count / graded) * 100)} %</td>
                  <td className="px-4 py-2.5 text-right font-display font-extrabold tabular-nums">{formatNumber(p.score)}</td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    U ovoj igri nije bilo igrača.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-2xl font-bold">Pitanja</h2>
        <ol className="space-y-4">
          {session.question_order.map((snapshotIndex, index) => {
            const question = snapshot.questions[snapshotIndex];
            if (!question) return null;
            const result = (results ?? []).find((r) => r.question_index === index);
            const publicQuestion = toPublicQuestion(question, { seed: session.seed, randomizeAnswers: settings.randomizeAnswers, timeLimit: question.timeLimit });
            const stats = (result?.stats as unknown as QuestionStats | undefined) ?? null;
            return (
              <li key={`${question.id}-${index}`} className="surface rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <QuestionTypeIcon type={question.type} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink-subtle">Pitanje {index + 1}</p>
                    <h3 className="font-display text-xl font-bold">{question.title}</h3>
                  </div>
                  {stats ? (
                    <Badge tone="cyan">
                      {stats.responseCount} odg. · {question.type === "poll" || question.type === "ranking" ? "anketa" : `${stats.correctCount} točno`}
                    </Badge>
                  ) : (
                    <Badge>nije odigrano</Badge>
                  )}
                </div>
                {stats && (
                  <div className="mt-4">
                    <RevealView question={publicQuestion} answer={toRevealedAnswer(question, session.seed)} stats={stats} own={null} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
