import type { Metadata } from "next";
import { Clock, Trophy } from "lucide-react";
import Link from "next/link";
import { DashboardActions } from "@/components/app/dashboard-actions";
import { QuizLibrary, type QuizSummary } from "@/components/app/quiz-library";
import { Badge } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatRelative, plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Moji kvizovi" };

const MODE_LABELS: Record<string, string> = {
  classic: "Klasično",
  team: "Timovi",
  host_controlled: "Ručno vođenje",
  practice: "Vježba",
};

export default async function DashboardPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: quizzes, error }, { data: games }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle(),
    supabase
      .from("quizzes")
      .select("id, title, description, cover_image, category, tags, is_playable, issue_count, question_count, practice_shared, updated_at, last_played_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("game_sessions")
      .select("id, quiz_title, mode, state, created_at, finished_at")
      .eq("host_id", user!.id)
      .in("state", ["finished"])
      .order("created_at", { ascending: false })
      .limit(4),
  ]);
  if (error) throw error;

  const name = profile?.display_name?.split(" ")[0] || "domaćine";
  const summaries: QuizSummary[] = (quizzes ?? []).map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    coverPath: (q.cover_image as { path?: string } | null)?.path ?? null,
    category: q.category,
    tags: q.tags,
    isPlayable: q.is_playable,
    issueCount: q.issue_count,
    questionCount: q.question_count,
    practiceShared: q.practice_shared,
    updatedAt: q.updated_at,
    lastPlayedAt: q.last_played_at,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-display text-lg font-bold text-cyan-300">Bok, {name}!</p>
          <h1 className="mt-1 font-display text-4xl font-extrabold sm:text-5xl">Tvoji kvizovi</h1>
          <p className="mt-2 text-ink-muted">
            {summaries.length
              ? `${summaries.length} ${plural(summaries.length, "kviz", "kviza", "kvizova")} · spremno za igru: ${summaries.filter((q) => q.isPlayable).length}`
              : "Ovdje će se pojaviti kvizovi koje napraviš."}
          </p>
        </div>
        <DashboardActions />
      </section>

      {games && games.length > 0 && (
        <section className="mt-10" aria-labelledby="recent-heading">
          <div className="flex items-center justify-between">
            <h2 id="recent-heading" className="font-display text-xl font-bold">
              Nedavno odigrano
            </h2>
            <Link href="/dashboard/games" className="text-sm font-bold text-cyan-300 hover:underline">
              Sve igre →
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {games.map((game) => (
              <li key={game.id}>
                <Link
                  href={`/dashboard/games/${game.id}`}
                  className="surface-flat flex items-center gap-3 rounded-xl p-4 transition-colors hover:bg-night-700"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sun-400/15 text-sun-300">
                    <Trophy className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{game.quiz_title || "Bez naslova"}</span>
                    <span className="flex items-center gap-1.5 text-sm text-ink-subtle">
                      <Clock className="size-3.5" /> {formatRelative(game.finished_at ?? game.created_at)}
                      <Badge className="ml-1">{MODE_LABELS[game.mode] ?? game.mode}</Badge>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuizLibrary quizzes={summaries} />
    </main>
  );
}
