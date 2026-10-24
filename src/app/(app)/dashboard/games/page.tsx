import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Odigrane igre" };

const PAGE_SIZE = 20;
const MODE_LABELS: Record<string, string> = { classic: "Klasično", team: "Timovi", host_controlled: "Ručno vođenje", practice: "Vježba" };
const STATE_LABELS: Record<string, { label: string; tone: "mint" | "sun" | "neutral" | "coral" }> = {
  finished: { label: "Završena", tone: "mint" },
  cancelled: { label: "Otkazana", tone: "neutral" },
  lobby: { label: "U predvorju", tone: "sun" },
  question_active: { label: "U tijeku", tone: "sun" },
  question_revealing: { label: "U tijeku", tone: "sun" },
  leaderboard: { label: "U tijeku", tone: "sun" },
};

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const from = (page - 1) * PAGE_SIZE;
  const { data: games, count, error } = await supabase
    .from("game_sessions")
    .select("id, quiz_title, mode, state, created_at, finished_at, game_players(count)", { count: "exact" })
    .eq("host_id", user!.id)
    .neq("state", "cancelled")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Odigrane igre</h1>
      <p className="mt-2 text-ink-muted">Rezultati svih igara koje ste vodili ili vježbali.</p>

      {!games?.length ? (
        <EmptyState
          className="mt-10"
          icon={<Trophy className="size-12 text-sun-300" />}
          title="Još nema odigranih igara"
          description="Kad pokrenete prvu igru, ovdje će se pojaviti konačni poredak i statistika svakog pitanja."
          action={
            <Button asChild>
              <Link href="/dashboard">Na moje kvizove</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="mt-8 divide-y divide-white/6 overflow-hidden rounded-2xl surface">
            {games.map((game) => {
              const players = (game.game_players as unknown as { count: number }[])[0]?.count ?? 0;
              const state = STATE_LABELS[game.state] ?? STATE_LABELS.finished!;
              const live = !["finished", "cancelled"].includes(game.state);
              return (
                <li key={game.id}>
                  <Link
                    href={live && game.mode !== "practice" ? `/host/${game.id}` : `/dashboard/games/${game.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-white/4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{game.quiz_title || "Bez naslova"}</span>
                      <span className="text-sm text-ink-subtle">{formatDateTime(game.created_at)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge>{MODE_LABELS[game.mode] ?? game.mode}</Badge>
                      <Badge tone="cyan">{players} igr.</Badge>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Stranice">
              <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
                <Link href={`/dashboard/games?page=${page - 1}`} aria-disabled={page <= 1}>
                  <ChevronLeft /> Novije
                </Link>
              </Button>
              <span className="text-sm text-ink-subtle">
                Stranica {page} / {totalPages}
              </span>
              <Button asChild variant="secondary" size="sm" className={page >= totalPages ? "pointer-events-none opacity-40" : ""}>
                <Link href={`/dashboard/games?page=${page + 1}`} aria-disabled={page >= totalPages}>
                  Starije <ChevronRight />
                </Link>
              </Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
