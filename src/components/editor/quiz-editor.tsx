"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  CloudOff,
  Download,
  Dumbbell,
  Eye,
  GripVertical,
  LoaderCircle,
  Play,
  Save,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { QuestionTypeIcon } from "@/components/quiz/question-type-icon";
import { SortableList, moveItem } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/misc";
import { SwitchRow } from "@/components/ui/switch";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { buildExport, downloadJson, slugify } from "@/lib/client/export";
import { QUESTION_TYPE_META, cloneQuestionWithNewIds, createQuestion } from "@/lib/domain/question-defaults";
import { LIMITS, type Question, type QuestionType, type QuizDocument } from "@/lib/domain/schema";
import { validateQuestionForPlay, validateQuizForPlay } from "@/lib/domain/validation";
import { cn, formatRelative } from "@/lib/utils";
import { AddQuestionDialog } from "./add-question-dialog";
import { ImageField } from "./image-field";
import { QuestionEditor } from "./question-editor";
import { useAutosave, type SaveStatus } from "./use-autosave";

const CATEGORIES = ["Opće znanje", "Geografija", "Povijest", "Znanost", "Sport", "Glazba", "Film i TV", "Jezik", "Obitelj", "Škola", "Posao", "Zabava"];

const detailsSchema = z.object({
  title: z.string().trim().min(1, "Kviz treba naslov.").max(LIMITS.quizTitle),
  description: z.string().max(LIMITS.quizDescription),
  category: z.string().max(LIMITS.category),
  tags: z.string().max(300),
});
type Details = z.infer<typeof detailsSchema>;

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((t) => t.trim().slice(0, LIMITS.tag))
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .slice(0, LIMITS.tags);
}

function SaveIndicator({ status, error, savedAt }: { status: SaveStatus; error: string | null; savedAt: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const content = {
    saved: { icon: <CircleCheck className="size-4 text-mint-400" />, text: savedAt ? `Spremljeno ${formatRelative(savedAt)}` : "Sve je spremljeno" },
    dirty: { icon: <span className="size-2 rounded-full bg-sun-400" />, text: "Nespremljene promjene" },
    saving: { icon: <LoaderCircle className="size-4 animate-spin text-cyan-300" />, text: "Spremanje…" },
    error: { icon: <CloudOff className="size-4 text-coral-400" />, text: error ?? "Greška pri spremanju" },
  }[status];
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-ink-subtle" role="status" aria-live="polite">
      {content.icon}
      <span className="max-w-56 truncate">{content.text}</span>
    </p>
  );
}

export function QuizEditor({
  quizId,
  initial,
  initialPracticeShared,
}: {
  quizId: string;
  initial: QuizDocument;
  initialPracticeShared: boolean;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(initial.questions);
  const [selectedId, setSelectedId] = useState<string | null>(initial.questions[0]?.id ?? null);
  const [coverImage, setCoverImage] = useState(initial.coverImage);
  const [detailsOpen, setDetailsOpen] = useState(initial.questions.length === 0 && !initial.title);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [practiceShared, setPracticeShared] = useState(initialPracticeShared);
  const [navigating, setNavigating] = useState<"host" | "preview" | null>(null);

  const form = useForm<Details>({
    resolver: zodResolver(detailsSchema),
    mode: "onChange",
    defaultValues: {
      title: initial.title,
      description: initial.description,
      category: initial.category ?? "",
      tags: initial.tags.join(", "),
    },
  });
  const details = useWatch({ control: form.control });

  const document: QuizDocument = useMemo(
    () => ({
      title: (details.title ?? "").slice(0, LIMITS.quizTitle),
      description: (details.description ?? "").slice(0, LIMITS.quizDescription),
      coverImage,
      category: details.category?.trim() ? details.category.trim().slice(0, LIMITS.category) : null,
      tags: parseTags(details.tags ?? ""),
      questions,
    }),
    [details, coverImage, questions],
  );

  const { status, error, savedAt, flush } = useAutosave(quizId, document);
  const issues = useMemo(() => validateQuizForPlay(document), [document]);
  const selectedIndex = questions.findIndex((q) => q.id === selectedId);
  const selected = selectedIndex >= 0 ? questions[selectedIndex] : undefined;

  const updateQuestion = useCallback((next: Question) => {
    setQuestions((list) => list.map((q) => (q.id === next.id ? next : q)));
  }, []);

  function addQuestion(type: QuestionType) {
    if (questions.length >= LIMITS.questions) return toast.error(`Kviz može imati najviše ${LIMITS.questions} pitanja.`);
    const question = createQuestion(type);
    setQuestions((list) => {
      const at = selectedIndex >= 0 ? selectedIndex + 1 : list.length;
      return [...list.slice(0, at), question, ...list.slice(at)];
    });
    setSelectedId(question.id);
  }

  function duplicateQuestion(question: Question) {
    const copy = cloneQuestionWithNewIds(question);
    setQuestions((list) => {
      const at = list.findIndex((q) => q.id === question.id) + 1;
      return [...list.slice(0, at), copy, ...list.slice(at)];
    });
    setSelectedId(copy.id);
  }

  function deleteQuestion(id: string) {
    const index = questions.findIndex((q) => q.id === id);
    const next = questions.filter((q) => q.id !== id);
    setQuestions(next);
    if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null);
    setDeleteId(null);
  }

  async function go(target: "host" | "preview") {
    if (target === "host" && issues.length) {
      setIssuesOpen(true);
      return;
    }
    setNavigating(target);
    const ok = await flush();
    if (!ok) {
      setNavigating(null);
      toast.error("Kviz nije spremljen. Pokušajte ponovno.");
      return;
    }
    router.push(`/quizzes/${quizId}/${target}`);
  }

  async function togglePracticeShare(value: boolean) {
    setPracticeShared(value);
    try {
      await apiFetch(`/api/quizzes/${quizId}`, { method: "PATCH", body: { practiceShared: value } });
    } catch (err) {
      setPracticeShared(!value);
      toast.error(err instanceof ApiClientError ? err.message : "Promjena nije spremljena.");
    }
  }

  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );
  const practiceUrl = `${origin}/practice/${quizId}`;

  return (
    <div className="min-h-dvh pb-28">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 border-b border-white/6 bg-night-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="icon" aria-label="Natrag na kvizove">
              <Link href="/dashboard">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold leading-tight">{document.title || "Kviz bez naslova"}</p>
              <SaveIndicator status={status} error={error} savedAt={savedAt} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDetailsOpen(true)}>
              <Settings2 /> Podaci o kvizu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => downloadJson(buildExport(document), `${slugify(document.title)}.pitalica.json`)}>
              <Download /> <span className="hidden sm:inline">Izvoz</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void flush()} disabled={status === "saved" || status === "saving"}>
              <Save /> Spremi
            </Button>
            <Button variant="secondary" size="sm" loading={navigating === "preview"} onClick={() => void go("preview")} disabled={questions.length === 0}>
              <Eye /> Pregled
            </Button>
            <Button size="sm" loading={navigating === "host"} onClick={() => void go("host")}>
              <Play /> Pokreni igru
              {issues.length > 0 && <Badge tone="sun" className="ml-0.5 bg-night-950/40">{issues.length}</Badge>}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Question list */}
        <aside aria-label="Popis pitanja" className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Pitanja ({questions.length})</h2>
          </div>
          {questions.length > 0 && (
            <SortableList
              items={questions}
              onReorder={setQuestions}
              className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
              itemClassName="shrink-0 w-56 lg:w-auto"
              renderItem={(question, index, handle) => {
                const problems = validateQuestionForPlay(question).length;
                const active = question.id === selectedId;
                return (
                  <div
                    className={cn(
                      "group flex items-center gap-1.5 rounded-xl p-2 ring-1 transition-colors",
                      active ? "bg-night-600 ring-violet-400" : "bg-night-800/70 ring-white/6 hover:bg-night-700",
                      handle.isDragging && "shadow-[var(--shadow-lift)] ring-2 ring-cyan-300",
                    )}
                  >
                    <button
                      type="button"
                      className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-faint hover:text-ink active:cursor-grabbing"
                      aria-label={`Povuci pitanje ${index + 1}`}
                      {...handle.attributes}
                      {...handle.listeners}
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedId(question.id)}
                      aria-current={active ? "true" : undefined}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <QuestionTypeIcon type={question.type} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-ink-subtle">
                          {index + 1}. {QUESTION_TYPE_META[question.type].label}
                        </span>
                        <span className="block truncate text-sm font-semibold">{question.title || "Bez teksta"}</span>
                      </span>
                      {problems > 0 && <CircleAlert className="size-4 shrink-0 text-sun-400" aria-label="Pitanje nije dovršeno" />}
                    </button>
                    <div className="hidden flex-col lg:flex">
                      <button
                        type="button"
                        className="rounded p-0.5 text-ink-faint hover:text-ink disabled:opacity-30"
                        aria-label={`Pomakni pitanje ${index + 1} gore`}
                        disabled={index === 0}
                        onClick={() => setQuestions((list) => moveItem(list, index, index - 1))}
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-ink-faint hover:text-ink disabled:opacity-30"
                        aria-label={`Pomakni pitanje ${index + 1} dolje`}
                        disabled={index === questions.length - 1}
                        onClick={() => setQuestions((list) => moveItem(list, index, index + 1))}
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }}
            />
          )}
          <AddQuestionDialog onAdd={addQuestion} triggerProps={{ variant: "secondary", className: "mt-3 w-full" }} />
        </aside>

        {/* Editor */}
        <section aria-label="Uređivanje pitanja" className="min-w-0">
          {selected ? (
            <QuestionEditor
              key={selected.id}
              question={selected}
              index={selectedIndex}
              total={questions.length}
              onChange={updateQuestion}
              onDuplicate={() => duplicateQuestion(selected)}
              onDelete={() => setDeleteId(selected.id)}
            />
          ) : (
            <EmptyState
              title="Dodaj prvo pitanje"
              description="Odaberi vrstu pitanja — možeš ih kasnije presložiti povlačenjem."
              action={<AddQuestionDialog onAdd={addQuestion} triggerProps={{ size: "lg" }} />}
            />
          )}
        </section>
      </div>

      {/* Quiz details */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent title="Podaci o kvizu" description="Naslov i opis vide igrači u predvorju." className="max-w-2xl">
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <Field label="Naslov" htmlFor="quiz-title" error={form.formState.errors.title?.message}>
              <Input id="quiz-title" maxLength={LIMITS.quizTitle} placeholder="npr. Kviz za obiteljski ručak" {...form.register("title")} />
            </Field>
            <Field label="Opis" htmlFor="quiz-description">
              <Textarea id="quiz-description" maxLength={LIMITS.quizDescription} placeholder="O čemu je kviz?" {...form.register("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kategorija" htmlFor="quiz-category">
                <Input id="quiz-category" list="quiz-categories" maxLength={LIMITS.category} placeholder="Odaberi ili upiši" {...form.register("category")} />
                <datalist id="quiz-categories">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Oznake" htmlFor="quiz-tags" hint="Odvojite zarezom, npr. obitelj, ljeto">
                <Input id="quiz-tags" placeholder="oznaka1, oznaka2" {...form.register("tags")} />
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink-muted">Naslovna slika</p>
              <ImageField label="Naslovna slika" aspect="aspect-[16/7]" value={coverImage} onChange={setCoverImage} />
            </div>
            <div className="rounded-xl bg-night-950/40 px-4 py-2 ring-1 ring-white/8">
              <SwitchRow
                id="practice-share"
                label="Dopusti vježbu putem poveznice"
                description="Svatko s poveznicom može sam vježbati ovaj kviz (bez uvida u točne odgovore unaprijed)."
                checked={practiceShared}
                onCheckedChange={(v) => void togglePracticeShare(v)}
              />
              {practiceShared && (
                <div className="flex items-center gap-2 pb-2">
                  <Input readOnly value={practiceUrl} aria-label="Poveznica za vježbu" onFocus={(e) => e.currentTarget.select()} />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigator.clipboard?.writeText(practiceUrl).then(() => toast.success("Poveznica je kopirana."))}
                  >
                    Kopiraj
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-between gap-3">
              {issues.length === 0 && (
                <Button asChild variant="ghost">
                  <Link href={`/practice/${quizId}`}>
                    <Dumbbell /> Vježbaj sam
                  </Link>
                </Button>
              )}
              <Button type="button" className="ml-auto" onClick={() => setDetailsOpen(false)}>
                Gotovo
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issues */}
      <Dialog open={issuesOpen} onOpenChange={setIssuesOpen}>
        <DialogContent title="Kviz još nije spreman" description="Riješite ove stavke pa pokrenite igru.">
          <ul className="space-y-2">
            {issues.map((issue, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg bg-night-950/50 px-3 py-2.5 text-left hover:bg-night-700"
                  onClick={() => {
                    if (issue.questionId) setSelectedId(issue.questionId);
                    else setDetailsOpen(true);
                    setIssuesOpen(false);
                  }}
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-sun-400" />
                  <span>
                    <span className="block text-xs font-bold text-ink-subtle">
                      {issue.questionIndex === null ? "Kviz" : `Pitanje ${issue.questionIndex + 1}`}
                    </span>
                    <span className="font-semibold">{issue.message}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Obrisati pitanje?"
        description="Pitanje će biti uklonjeno iz kviza."
        confirmLabel="Obriši"
        onConfirm={() => deleteId && deleteQuestion(deleteId)}
      />
    </div>
  );
}
