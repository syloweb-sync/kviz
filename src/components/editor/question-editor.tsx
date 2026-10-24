"use client";

import { Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { QuestionPreview } from "@/components/game/question-preview";
import { QuestionTypeIcon } from "@/components/quiz/question-type-icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { QUESTION_TYPE_META, isScoredType } from "@/lib/domain/question-defaults";
import { LIMITS, type Question } from "@/lib/domain/schema";
import { validateQuestionForPlay } from "@/lib/domain/validation";
import { cn } from "@/lib/utils";
import { ChoiceEditor, ImageChoiceEditor, TrueFalseEditor } from "./choice-editors";
import { ImageField } from "./image-field";
import { MatchingEditor, OrderingEditor, RankingEditor } from "./list-editors";
import { PinImageEditor } from "./pin-editor";
import { produce } from "./primitives";
import { NumericEditor, ShortAnswerEditor, SliderEditor } from "./value-editors";

const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

function TypeEditor({ question, onChange }: { question: Question; onChange: (q: Question) => void }) {
  switch (question.type) {
    case "single_choice":
    case "multi_select":
    case "poll":
      return <ChoiceEditor question={question} onChange={onChange} />;
    case "true_false":
      return <TrueFalseEditor question={question} onChange={onChange} />;
    case "image_choice":
      return <ImageChoiceEditor question={question} onChange={onChange} />;
    case "slider":
      return <SliderEditor question={question} onChange={onChange} />;
    case "numeric":
      return <NumericEditor question={question} onChange={onChange} />;
    case "short_answer":
      return <ShortAnswerEditor question={question} onChange={onChange} />;
    case "ordering":
      return <OrderingEditor question={question} onChange={onChange} />;
    case "ranking":
      return <RankingEditor question={question} onChange={onChange} />;
    case "matching":
      return <MatchingEditor question={question} onChange={onChange} />;
    case "pin_image":
      return <PinImageEditor question={question} onChange={onChange} />;
  }
}

const selectClass =
  "h-11 w-full rounded-lg bg-night-950/60 px-3 font-semibold ring-1 ring-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";

export function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onDuplicate,
  onDelete,
}: {
  question: Question;
  index: number;
  total: number;
  onChange: (q: Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const issues = validateQuestionForPlay(question);
  const scored = isScoredType(question.type);
  const set = <K extends keyof Question>(key: K, value: Question[K]) =>
    onChange(produce(question, (q) => void ((q as Record<string, unknown>)[key] = value)));

  return (
    <div className="surface rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <QuestionTypeIcon type={question.type} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-subtle">
              Pitanje {index + 1} od {total}
            </p>
            <p className="truncate font-display text-lg font-bold">{QUESTION_TYPE_META[question.type].label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="mr-1 flex rounded-lg bg-white/6 p-1" role="tablist" aria-label="Način prikaza">
            {(
              [
                ["edit", "Uredi", Pencil],
                ["preview", "Pregled", Eye],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold",
                  mode === key ? "bg-night-500 text-ink" : "text-ink-subtle hover:text-ink",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={onDuplicate} aria-label="Dupliciraj pitanje">
            <Copy />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Obriši pitanje" className="hover:text-coral-400">
            <Trash2 />
          </Button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="p-5">
          <QuestionPreview question={question} />
        </div>
      ) : (
        <div className="space-y-8 p-5">
          {issues.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-sun-400/10 px-4 py-3 text-sm font-semibold text-sun-300" aria-label="Što još nedostaje">
              {issues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          )}

          <div>
            <label htmlFor={`${question.id}-title`} className="mb-2 block font-display text-lg font-bold">
              {question.type === "true_false" ? "Tvrdnja" : "Pitanje"}
            </label>
            <Textarea
              id={`${question.id}-title`}
              value={question.title}
              maxLength={LIMITS.questionTitle}
              placeholder={QUESTION_TYPE_META[question.type].example}
              onChange={(e) => set("title", e.target.value)}
              className="min-h-20 font-display text-xl font-bold"
            />
          </div>

          {question.type !== "pin_image" && (
            <details open={Boolean(question.media)} className="group">
              <summary className="cursor-pointer font-display text-lg font-bold">
                Slika uz pitanje <span className="text-sm font-semibold text-ink-subtle">(neobavezno)</span>
              </summary>
              <ImageField className="mt-3 max-w-md" value={question.media} onChange={(media) => set("media", media)} />
            </details>
          )}

          <TypeEditor question={question} onChange={onChange} />

          <div>
            <h3 className="mb-3 font-display text-lg font-bold">Postavke pitanja</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${question.id}-time`} className="text-sm font-semibold text-ink-muted">
                  Vrijeme za odgovor
                </label>
                <select id={`${question.id}-time`} className={selectClass} value={question.timeLimit} onChange={(e) => set("timeLimit", Number(e.target.value))}>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t < 60 ? `${t} s` : `${t / 60} min`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${question.id}-points`} className="text-sm font-semibold text-ink-muted">
                  Bodovi
                </label>
                <select
                  id={`${question.id}-points`}
                  className={selectClass}
                  value={scored ? question.points : "none"}
                  disabled={!scored}
                  onChange={(e) => set("points", e.target.value as Question["points"])}
                >
                  <option value="standard">Standardno</option>
                  <option value="double">Dvostruko</option>
                  <option value="none">Bez bodova (ne ulazi u poredak)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${question.id}-feedback`} className="text-sm font-semibold text-ink-muted">
                  Povratna informacija
                </label>
                <select
                  id={`${question.id}-feedback`}
                  className={selectClass}
                  value={question.feedback}
                  onChange={(e) => set("feedback", e.target.value as Question["feedback"])}
                >
                  <option value="on_close">Kad pitanje završi</option>
                  <option value="immediate">Odmah nakon odgovora</option>
                </select>
              </div>
            </div>
            {!scored && <p className="mt-2 text-sm text-ink-subtle">Ankete i rangiranja nikad ne donose bodove.</p>}
          </div>

          <div>
            <label htmlFor={`${question.id}-explanation`} className="mb-2 block font-display text-lg font-bold">
              Objašnjenje <span className="text-sm font-semibold text-ink-subtle">(prikazuje se nakon odgovora)</span>
            </label>
            <Textarea
              id={`${question.id}-explanation`}
              value={question.explanation}
              maxLength={LIMITS.explanation}
              placeholder="Zanimljivost ili objašnjenje točnog odgovora…"
              onChange={(e) => set("explanation", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
