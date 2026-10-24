"use client";

import { Plus, Trash2 } from "lucide-react";
import { Slider } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchRow } from "@/components/ui/switch";
import { LIMITS, type QuestionOf } from "@/lib/domain/schema";
import { formatNumber } from "@/lib/utils";
import { LabeledNumber, SectionTitle, produce } from "./primitives";

export function SliderEditor({ question, onChange }: { question: QuestionOf<"slider">; onChange: (q: QuestionOf<"slider">) => void }) {
  const c = question.config;
  const set = <K extends keyof typeof c>(key: K, value: (typeof c)[K]) => onChange(produce(question, (q) => void (q.config[key] = value)));
  const rangeOk = c.min < c.max && c.step > 0;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Raspon i korak klizača koji igrači vide.">Klizač</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <LabeledNumber label="Najmanje" value={c.min} onChange={(v) => set("min", v ?? 0)} />
          <LabeledNumber label="Najviše" value={c.max} onChange={(v) => set("max", v ?? 0)} />
          <LabeledNumber label="Korak" value={c.step} onChange={(v) => set("step", v && v > 0 ? v : 1)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${question.id}-unit`} className="text-sm font-semibold text-ink-muted">
              Jedinica
            </label>
            <Input id={`${question.id}-unit`} value={c.unit} maxLength={LIMITS.unit} placeholder="npr. m, kg, €" onChange={(e) => set("unit", e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <SectionTitle hint="Povucite klizač ili upišite broj.">Točna vrijednost</SectionTitle>
        <div className="surface-flat rounded-xl p-5">
          <p className="text-center font-display text-4xl font-extrabold tabular-nums text-sun-300">
            {c.target === null ? "—" : `${formatNumber(c.target)}${c.unit ? ` ${c.unit}` : ""}`}
          </p>
          {rangeOk && (
            <Slider.Root
              className="relative mt-5 flex h-8 touch-none select-none items-center"
              min={c.min}
              max={c.max}
              step={c.step}
              value={[c.target ?? c.min]}
              onValueChange={([v]) => set("target", v ?? null)}
              aria-label="Točna vrijednost"
            >
              <Slider.Track className="relative h-3 grow rounded-full bg-white/10">
                <Slider.Range className="absolute h-full rounded-full bg-sun-400" />
              </Slider.Track>
              <Slider.Thumb className="block size-7 rounded-full bg-white shadow-lg ring-4 ring-sun-400 focus-visible:outline-none focus-visible:ring-cyan-300" />
            </Slider.Root>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <LabeledNumber label="Točno" value={c.target} allowNull onChange={(v) => set("target", v)} />
            <LabeledNumber
              label={`Tolerancija (±${c.unit || ""})`}
              value={c.tolerance}
              onChange={(v) => set("tolerance", Math.max(0, v ?? 0))}
              hint="Koliko odgovor smije odstupati."
            />
          </div>
        </div>
      </div>
      <div className="divide-y divide-white/6">
        <SwitchRow id={`${question.id}-exact`} label="Samo točna vrijednost" description="Tolerancija se zanemaruje — priznaje se samo točan broj." checked={c.exactMatch} onCheckedChange={(v) => set("exactMatch", v)} />
        <SwitchRow
          id={`${question.id}-graded`}
          label="Bodovi prema blizini"
          description="Unutar tolerancije: 100 % bodova na točnoj vrijednosti, 50 % na rubu tolerancije."
          checked={c.graded}
          disabled={c.exactMatch}
          onCheckedChange={(v) => set("graded", v)}
        />
      </div>
    </div>
  );
}

export function NumericEditor({ question, onChange }: { question: QuestionOf<"numeric">; onChange: (q: QuestionOf<"numeric">) => void }) {
  const c = question.config;
  const set = <K extends keyof typeof c>(key: K, value: (typeof c)[K]) => onChange(produce(question, (q) => void (q.config[key] = value)));
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Igrači upisuju broj, a provjera se radi na serveru.">Točan broj</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <LabeledNumber label="Točan broj" value={c.target} allowNull onChange={(v) => set("target", v)} />
          <LabeledNumber label="Tolerancija (±)" value={c.tolerance} onChange={(v) => set("tolerance", Math.max(0, v ?? 0))} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${question.id}-nunit`} className="text-sm font-semibold text-ink-muted">
              Jedinica
            </label>
            <Input id={`${question.id}-nunit`} value={c.unit} maxLength={LIMITS.unit} placeholder="npr. km" onChange={(e) => set("unit", e.target.value)} />
          </div>
          <LabeledNumber label="Najmanji dopušteni unos" value={c.min} allowNull placeholder="bez ograničenja" onChange={(v) => set("min", v)} />
          <LabeledNumber label="Najveći dopušteni unos" value={c.max} allowNull placeholder="bez ograničenja" onChange={(v) => set("max", v)} />
        </div>
      </div>
      <SwitchRow id={`${question.id}-decimals`} label="Dopusti decimalne brojeve" description="Isključeno: prihvaćaju se samo cijeli brojevi." checked={c.allowDecimals} onCheckedChange={(v) => set("allowDecimals", v)} />
    </div>
  );
}

export function ShortAnswerEditor({ question, onChange }: { question: QuestionOf<"short_answer">; onChange: (q: QuestionOf<"short_answer">) => void }) {
  const c = question.config;
  const set = <K extends keyof typeof c>(key: K, value: (typeof c)[K]) => onChange(produce(question, (q) => void (q.config[key] = value)));
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle hint="Odgovor se priznaje samo ako se podudara s nekom od ovih varijanti (bez nagađanja).">Prihvatljivi odgovori</SectionTitle>
        <ul className="space-y-2">
          {c.acceptedAnswers.map((answer, index) => (
            <li key={index} className="flex gap-2">
              <Input
                value={answer}
                maxLength={LIMITS.shortAnswerMax}
                placeholder={index === 0 ? "Glavni odgovor" : "Druga varijanta ili pravopis"}
                aria-label={`Prihvatljiv odgovor ${index + 1}`}
                onChange={(e) => onChange(produce(question, (q) => void (q.config.acceptedAnswers[index] = e.target.value)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Ukloni odgovor ${index + 1}`}
                onClick={() => onChange(produce(question, (q) => void q.config.acceptedAnswers.splice(index, 1)))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        {c.acceptedAnswers.length < LIMITS.acceptedAnswers && (
          <Button type="button" variant="secondary" className="mt-3" onClick={() => onChange(produce(question, (q) => void q.config.acceptedAnswers.push("")))}>
            <Plus /> Dodaj varijantu
          </Button>
        )}
      </div>
      <div className="divide-y divide-white/6">
        <SwitchRow id={`${question.id}-case`} label="Razlikuj velika i mala slova" checked={c.caseSensitive} onCheckedChange={(v) => set("caseSensitive", v)} />
        <SwitchRow
          id={`${question.id}-accents`}
          label="Razlikuj dijakritike"
          description="Isključeno: „cakovec” se priznaje kao „Čakovec”."
          checked={c.accentSensitive}
          onCheckedChange={(v) => set("accentSensitive", v)}
        />
        <SwitchRow
          id={`${question.id}-ws`}
          label="Zanemari suvišne razmake"
          checked={c.normalizeWhitespace}
          onCheckedChange={(v) => set("normalizeWhitespace", v)}
        />
        <SwitchRow id={`${question.id}-multi`} label="Višeredni unos" checked={c.multiline} onCheckedChange={(v) => set("multiline", v)} />
        <SwitchRow
          id={`${question.id}-review`}
          label="Ručni pregled"
          description="Odgovori koji se ne podudaraju čekaju vašu odluku na ekranu rezultata umjesto da budu netočni."
          checked={c.manualReview}
          onCheckedChange={(v) => set("manualReview", v)}
        />
      </div>
      <div className="max-w-xs">
        <LabeledNumber
          label="Najveća duljina odgovora"
          value={c.maxLength}
          onChange={(v) => set("maxLength", Math.min(LIMITS.shortAnswerMax, Math.max(1, Math.round(v ?? 80))))}
        />
      </div>
    </div>
  );
}
