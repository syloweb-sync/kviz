"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Dumbbell, Hand, Play, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchRow } from "@/components/ui/switch";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { DEFAULT_GAME_SETTINGS, gameSettingsSchema, type GameMode, type GameSettings } from "@/lib/domain/schema";
import type { ValidationIssue } from "@/lib/domain/validation";
import { cn, plural } from "@/lib/utils";

const MODES: { key: Exclude<GameMode, "practice">; title: string; text: string; icon: typeof Trophy; tone: string }[] = [
  { key: "classic", title: "Klasično", text: "Pitanje po pitanje, s vremenom i bonusom za brzinu. Pitanje se zatvara kad svi odgovore.", icon: Trophy, tone: "bg-violet-500" },
  { key: "team", title: "Timovi", text: "Igrači biraju tim, a pobjeđuje tim s najboljim prosjekom bodova.", icon: Users, tone: "bg-cyan-500" },
  { key: "host_controlled", title: "Ručno vođenje", text: "Vi odlučujete kad se pitanje zatvara i otkriva — za opušteniji tempo.", icon: Hand, tone: "bg-coral-500" },
];

const TIMER_OPTIONS = [null, 10, 15, 20, 30, 45, 60, 90, 120];

export function GameSetup({ quizId, title, questionCount, issues }: { quizId: string; title: string; questionCount: number; issues: ValidationIssue[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Exclude<GameMode, "practice">>("classic");
  const [starting, setStarting] = useState(false);
  const form = useForm<z.input<typeof gameSettingsSchema>, unknown, GameSettings>({
    resolver: zodResolver(gameSettingsSchema),
    defaultValues: DEFAULT_GAME_SETTINGS,
  });
  const teamNames = form.watch("teamNames") ?? [];

  const start = form.handleSubmit(async (settings) => {
    setStarting(true);
    try {
      const { sessionId } = await apiFetch<{ sessionId: string; pin: string }>("/api/games", {
        method: "POST",
        body: { quizId, mode, settings },
      });
      router.push(`/host/${sessionId}`);
    } catch (error) {
      setStarting(false);
      toast.error(error instanceof ApiClientError ? error.message : "Igra nije pokrenuta.");
    }
  });

  const toggles: { name: keyof GameSettings; label: string; description: string }[] = [
    { name: "speedBonus", label: "Bonus za brzinu", description: "Brži točni odgovori donose do 50 % više bodova." },
    { name: "showLeaderboard", label: "Poredak nakon svakog pitanja", description: "Između pitanja prikazuje se ljestvica." },
    { name: "showCorrectAnswers", label: "Prikaži točne odgovore", description: "Nakon svakog pitanja otkriva se točan odgovor." },
    { name: "showExplanations", label: "Prikaži objašnjenja", description: "Ako pitanje ima objašnjenje, prikazuje se uz rezultate." },
    { name: "randomizeQuestions", label: "Izmiješaj pitanja", description: "Pitanja dolaze nasumičnim redom." },
    { name: "randomizeAnswers", label: "Izmiješaj odgovore", description: "Ponuđeni odgovori dolaze nasumičnim redom (gdje ima smisla)." },
    { name: "allowLateJoin", label: "Dopusti kasni ulazak", description: "Igrači se mogu pridružiti i nakon početka." },
    { name: "allowAnswerChange", label: "Dopusti promjenu odgovora", description: "Do isteka vremena igrač može promijeniti odgovor." },
    { name: "nicknameFilter", label: "Filtar nadimaka", description: "Odbija uvredljive nadimke." },
    { name: "soundEffects", label: "Zvučni efekti", description: "Zvukovi na ekranu domaćina (uvijek se mogu utišati)." },
    { name: "music", label: "Glazba u predvorju", description: "Lagana pozadinska melodija dok se igrači skupljaju." },
    { name: "reducedMotion", label: "Smanjene animacije", description: "Manje pokreta na zaslonu za sve sudionike." },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-6 sm:px-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/quizzes/${quizId}/edit`}>
          <ArrowLeft /> Natrag na kviz
        </Link>
      </Button>
      <h1 className="mt-6 font-display text-4xl font-extrabold sm:text-5xl">Nova igra</h1>
      <p className="mt-2 text-lg text-ink-muted">
        {title || "Kviz bez naslova"} · {questionCount} {plural(questionCount, "pitanje", "pitanja", "pitanja")}
      </p>

      {issues.length > 0 ? (
        <div className="surface mt-8 rounded-2xl p-6">
          <h2 className="font-display text-2xl font-bold text-sun-300">Kviz još nije spreman</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-ink-muted">
            {issues.slice(0, 8).map((issue, i) => (
              <li key={i}>
                {issue.questionIndex === null ? "" : `Pitanje ${issue.questionIndex + 1}: `}
                {issue.message}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-5">
            <Link href={`/quizzes/${quizId}/edit`}>Dovrši kviz</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={start} className="mt-8 space-y-8">
          <fieldset>
            <legend className="font-display text-xl font-bold">Način igre</legend>
            <div className="mt-4 grid gap-3 md:grid-cols-3" role="radiogroup">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.key}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "rounded-2xl p-5 text-left ring-2 transition-all",
                    mode === m.key ? "bg-night-600 ring-violet-400" : "bg-night-800/70 ring-white/8 hover:ring-white/20",
                  )}
                >
                  <span className={cn("grid size-11 place-items-center rounded-xl text-night-950", m.tone)}>
                    <m.icon className="size-5" />
                  </span>
                  <span className="mt-3 block font-display text-lg font-bold">{m.title}</span>
                  <span className="mt-1 block text-sm text-ink-subtle">{m.text}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-subtle">
              Želite igrati sami?{" "}
              <Link href={`/practice/${quizId}`} className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:underline">
                <Dumbbell className="size-4" /> Pokrenite vježbu
              </Link>
            </p>
          </fieldset>

          {mode === "team" && (
            <fieldset className="surface rounded-2xl p-5">
              <legend className="sr-only">Timovi</legend>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Timovi</h2>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={teamNames.length <= 2} onClick={() => form.setValue("teamNames", teamNames.slice(0, -1))}>
                    − Tim
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={teamNames.length >= 4}
                    onClick={() => form.setValue("teamNames", [...teamNames, ["Koralji", "Cijani", "Sunca", "Mente"][teamNames.length] ?? `Tim ${teamNames.length + 1}`])}
                  >
                    + Tim
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {teamNames.map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={cn("size-4 shrink-0 rounded-full", ["bg-coral-500", "bg-cyan-500", "bg-sun-500", "bg-mint-500"][i])} />
                    <Input aria-label={`Naziv tima ${i + 1}`} maxLength={24} {...form.register(`teamNames.${i}` as const)} />
                  </div>
                ))}
              </div>
              {form.formState.errors.teamNames && <p className="mt-2 text-sm text-coral-400">Svaki tim treba naziv.</p>}
            </fieldset>
          )}

          <fieldset className="surface rounded-2xl p-5">
            <legend className="sr-only">Postavke</legend>
            <h2 className="font-display text-xl font-bold">Postavke</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-muted">Vrijeme po pitanju</span>
                <Controller
                  control={form.control}
                  name="timerOverride"
                  render={({ field }) => (
                    <select
                      className="h-11 rounded-lg bg-night-950/60 px-3 font-semibold ring-1 ring-white/12"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    >
                      {TIMER_OPTIONS.map((t) => (
                        <option key={t ?? "q"} value={t ?? ""}>
                          {t === null ? "Kako je zadano u pitanju" : `${t} s za svako pitanje`}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-muted">Osnovni bodovi</span>
                <Controller
                  control={form.control}
                  name="basePoints"
                  render={({ field }) => (
                    <select className="h-11 rounded-lg bg-night-950/60 px-3 font-semibold ring-1 ring-white/12" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}>
                      {[500, 1000, 2000].map((p) => (
                        <option key={p} value={p}>
                          {p} po pitanju
                        </option>
                      ))}
                    </select>
                  )}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-muted">Najviše igrača</span>
                <Controller
                  control={form.control}
                  name="maxPlayers"
                  render={({ field }) => (
                    <select className="h-11 rounded-lg bg-night-950/60 px-3 font-semibold ring-1 ring-white/12" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}>
                      {[10, 20, 30, 50, 100].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </label>
            </div>
            <div className="mt-4 grid gap-x-8 divide-white/6 md:grid-cols-2">
              {toggles.map((t) => (
                <Controller
                  key={t.name}
                  control={form.control}
                  name={t.name}
                  render={({ field }) => (
                    <SwitchRow id={`setting-${t.name}`} label={t.label} description={t.description} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  )}
                />
              ))}
            </div>
          </fieldset>

          <div className="sticky bottom-4 z-10">
            <Button type="submit" size="xl" variant="accent" className="w-full" loading={starting}>
              <Play /> Otvori predvorje i PIN
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
