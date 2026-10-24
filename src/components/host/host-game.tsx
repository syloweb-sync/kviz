"use client";

import {
  Check,
  Expand,
  Flag,
  LayoutDashboard,
  Minimize,
  Music,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  UserX,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { FloatingShapes, ShapeIcon, answerStyle } from "@/components/brand/shapes";
import {
  Avatar,
  ConnectionBadge,
  CountdownRing,
  LeadIn,
  Leaderboard,
  Podium,
  SoundToggle,
  TEAM_BG,
  TeamStandings,
  useCountdown,
  useMuted,
} from "@/components/game/game-ui";
import { QuestionStage } from "@/components/game/question-stage";
import { RevealView } from "@/components/game/reveal";
import { useGame } from "@/components/game/use-game";
import { Button, Spinner } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { ApiClientError } from "@/lib/client/api";
import { playSound, startMusic, stopMusic, unlockAudio } from "@/lib/client/sound";
import type { PublicQuestion } from "@/lib/domain/public-view";
import type { GameView } from "@/lib/game/types";
import { mediaUrl } from "@/lib/media";
import { cn, formatNumber, plural } from "@/lib/utils";

type GameHook = ReturnType<typeof useGame>;

export function HostGame({ sessionId, quizId }: { sessionId: string; quizId: string | null }) {
  const game = useGame({ sessionId, token: null, role: "host" });
  const { view, error, connection } = game;
  const [busy, setBusy] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const muted = useMuted();

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy) return;
      setBusy(true);
      unlockAudio();
      try {
        await game.act(body);
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "stale_version") {
          await game.refresh();
        } else {
          toast.error(err instanceof ApiClientError ? err.message : "Radnja nije uspjela.");
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, game],
  );

  // Lobby music (optional, host setting + local mute).
  const musicWanted = view?.session.state === "lobby" && view.session.settings.music && !muted;
  useEffect(() => {
    if (!musicWanted) return;
    const start = () => startMusic();
    start();
    window.addEventListener("pointerdown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      stopMusic();
    };
  }, [musicWanted]);

  // Join sound when the lobby grows.
  const lastCount = useRef(0);
  useEffect(() => {
    if (!view) return;
    if (view.session.state === "lobby" && view.playerCount > lastCount.current && lastCount.current > 0 && view.session.settings.soundEffects) playSound("join");
    lastCount.current = view.playerCount;
  }, [view]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const primary = view ? primaryAction(view) : null;

  // Keyboard: Space/Enter = primary action, P = pause/resume.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      if ((e.key === " " || e.key === "Enter") && primary && !primary.disabled) {
        e.preventDefault();
        void act({ action: primary.action, expectedVersion: view?.session.version ?? null });
      }
      if ((e.key === "p" || e.key === "P") && view?.session.state === "question_active") {
        void act({ action: view.session.pausedRemainingMs !== null ? "resume" : "pause", expectedVersion: view.session.version });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary, act, view]);

  if (error && !view) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{error.kind === "forbidden" ? "Ovo nije vaša igra" : "Igra nije dostupna"}</h1>
          <p className="mt-2 text-ink-muted">{error.message}</p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">Na moje kvizove</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-10 text-violet-400" />
      </div>
    );
  }

  const s = view.session;
  const terminal = s.state === "finished" || s.state === "cancelled";

  return (
    <div className={cn("relative flex min-h-dvh flex-col", s.settings.reducedMotion && "reduce-motion")}>
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Logo href="/dashboard" className="[&>span]:hidden md:[&>span]:inline" />
          <div className="min-w-0">
            <p className="truncate font-display font-bold">{s.quizTitle}</p>
            {s.state !== "lobby" && !terminal && (
              <p className="text-sm font-bold text-ink-subtle">
                Pitanje {s.currentIndex + 1} / {s.totalQuestions} · PIN {s.pin}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ConnectionBadge state={connection} />
          <span className="hidden items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-sm font-bold sm:flex">
            <Users className="size-4" /> {view.playerCount}
          </span>
          {s.settings.music && s.state === "lobby" && <Music className="size-4 text-ink-subtle" aria-label="Glazba uključena" />}
          <SoundToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label={fullscreen ? "Izađi iz cijelog zaslona" : "Cijeli zaslon"}
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
          >
            {fullscreen ? <Minimize /> : <Expand />}
          </Button>
          {!terminal && (
            <Button variant="ghost" size="sm" onClick={() => setEndOpen(true)} className="text-coral-400">
              <Square className="size-4" /> <span className="hidden sm:inline">Završi</span>
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-28 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${s.state}-${s.currentIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col"
          >
            {s.state === "lobby" && <HostLobby view={view} game={game} act={act} />}
            {s.state === "question_active" && <HostQuestion view={view} game={game} />}
            {s.state === "question_revealing" && <HostReveal view={view} act={act} />}
            {s.state === "leaderboard" && <HostLeaderboard view={view} />}
            {s.state === "finished" && <HostFinished view={view} quizId={quizId} />}
            {s.state === "cancelled" && (
              <div className="grid flex-1 place-items-center text-center">
                <div>
                  <h1 className="font-display text-4xl font-extrabold">Igra je otkazana</h1>
                  <Button asChild className="mt-6">
                    <Link href="/dashboard">Na moje kvizove</Link>
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {primary && !terminal && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/6 bg-night-900/90 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="hidden items-center gap-2 text-sm text-ink-subtle md:flex">
              <Kbd>Razmak</Kbd> {primary.label}
              {s.state === "question_active" && (
                <>
                  <span className="mx-2">·</span> <Kbd>P</Kbd> pauza
                </>
              )}
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              {s.state === "question_active" && (
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={busy}
                  onClick={() => void act({ action: s.pausedRemainingMs !== null ? "resume" : "pause", expectedVersion: s.version })}
                >
                  {s.pausedRemainingMs !== null ? <Play /> : <Pause />}
                  {s.pausedRemainingMs !== null ? "Nastavi" : "Pauza"}
                </Button>
              )}
              <Button
                size="lg"
                variant={primary.action === "start" ? "accent" : "primary"}
                disabled={primary.disabled}
                loading={busy}
                onClick={() => void act({ action: primary.action, expectedVersion: s.version })}
              >
                {primary.icon} {primary.label}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title={s.state === "lobby" ? "Otkazati igru?" : "Završiti igru sada?"}
        description={s.state === "lobby" ? "Igrači u predvorju bit će obaviješteni da je igra otkazana." : "Igra se odmah završava i prikazuje se konačni poredak s trenutačnim bodovima."}
        confirmLabel={s.state === "lobby" ? "Otkaži igru" : "Završi igru"}
        onConfirm={() => {
          setEndOpen(false);
          void act({ action: "end", expectedVersion: null });
        }}
      />
    </div>
  );
}

function primaryAction(view: GameView): { action: string; label: string; icon: React.ReactNode; disabled: boolean } | null {
  const s = view.session;
  const last = s.currentIndex >= s.totalQuestions - 1;
  switch (s.state) {
    case "lobby":
      return { action: "start", label: "Započni igru", icon: <Play />, disabled: view.playerCount === 0 };
    case "question_active":
      return { action: "close_question", label: s.manualPacing ? "Otkrij odgovor" : "Završi pitanje", icon: <Flag />, disabled: false };
    case "question_revealing":
      return {
        action: "next",
        label: last ? "Konačni poredak" : s.settings.showLeaderboard ? "Poredak" : "Sljedeće pitanje",
        icon: <SkipForward />,
        disabled: false,
      };
    case "leaderboard":
      return { action: "next", label: last ? "Konačni poredak" : "Sljedeće pitanje", icon: <SkipForward />, disabled: false };
    default:
      return null;
  }
}

function HostLobby({ view, game, act }: { view: GameView; game: GameHook; act: (b: Record<string, unknown>) => Promise<void> }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const pin = view.session.pin ?? "";
  const joinUrl = `${origin}/join?pin=${pin}`;
  const teams = view.session.teamsEnabled ? view.teams.slice().sort((a, b) => a.position - b.position) : [];

  return (
    <div className="relative flex flex-1 flex-col">
      <FloatingShapes className="opacity-40" />
      <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        <div className="surface rounded-3xl p-6 sm:p-8">
          <p className="font-display text-lg font-bold text-ink-muted">
            Otvori <strong className="text-ink">{origin.replace(/^https?:\/\//, "") || "stranicu"}/join</strong> i upiši PIN:
          </p>
          <p className="mt-2 font-display text-7xl font-extrabold tracking-[0.12em] tabular-nums text-ink sm:text-8xl xl:text-9xl" aria-label={`PIN ${pin.split("").join(" ")}`}>
            {pin.slice(0, 3)}
            <span className="text-violet-400"> </span>
            {pin.slice(3)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(joinUrl).then(() => toast.success("Poveznica je kopirana."))}
            >
              Kopiraj poveznicu
            </Button>
            <span className="text-sm text-ink-subtle">{view.session.mode === "team" ? "Timska igra" : view.session.manualPacing ? "Ručno vođenje" : "Klasična igra"}</span>
          </div>
        </div>
        {origin && (
          <div className="mx-auto rounded-3xl bg-white p-4 shadow-[var(--shadow-lift)]">
            <QRCodeSVG value={joinUrl} size={196} bgColor="#ffffff" fgColor="#0d0a26" level="M" marginSize={0} title="QR kod za ulazak u igru" />
          </div>
        )}
      </div>

      <section className="relative mt-8 flex-1" aria-labelledby="lobby-players">
        <div className="flex items-center justify-between">
          <h2 id="lobby-players" className="font-display text-2xl font-extrabold">
            {view.playerCount} {plural(view.playerCount, "igrač", "igrača", "igrača")}
          </h2>
          {view.playerCount === 0 && <p className="animate-pulse-soft font-bold text-ink-subtle">Čekamo prve igrače…</p>}
        </div>
        {teams.length > 0 ? (
          <div className={cn("mt-4 grid gap-4", teams.length > 2 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2")}>
            {teams.map((team) => (
              <div key={team.id} className="surface-flat rounded-2xl p-4">
                <p className={cn("inline-flex rounded-lg px-3 py-1 font-display font-extrabold text-night-950", TEAM_BG[team.color] ?? "bg-violet-500")}>
                  {team.name} · {team.memberCount}
                </p>
                <PlayerChips view={view} game={game} act={act} filter={(p) => p.teamId === team.id} teams={teams} />
              </div>
            ))}
            {view.players.some((p) => !p.teamId) && (
              <div className="surface-flat rounded-2xl p-4">
                <p className="font-bold text-ink-subtle">Bez tima (dodijelit će se automatski)</p>
                <PlayerChips view={view} game={game} act={act} filter={(p) => !p.teamId} teams={teams} />
              </div>
            )}
          </div>
        ) : (
          <PlayerChips view={view} game={game} act={act} filter={() => true} teams={[]} />
        )}
      </section>
    </div>
  );
}

function PlayerChips({
  view,
  game,
  act,
  filter,
  teams,
}: {
  view: GameView;
  game: GameHook;
  act: (b: Record<string, unknown>) => Promise<void>;
  filter: (p: GameView["players"][number]) => boolean;
  teams: GameView["teams"];
}) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2.5" aria-live="polite">
      <AnimatePresence>
        {view.players.filter(filter).map((p) => (
          <motion.li
            key={p.id}
            layout
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className="group flex items-center gap-2 rounded-full bg-night-700 py-1.5 pl-1.5 pr-2 ring-1 ring-white/10"
          >
            <span className="relative">
              <Avatar name={p.nickname} id={p.id} size="sm" />
              <span
                className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-night-700", game.online.has(p.id) ? "bg-mint-400" : "bg-ink-faint")}
                title={game.online.has(p.id) ? "Povezan" : "Nije povezan"}
              />
            </span>
            <span className="max-w-40 truncate text-lg font-bold">{p.nickname}</span>
            {teams.length > 0 && (
              <select
                aria-label={`Tim za ${p.nickname}`}
                value={p.teamId ?? ""}
                onChange={(e) => void act({ action: "assign_team", playerId: p.id, teamId: e.target.value || null })}
                className="h-7 rounded-md bg-night-950/60 px-1 text-xs font-bold"
              >
                <option value="">—</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="grid size-7 place-items-center rounded-full text-ink-faint opacity-60 hover:bg-coral-500 hover:text-white group-hover:opacity-100"
              aria-label={`Ukloni igrača ${p.nickname}`}
              onClick={() => void act({ action: "kick", playerId: p.id })}
            >
              <UserX className="size-4" />
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function OptionsBoard({ question }: { question: PublicQuestion }) {
  const c = question.config;
  if (c.type === "single_choice" || c.type === "multi_select" || c.type === "poll") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {c.options.map((o, i) => {
          const st = answerStyle(i);
          return (
            <div key={o.id} className={cn("flex min-h-20 items-center gap-4 rounded-2xl px-5 font-display text-2xl font-bold text-white xl:min-h-24 xl:text-3xl", st.bg)} style={{ boxShadow: `0 6px 0 0 ${st.shadow}` }}>
              <ShapeIcon shape={st.shape} className="size-9 shrink-0" />
              <span className="break-words">{o.text}</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (c.type === "true_false") {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="flex h-28 items-center justify-center gap-3 rounded-2xl bg-mint-500 font-display text-4xl font-extrabold text-white">
          <Check className="size-10" strokeWidth={3} /> Točno
        </div>
        <div className="flex h-28 items-center justify-center gap-3 rounded-2xl bg-coral-500 font-display text-4xl font-extrabold text-white">
          <X className="size-10" strokeWidth={3} /> Netočno
        </div>
      </div>
    );
  }
  if (c.type === "image_choice") {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {c.options.map((o, i) => (
          <div key={o.id} className={cn("overflow-hidden rounded-2xl ring-4", answerStyle(i).ring)}>
            <QuestionImage media={o.media} />
            {o.caption && <p className="bg-night-800 px-3 py-2 text-center font-bold">{o.caption}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (c.type === "ordering" || c.type === "ranking") {
    const items = c.type === "ordering" ? c.items : c.options;
    return (
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl bg-night-700 px-5 py-3 text-xl font-bold">
            {item.text}
          </li>
        ))}
      </ul>
    );
  }
  if (c.type === "matching") {
    return (
      <div className="grid grid-cols-2 gap-6">
        <ul className="space-y-2">
          {c.left.map((l, i) => (
            <li key={l.id} className={cn("rounded-xl px-5 py-3 text-xl font-bold text-white", answerStyle(i).bg)}>
              {l.text}
            </li>
          ))}
        </ul>
        <ul className="space-y-2">
          {c.right.map((r) => (
            <li key={r.id} className="rounded-xl bg-night-700 px-5 py-3 text-xl font-bold">
              {r.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (c.type === "pin_image" && c.image) {
    return (
      <div className="mx-auto max-h-[48vh] overflow-hidden rounded-2xl" style={{ aspectRatio: `${c.image.width} / ${c.image.height}` }}>
        <QuestionImage media={c.image} contain />
      </div>
    );
  }
  const hints: Record<string, string> = {
    slider: "Procijenite vrijednost klizačem na svom mobitelu.",
    numeric: "Upišite broj na svom mobitelu.",
    short_answer: "Upišite odgovor na svom mobitelu.",
  };
  return <p className="rounded-2xl bg-night-800 px-6 py-8 text-center font-display text-3xl font-bold text-ink-muted">{hints[c.type] ?? "Odgovorite na mobitelu."}</p>;
}

function QuestionImage({ media, contain }: { media: { path: string } | null; contain?: boolean }) {
  const url = mediaUrl(media);
  if (!url) return <div className="aspect-square bg-night-800" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={cn("w-full bg-night-950", contain ? "h-full object-contain" : "aspect-square object-cover")} />;
}

function HostQuestion({ view, game }: { view: GameView; game: GameHook }) {
  const question = view.question!;
  const s = view.session;
  const info = useCountdown(
    { startsAt: s.questionStartsAt, deadline: s.deadline, pausedRemainingMs: s.pausedRemainingMs, limitSeconds: question.timeLimit },
    game.now,
    true,
  );
  const lastTick = useRef<number | null>(null);
  const timeUp = useRef(false);
  useEffect(() => {
    if (!s.settings.soundEffects) return;
    if (info.phase === "running") {
      const sec = Math.ceil(info.remainingMs / 1000);
      if (sec <= 5 && sec !== lastTick.current) {
        lastTick.current = sec;
        playSound("tick");
      }
    }
    if (info.phase === "over" && !timeUp.current) {
      timeUp.current = true;
      playSound("timeUp");
    }
  }, [info.phase, info.remainingMs, s.settings.soundEffects]);

  // When time runs out, ask the server (which closes the question lazily).
  useEffect(() => {
    if (info.phase !== "over" || s.manualPacing) return;
    const t = window.setTimeout(() => void game.refresh(), 800);
    return () => window.clearTimeout(t);
  }, [info.phase, s.manualPacing, game]);

  if (info.phase === "lead_in") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-display text-2xl font-bold text-ink-muted">
          Pitanje {s.currentIndex + 1} od {s.totalQuestions}
        </p>
        <h1 className="mt-4 max-w-5xl font-display text-5xl font-extrabold leading-tight xl:text-6xl">{question.title}</h1>
        <LeadIn ms={info.leadInMs} label="" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pt-2">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <QuestionStage question={question} size="lg" />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3">
          <CountdownRing info={info} size={120} />
          <div className="text-center">
            <p className="font-display text-4xl font-extrabold tabular-nums">
              {view.answeredCount}
              <span className="text-2xl text-ink-subtle">/{view.playerCount}</span>
            </p>
            <p className="text-sm font-bold text-ink-subtle">odgovora</p>
          </div>
        </div>
      </div>
      {info.phase === "paused" && (
        <p className="rounded-2xl bg-sun-400/15 px-6 py-4 text-center font-display text-2xl font-bold text-sun-300" role="status">
          Pauza
        </p>
      )}
      {info.phase === "over" && s.manualPacing && (
        <p className="rounded-2xl bg-cyan-400/10 px-6 py-3 text-center font-bold text-cyan-300">Vrijeme je isteklo — otkrijte odgovor kad ste spremni.</p>
      )}
      <OptionsBoard question={question} />
    </div>
  );
}

function HostReveal({ view, act }: { view: GameView; act: (b: Record<string, unknown>) => Promise<void> }) {
  const question = view.question!;
  useEffect(() => {
    if (view.session.settings.soundEffects) playSound("reveal");
  }, [view.session.settings.soundEffects]);
  const stats = view.reveal?.stats;
  const pending = view.host?.pendingReviews ?? [];
  return (
    <div className="grid flex-1 gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <QuestionStage question={question} size="md" />
        <RevealView question={question} answer={view.reveal?.answer ?? null} stats={stats ?? null} own={null} size="lg" />
        {view.reveal?.explanation && <p className="rounded-2xl bg-violet-500/15 p-5 text-xl">{view.reveal.explanation}</p>}
      </div>
      <aside className="space-y-4">
        {stats && (
          <div className="surface grid grid-cols-2 gap-3 rounded-2xl p-4 text-center">
            <div>
              <p className="font-display text-4xl font-extrabold tabular-nums">{stats.responseCount}</p>
              <p className="text-sm font-bold text-ink-subtle">odgovora</p>
            </div>
            <div>
              <p className="font-display text-4xl font-extrabold tabular-nums text-mint-300">
                {question.type === "poll" || question.type === "ranking" ? "—" : stats.correctCount + stats.partialCount}
              </p>
              <p className="text-sm font-bold text-ink-subtle">točno</p>
            </div>
          </div>
        )}
        {pending.length > 0 && (
          <div className="surface rounded-2xl p-4">
            <h2 className="font-display text-lg font-bold">Pregled odgovora ({pending.length})</h2>
            <p className="text-sm text-ink-subtle">Odgovori koji se ne podudaraju s prihvatljivima.</p>
            <ul className="mt-3 space-y-2">
              {pending.map((r) => (
                <li key={r.answerId} className="flex items-center gap-2 rounded-xl bg-night-950/50 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink-subtle">{r.nickname}</p>
                    <p className="break-words font-bold">„{r.text}”</p>
                  </div>
                  <Button size="icon-sm" variant="secondary" className="text-mint-300" aria-label={`Prihvati odgovor igrača ${r.nickname}`} onClick={() => void act({ action: "review", answerId: r.answerId, accept: true })}>
                    <Check />
                  </Button>
                  <Button size="icon-sm" variant="secondary" className="text-coral-400" aria-label={`Odbij odgovor igrača ${r.nickname}`} onClick={() => void act({ action: "review", answerId: r.answerId, accept: false })}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="surface rounded-2xl p-4">
          <h2 className="mb-3 font-display text-lg font-bold">Trenutačno vode</h2>
          <Leaderboard players={view.players} limit={5} />
        </div>
      </aside>
    </div>
  );
}

function HostLeaderboard({ view }: { view: GameView }) {
  useEffect(() => {
    if (view.session.settings.soundEffects) playSound("leaderboard");
  }, [view.session.settings.soundEffects]);
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 pt-2">
      <h1 className="text-center font-display text-5xl font-extrabold">Poredak</h1>
      {view.session.teamsEnabled && view.teams.length > 0 && <TeamStandings teams={view.teams} big />}
      <Leaderboard players={view.players} limit={10} big teams={view.teams} />
      {view.playerCount > 10 && <p className="text-center text-ink-subtle">+ još {view.playerCount - 10} igrača</p>}
    </div>
  );
}

function HostFinished({ view, quizId }: { view: GameView; quizId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (view.session.settings.soundEffects) playSound("winner");
  }, [view.session.settings.soundEffects]);
  const graded = Math.max(1, view.session.gradedQuestions);
  const podium = view.session.teamsEnabled && view.teams.length
    ? view.teams.map((t) => ({ id: t.id, name: t.name, score: t.score, detail: `${t.memberCount} igr.` }))
    : view.players.map((p) => ({ id: p.id, name: p.nickname, score: p.score, detail: `${p.correctCount} točnih` }));

  return (
    <div className="flex-1 space-y-10 pt-4">
      <div className="text-center">
        <p className="font-display text-xl font-bold text-cyan-300">Kraj igre</p>
        <h1 className="font-display text-5xl font-extrabold sm:text-6xl">
          {podium[0] ? (
            <>
              Pobjednik: <span className="text-gradient">{podium[0].name}</span>
            </>
          ) : (
            "Nitko nije igrao"
          )}
        </h1>
      </div>
      <Podium entries={podium.slice(0, 3)} />
      <div className="mx-auto max-w-4xl">
        {view.session.teamsEnabled && view.teams.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-display text-2xl font-bold">Timovi</h2>
            <TeamStandings teams={view.teams} />
          </div>
        )}
        <h2 className="mb-3 font-display text-2xl font-bold">Konačni poredak</h2>
        <div className="overflow-x-auto rounded-2xl surface">
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
              {view.players.map((p) => (
                <tr key={p.id} className="border-t border-white/6">
                  <td className="px-4 py-2.5 font-display font-extrabold">{p.rank}.</td>
                  <td className="px-4 py-2.5 font-bold">{p.nickname}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.correctCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Math.round((p.correctCount / graded) * 100)} %</td>
                  <td className="px-4 py-2.5 text-right font-display font-extrabold tabular-nums">{formatNumber(p.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {quizId && (
            <Button size="lg" variant="accent" onClick={() => router.push(`/quizzes/${quizId}/host`)}>
              <RotateCcw /> Igraj ponovno
            </Button>
          )}
          <Button asChild size="lg" variant="secondary">
            <Link href={`/dashboard/games/${view.session.id}`}>Detaljni rezultati</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/dashboard">
              <LayoutDashboard /> Na nadzornu ploču
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
