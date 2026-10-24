"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { ShapeIcon, answerStyle } from "@/components/brand/shapes";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/switch";
import { createId } from "@/lib/domain/random";
import { LIMITS, type QuestionOf } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";
import { ImageField } from "./image-field";
import { SectionTitle, produce } from "./primitives";

type ChoiceQuestion = QuestionOf<"single_choice"> | QuestionOf<"multi_select"> | QuestionOf<"poll">;

export function ChoiceEditor<Q extends ChoiceQuestion>({ question, onChange }: { question: Q; onChange: (q: Q) => void }) {
  const { options } = question.config;
  const isCorrect = (id: string) =>
    question.type === "single_choice"
      ? question.config.correctOptionId === id
      : question.type === "multi_select"
        ? question.config.correctOptionIds.includes(id)
        : false;

  const toggleCorrect = (id: string) =>
    onChange(
      produce(question, (q) => {
        if (q.type === "single_choice") q.config.correctOptionId = id;
        if (q.type === "multi_select") {
          const set = new Set(q.config.correctOptionIds);
          if (set.has(id)) set.delete(id);
          else set.add(id);
          q.config.correctOptionIds = q.config.options.map((o) => o.id).filter((oid) => set.has(oid));
        }
      }),
    );

  return (
    <div>
      <SectionTitle
        hint={
          question.type === "single_choice"
            ? "Označite kvačicom jedan točan odgovor."
            : question.type === "multi_select"
              ? "Označite sve točne odgovore. Igračima ćemo napomenuti da ih može biti više."
              : "Anketa nema točnog odgovora i ne donosi bodove."
        }
      >
        Odgovori
      </SectionTitle>
      <ul className="grid gap-3 md:grid-cols-2">
        {options.map((option, index) => {
          const style = answerStyle(index);
          const correct = isCorrect(option.id);
          return (
            <li key={option.id} className={cn("rounded-xl p-2.5 ring-2 transition-colors", correct ? "bg-mint-400/10 ring-mint-400" : "bg-night-950/40 ring-white/8")}>
              <div className="flex items-center gap-2">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg text-white", style.bg)}>
                  <ShapeIcon shape={style.shape} className="size-5" />
                </span>
                <input
                  value={option.text}
                  maxLength={LIMITS.optionText}
                  placeholder={`Odgovor ${index + 1}${index < 2 ? "" : " (neobavezno)"}`}
                  aria-label={`Odgovor ${index + 1}`}
                  onChange={(e) =>
                    onChange(
                      produce(question, (q) => {
                        q.config.options[index]!.text = e.target.value;
                      }),
                    )
                  }
                  className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-semibold placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                />
                {question.type !== "poll" && (
                  <button
                    type="button"
                    role={question.type === "single_choice" ? "radio" : "checkbox"}
                    aria-checked={correct}
                    aria-label={`Odgovor ${index + 1} je točan`}
                    onClick={() => toggleCorrect(option.id)}
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full ring-2 transition-colors",
                      correct ? "bg-mint-400 text-night-950 ring-mint-400" : "text-transparent ring-white/25 hover:ring-mint-400/70",
                    )}
                  >
                    <Check className="size-5" strokeWidth={3} />
                  </button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Ukloni odgovor ${index + 1}`}
                  disabled={options.length <= LIMITS.minOptions}
                  onClick={() =>
                    onChange(
                      produce(question, (q) => {
                        const [removed] = q.config.options.splice(index, 1);
                        if (q.type === "single_choice" && removed && q.config.correctOptionId === removed.id) q.config.correctOptionId = null;
                        if (q.type === "multi_select" && removed) q.config.correctOptionIds = q.config.correctOptionIds.filter((id) => id !== removed.id);
                      }),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <details className="mt-1 px-1">
                <summary className="cursor-pointer text-xs font-semibold text-ink-subtle hover:text-ink">
                  {option.media ? "Slika dodana" : "Dodaj sliku uz odgovor"}
                </summary>
                <ImageField
                  className="mt-2"
                  compact
                  aspect="aspect-[4/3]"
                  value={option.media}
                  onChange={(media) =>
                    onChange(
                      produce(question, (q) => {
                        q.config.options[index]!.media = media;
                      }),
                    )
                  }
                />
              </details>
            </li>
          );
        })}
      </ul>
      {options.length < LIMITS.maxOptions && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() =>
            onChange(
              produce(question, (q) => {
                q.config.options.push({ id: createId(), text: "", media: null });
              }),
            )
          }
        >
          <Plus /> Dodaj odgovor
        </Button>
      )}
      <div className="mt-5 divide-y divide-white/6">
        {question.type === "multi_select" && (
          <SwitchRow
            id={`${question.id}-partial`}
            label="Djelomično bodovanje"
            description="Bodovi za svaki točno označen odgovor, umanjeno za pogrešno označene."
            checked={question.config.partialCredit}
            onCheckedChange={(v) => onChange(produce(question, (q) => void ((q as QuestionOf<"multi_select">).config.partialCredit = v)))}
          />
        )}
        {question.type === "poll" && (
          <SwitchRow
            id={`${question.id}-voters`}
            label="Prikaži tko je za što glasao"
            description="Isključeno: prikazuju se samo brojevi glasova."
            checked={question.config.showVoterNames}
            onCheckedChange={(v) => onChange(produce(question, (q) => void ((q as QuestionOf<"poll">).config.showVoterNames = v)))}
          />
        )}
      </div>
    </div>
  );
}

export function TrueFalseEditor({ question, onChange }: { question: QuestionOf<"true_false">; onChange: (q: QuestionOf<"true_false">) => void }) {
  return (
    <div>
      <SectionTitle hint="Je li tvrdnja u pitanju točna?">Točan odgovor</SectionTitle>
      <div role="radiogroup" aria-label="Točan odgovor" className="grid grid-cols-2 gap-3">
        {[
          { value: true, label: "Točno", cls: "bg-mint-500" },
          { value: false, label: "Netočno", cls: "bg-coral-500" },
        ].map((item) => {
          const selected = question.config.correct === item.value;
          return (
            <button
              key={String(item.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(produce(question, (q) => void (q.config.correct = item.value)))}
              className={cn(
                "flex h-24 items-center justify-center gap-2 rounded-2xl font-display text-2xl font-extrabold text-white transition-all",
                item.cls,
                selected ? "ring-4 ring-white" : "opacity-45 hover:opacity-80",
              )}
            >
              {selected && <Check className="size-6" strokeWidth={3} />} {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ImageChoiceEditor({ question, onChange }: { question: QuestionOf<"image_choice">; onChange: (q: QuestionOf<"image_choice">) => void }) {
  const { options } = question.config;
  return (
    <div>
      <SectionTitle hint="Dodajte 2–6 slika i označite točnu.">Slike kao odgovori</SectionTitle>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {options.map((option, index) => {
          const style = answerStyle(index);
          const correct = question.config.correctOptionId === option.id;
          return (
            <li key={option.id} className={cn("rounded-xl p-2 ring-2", correct ? "bg-mint-400/10 ring-mint-400" : "bg-night-950/40 ring-white/8")}>
              <ImageField
                aspect="aspect-square"
                compact
                value={option.media}
                onChange={(media) => onChange(produce(question, (q) => void (q.config.options[index]!.media = media)))}
              />
              <input
                value={option.caption}
                maxLength={LIMITS.optionText}
                placeholder="Opis (neobavezno)"
                aria-label={`Opis slike ${index + 1}`}
                onChange={(e) => onChange(produce(question, (q) => void (q.config.options[index]!.caption = e.target.value)))}
                className="mt-2 h-9 w-full rounded-lg bg-night-950/60 px-2.5 text-sm ring-1 ring-white/10 placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              />
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className={cn("grid size-7 place-items-center rounded-md text-white", style.bg)}>
                  <ShapeIcon shape={style.shape} className="size-4" />
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={correct}
                    aria-label={`Slika ${index + 1} je točna`}
                    onClick={() => onChange(produce(question, (q) => void (q.config.correctOptionId = option.id)))}
                    className={cn(
                      "flex h-8 items-center gap-1 rounded-full px-3 text-xs font-bold ring-2",
                      correct ? "bg-mint-400 text-night-950 ring-mint-400" : "text-ink-subtle ring-white/20 hover:ring-mint-400/60",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} /> Točno
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ukloni sliku ${index + 1}`}
                    disabled={options.length <= LIMITS.minOptions}
                    onClick={() =>
                      onChange(
                        produce(question, (q) => {
                          const [removed] = q.config.options.splice(index, 1);
                          if (removed && q.config.correctOptionId === removed.id) q.config.correctOptionId = null;
                        }),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {options.length < LIMITS.maxOptions && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => onChange(produce(question, (q) => void q.config.options.push({ id: createId(), media: null, caption: "" })))}
        >
          <Plus /> Dodaj sliku
        </Button>
      )}
    </div>
  );
}
