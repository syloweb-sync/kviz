"use client";

import { Copy, Download, Dumbbell, Ellipsis, Eye, Pencil, Play, Search, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ShapeIcon, answerStyle } from "@/components/brand/shapes";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, EmptyState } from "@/components/ui/misc";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { downloadQuizExport } from "@/lib/client/export";
import { fnv1a } from "@/lib/domain/random";
import { mediaUrl } from "@/lib/media";
import { cn, formatRelative, plural } from "@/lib/utils";

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  coverPath: string | null;
  category: string | null;
  tags: string[];
  isPlayable: boolean;
  issueCount: number;
  questionCount: number;
  practiceShared: boolean;
  updatedAt: string;
  lastPlayedAt: string | null;
}

type SortKey = "updated" | "title" | "questions" | "played";
type Filter = "all" | "ready" | "drafts";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "updated", label: "Zadnje uređeno" },
  { key: "played", label: "Zadnje igrano" },
  { key: "title", label: "Naziv (A–Ž)" },
  { key: "questions", label: "Broj pitanja" },
];

export function QuizLibrary({ quizzes }: { quizzes: QuizSummary[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("hr");
    const filtered = quizzes.filter((quiz) => {
      if (filter === "ready" && !quiz.isPlayable) return false;
      if (filter === "drafts" && quiz.isPlayable) return false;
      if (!q) return true;
      return [quiz.title, quiz.description, quiz.category ?? "", ...quiz.tags].some((v) =>
        v.toLocaleLowerCase("hr").includes(q),
      );
    });
    const collator = new Intl.Collator("hr");
    return filtered.sort((a, b) => {
      switch (sort) {
        case "title":
          return collator.compare(a.title || "~", b.title || "~");
        case "questions":
          return b.questionCount - a.questionCount;
        case "played":
          return (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? "");
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
  }, [quizzes, query, sort, filter]);

  const drafts = quizzes.filter((q) => !q.isPlayable).length;

  if (quizzes.length === 0) {
    return (
      <EmptyState
        className="mt-12"
        icon={
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("grid size-12 place-items-center rounded-xl text-white", answerStyle(i).bg)} style={{ rotate: `${(i - 1.5) * 6}deg` }}>
                <ShapeIcon shape={answerStyle(i).shape} />
              </span>
            ))}
          </div>
        }
        title="Još nema nijednog kviza"
        description="Napravi prvi kviz klikom na „Novi kviz” ili uvezi postojeći iz JSON datoteke. Prvo pitanje složiš za manje od minute."
      />
    );
  }

  return (
    <section className="mt-12" aria-labelledby="library-heading">
      <h2 id="library-heading" className="sr-only">
        Popis kvizova
      </h2>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filtar kvizova" className="flex gap-1 rounded-xl bg-white/5 p-1">
          {(
            [
              ["all", `Svi (${quizzes.length})`],
              ["ready", `Spremni (${quizzes.length - drafts})`],
              ["drafts", `Skice (${drafts})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                filter === key ? "bg-violet-500 text-white" : "text-ink-subtle hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraži kvizove…"
              aria-label="Pretraži kvizove"
              className="h-11 w-full rounded-lg bg-night-950/60 pl-10 pr-3 ring-1 ring-white/12 placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:w-72"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Poredaj"
            className="h-11 rounded-lg bg-night-950/60 px-3 font-semibold ring-1 ring-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState className="mt-8" title="Nema rezultata" description="Nijedan kviz ne odgovara pretrazi ili filtru." />
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((quiz) => (
            <li key={quiz.id}>
              <QuizCard quiz={quiz} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CoverArt({ quiz }: { quiz: QuizSummary }) {
  const url = mediaUrl(quiz.coverPath ? { path: quiz.coverPath } : null);
  const seed = fnv1a(quiz.id);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="size-full object-cover" loading="lazy" decoding="async" />;
  }
  const shapes = [0, 1, 2].map((i) => answerStyle((seed >> (i * 3)) % 6));
  return (
    <div className={cn("relative size-full overflow-hidden", ["bg-violet-600", "bg-night-600", "bg-cyan-500/40", "bg-coral-500/50"][seed % 4])}>
      <div className="dot-grid absolute inset-0 opacity-50" />
      {shapes.map((style, i) => (
        <ShapeIcon
          key={i}
          shape={style.shape}
          className={cn("absolute opacity-90", style.text, ["left-[8%] top-[18%] size-14", "right-[12%] top-[10%] size-10", "bottom-[8%] right-[30%] size-16"][i])}
        />
      ))}
    </div>
  );
}

function QuizCard({ quiz }: { quiz: QuizSummary }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function duplicate() {
    setBusy(true);
    try {
      await apiFetch(`/api/quizzes/${quiz.id}/duplicate`, { method: "POST" });
      toast.success("Kopija je napravljena.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Kopiranje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      toast.success("Kviz je obrisan.");
      setConfirmOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Brisanje nije uspjelo.");
    } finally {
      setBusy(false);
    }
  }

  const itemClass =
    "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 font-semibold outline-none data-[highlighted]:bg-white/8";

  return (
    <article className="surface group flex h-full flex-col overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-1">
      <Link href={`/quizzes/${quiz.id}/edit`} className="relative block aspect-[16/7] overflow-hidden" tabIndex={-1} aria-hidden="true">
        <CoverArt quiz={quiz} />
        {!quiz.isPlayable && (
          <Badge tone="sun" className="absolute left-3 top-3 bg-night-950/80">
            Skica
          </Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 font-display text-xl font-bold leading-snug">
            <Link href={`/quizzes/${quiz.id}/edit`} className="hover:underline">
              {quiz.title || <span className="text-ink-subtle">Kviz bez naslova</span>}
            </Link>
          </h3>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Više radnji za ${quiz.title || "kviz"}`} disabled={busy}>
                <Ellipsis />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="surface z-50 min-w-52 rounded-xl p-1.5">
                <DropdownMenu.Item asChild className={itemClass}>
                  <Link href={`/quizzes/${quiz.id}/edit`}>
                    <Pencil className="size-4" /> Uredi
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild className={itemClass}>
                  <Link href={`/quizzes/${quiz.id}/preview`}>
                    <Eye className="size-4" /> Pregled
                  </Link>
                </DropdownMenu.Item>
                {quiz.isPlayable && (
                  <DropdownMenu.Item asChild className={itemClass}>
                    <Link href={`/practice/${quiz.id}`}>
                      <Dumbbell className="size-4" /> Vježbaj sam
                    </Link>
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item className={itemClass} onSelect={duplicate}>
                  <Copy className="size-4" /> Dupliciraj
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={itemClass}
                  onSelect={() =>
                    downloadQuizExport(quiz.id).catch(() => toast.error("Izvoz nije uspio."))
                  }
                >
                  <Download className="size-4" /> Izvezi JSON
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-white/8" />
                <DropdownMenu.Item className={cn(itemClass, "text-coral-400")} onSelect={() => setConfirmOpen(true)}>
                  <Trash2 className="size-4" /> Obriši
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        {quiz.description && <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{quiz.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quiz.category && <Badge tone="violet">{quiz.category}</Badge>}
          {quiz.tags.slice(0, 3).map((tag) => (
            <Badge key={tag}>#{tag}</Badge>
          ))}
        </div>
        <p className="mt-auto pt-4 text-sm text-ink-subtle">
          {quiz.questionCount} {plural(quiz.questionCount, "pitanje", "pitanja", "pitanja")} · uređeno {formatRelative(quiz.updatedAt)}
        </p>
        <div className="mt-4 flex gap-2">
          {quiz.isPlayable ? (
            <Button asChild className="flex-1">
              <Link href={`/quizzes/${quiz.id}/host`}>
                <Play /> Pokreni igru
              </Link>
            </Button>
          ) : (
            <Button asChild variant="secondary" className="flex-1">
              <Link href={`/quizzes/${quiz.id}/edit`}>
                {quiz.questionCount === 0 ? <Sparkles /> : <TriangleAlert className="text-sun-300" />}
                {quiz.questionCount === 0 ? "Dodaj pitanja" : `Dovrši (${quiz.issueCount})`}
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary" size="icon" aria-label="Uredi">
            <Link href={`/quizzes/${quiz.id}/edit`}>
              <Pencil />
            </Link>
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Obrisati kviz?"
        description={
          <>
            Kviz <strong className="text-ink">{quiz.title || "bez naslova"}</strong> i sva njegova pitanja bit će trajno
            obrisani. Rezultati već odigranih igara ostaju sačuvani.
          </>
        }
        confirmLabel="Obriši kviz"
        onConfirm={remove}
        loading={busy}
      />
    </article>
  );
}
