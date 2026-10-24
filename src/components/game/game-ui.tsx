"use client";

import confetti from "canvas-confetti";
import { ArrowDown, ArrowUp, Crown, Minus, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { answerStyle } from "@/components/brand/shapes";
import { Button } from "@/components/ui/button";
import { isMuted, onMuteChange, setMuted, unlockAudio } from "@/lib/client/sound";
import { fnv1a } from "@/lib/domain/random";
import type { TeamStanding } from "@/lib/domain/ranking";
import type { PlayerSummary } from "@/lib/game/types";
import { cn, formatNumber } from "@/lib/utils";
import type { ConnectionState } from "./use-game";

// ---------------------------------------------------------------------------
// Sound toggle & connection status
// ---------------------------------------------------------------------------

export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => onMuteChange(cb) as unknown as () => void,
    isMuted,
    () => false,
  );
}

export function SoundToggle({ className }: { className?: string }) {
  const muted = useMuted();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-pressed={!muted}
      aria-label={muted ? "Uključi zvuk" : "Isključi zvuk"}
      onClick={() => {
        unlockAudio();
        setMuted(!muted);
      }}
    >
      {muted ? <VolumeX /> : <Volume2 />}
    </Button>
  );
}

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const map = {
    live: { label: "Povezano", cls: "text-mint-300", icon: <Wifi className="size-4" /> },
    connecting: { label: "Spajanje…", cls: "text-ink-subtle", icon: <Wifi className="size-4 animate-pulse-soft" /> },
    reconnecting: { label: "Ponovno spajanje…", cls: "text-sun-300", icon: <Wifi className="size-4 animate-pulse-soft" /> },
    offline: { label: "Nema veze", cls: "text-coral-400", icon: <WifiOff className="size-4" /> },
  }[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold", map.cls)} role="status" aria-live="polite">
      {map.icon}
      <span className={state === "live" ? "sr-only sm:not-sr-only" : ""}>{map.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Countdown driven by the server deadline
// ---------------------------------------------------------------------------

export interface CountdownInfo {
  phase: "lead_in" | "running" | "over" | "paused" | "idle";
  remainingMs: number;
  leadInMs: number;
  fraction: number;
}

export function useCountdown(
  timing: { startsAt: number | null; deadline: number | null; pausedRemainingMs: number | null; limitSeconds: number },
  now: () => number,
  active: boolean,
): CountdownInfo {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [active]);

  const limitMs = timing.limitSeconds * 1000;
  if (!active) return { phase: "idle", remainingMs: 0, leadInMs: 0, fraction: 0 };
  if (timing.pausedRemainingMs !== null) {
    return { phase: "paused", remainingMs: Math.min(limitMs, timing.pausedRemainingMs), leadInMs: 0, fraction: Math.min(1, timing.pausedRemainingMs / limitMs) };
  }
  if (timing.startsAt === null || timing.deadline === null) return { phase: "idle", remainingMs: 0, leadInMs: 0, fraction: 0 };
  const t = now();
  if (t < timing.startsAt) return { phase: "lead_in", remainingMs: limitMs, leadInMs: timing.startsAt - t, fraction: 1 };
  const remaining = Math.max(0, timing.deadline - t);
  return { phase: remaining > 0 ? "running" : "over", remainingMs: remaining, leadInMs: 0, fraction: limitMs ? remaining / limitMs : 0 };
}

export function CountdownRing({ info, size = 72 }: { info: CountdownInfo; size?: number }) {
  const seconds = Math.ceil(info.remainingMs / 1000);
  const r = size / 2 - 6;
  const circumference = 2 * Math.PI * r;
  const urgent = info.phase === "running" && seconds <= 5;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="timer" aria-label={`Preostalo ${seconds} sekundi`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.1)" strokeWidth="8" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={urgent ? "var(--color-coral-500)" : "var(--color-cyan-400)"}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - info.fraction)}
          style={{ transition: "stroke-dashoffset 200ms linear, stroke 200ms" }}
        />
      </svg>
      <span className={cn("absolute font-display font-extrabold tabular-nums", urgent && "text-coral-400")} style={{ fontSize: size * 0.36 }}>
        {info.phase === "paused" ? "II" : seconds}
      </span>
    </div>
  );
}

/** Full-width "get ready" overlay shown during the lead-in. */
export function LeadIn({ ms, label }: { ms: number; label: string }) {
  const n = Math.max(1, Math.ceil(ms / 1000));
  return (
    <div className="grid min-h-[50dvh] place-items-center text-center">
      <div>
        <p className="font-display text-xl font-bold text-ink-muted">{label}</p>
        <AnimatePresence mode="popLayout">
          <motion.p
            key={n}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="font-display text-[8rem] font-extrabold leading-none text-sun-300"
          >
            {n}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatars, leaderboard, podium
// ---------------------------------------------------------------------------

export function Avatar({ name, id, size = "md" }: { name: string; id: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const style = answerStyle(fnv1a(id) % 6);
  const sizes = { sm: "size-8 text-sm", md: "size-11 text-lg", lg: "size-16 text-2xl", xl: "size-24 text-4xl" };
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-display font-extrabold text-night-950", style.bg, sizes[size])} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function RankChange({ player }: { player: PlayerSummary }) {
  if (player.previousRank === null) return <Minus className="size-4 text-ink-faint" aria-label="bez promjene" />;
  const diff = player.previousRank - player.rank;
  if (diff > 0)
    return (
      <span className="flex items-center text-sm font-bold text-mint-300" aria-label={`gore ${diff}`}>
        <ArrowUp className="size-4" />
        {diff}
      </span>
    );
  if (diff < 0)
    return (
      <span className="flex items-center text-sm font-bold text-coral-400" aria-label={`dolje ${-diff}`}>
        <ArrowDown className="size-4" />
        {-diff}
      </span>
    );
  return <Minus className="size-4 text-ink-faint" aria-label="bez promjene" />;
}

export function Leaderboard({
  players,
  limit = 10,
  highlightId,
  big,
  teams,
}: {
  players: PlayerSummary[];
  limit?: number;
  highlightId?: string | null;
  big?: boolean;
  teams?: TeamStanding[];
}) {
  const shown = players.slice(0, limit);
  const me = highlightId ? players.find((p) => p.id === highlightId) : undefined;
  const meHidden = me && !shown.some((p) => p.id === me.id);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const row = (p: PlayerSummary, i: number) => (
    <motion.li
      layout
      key={p.id}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3",
        big ? "min-h-16 text-xl" : "min-h-13",
        p.id === highlightId ? "bg-violet-500/30 ring-2 ring-violet-400" : "bg-night-800/80",
      )}
    >
      <span className={cn("w-8 shrink-0 text-center font-display font-extrabold tabular-nums", p.rank <= 3 ? "text-sun-300" : "text-ink-muted")}>{p.rank}.</span>
      <Avatar name={p.nickname} id={p.id} size={big ? "md" : "sm"} />
      <span className="min-w-0 flex-1 truncate font-bold">
        {p.nickname}
        {teamById.get(p.teamId ?? "") && <span className="ml-2 text-sm font-semibold text-ink-subtle">· {teamById.get(p.teamId ?? "")!.name}</span>}
      </span>
      {p.lastPoints !== null && p.lastPoints > 0 && (
        <span className="hidden text-sm font-bold text-mint-300 sm:inline">+{formatNumber(p.lastPoints)}</span>
      )}
      <RankChange player={p} />
      <span className="w-24 text-right font-display font-extrabold tabular-nums">{formatNumber(p.score)}</span>
    </motion.li>
  );
  return (
    <ol className="space-y-2" aria-label="Poredak">
      {shown.map(row)}
      {meHidden && me && (
        <>
          <li className="text-center text-ink-faint" aria-hidden="true">
            ⋯
          </li>
          {row(me, shown.length)}
        </>
      )}
    </ol>
  );
}

export const TEAM_BG: Record<string, string> = { coral: "bg-coral-500", cyan: "bg-cyan-500", sun: "bg-sun-500", mint: "bg-mint-500", violet: "bg-violet-500" };

export function TeamStandings({ teams, big, highlightTeamId }: { teams: TeamStanding[]; big?: boolean; highlightTeamId?: string | null }) {
  const max = Math.max(1, ...teams.map((t) => t.score));
  return (
    <ol className="space-y-2.5" aria-label="Poredak timova">
      {teams.map((team) => (
        <li key={team.id} className={cn("relative overflow-hidden rounded-xl bg-night-800", team.id === highlightTeamId && "ring-2 ring-white")}>
          <motion.div
            className={cn("absolute inset-y-0 left-0 opacity-80", TEAM_BG[team.color] ?? "bg-violet-500")}
            initial={{ width: 0 }}
            animate={{ width: `${(team.score / max) * 100}%` }}
            transition={{ duration: 0.8 }}
          />
          <div className={cn("relative flex items-center gap-3 px-4 font-bold", big ? "min-h-16 text-2xl" : "min-h-12")}>
            <span className="font-display font-extrabold">{team.rank}.</span>
            <span className="flex-1">{team.name}</span>
            <span className="text-sm font-semibold opacity-80">{team.memberCount} igr.</span>
            <span className="font-display font-extrabold tabular-nums">{formatNumber(team.score)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function fireConfetti(intensity: "small" | "big" = "big") {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion")) return;
  const colors = ["#ff6551", "#2fe0f5", "#ffcc3d", "#3fe3a6", "#8a63ff", "#ff4f97"];
  if (intensity === "small") {
    void confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
    return;
  }
  const end = Date.now() + 1800;
  const frame = () => {
    void confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true });
    void confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

const PODIUM = [
  { place: 2, height: "h-28 sm:h-36", color: "bg-cyan-500", delay: 0.5 },
  { place: 1, height: "h-40 sm:h-52", color: "bg-sun-400", delay: 1.1 },
  { place: 3, height: "h-20 sm:h-28", color: "bg-coral-500", delay: 0.2 },
];

/** Top-three podium for players or teams; plays a celebration once. */
export function Podium({ entries }: { entries: { id: string; name: string; score: number; detail?: string }[] }) {
  const reduce = useReducedMotion();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || entries.length === 0) return;
    fired.current = true;
    const t = window.setTimeout(() => fireConfetti("big"), reduce ? 0 : 1300);
    return () => window.clearTimeout(t);
  }, [entries.length, reduce]);

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Postolje">
      {PODIUM.map(({ place, height, color, delay }) => {
        const entry = entries[place - 1];
        return (
          <div key={place} className="flex flex-col items-center">
            {entry ? (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : delay + 0.3, type: "spring", stiffness: 260, damping: 20 }}
                className="mb-3 flex w-full flex-col items-center text-center"
              >
                {place === 1 && <Crown className="mb-1 size-9 text-sun-300" />}
                <Avatar name={entry.name} id={entry.id} size={place === 1 ? "xl" : "lg"} />
                <p className={cn("mt-2 w-full truncate font-display font-extrabold", place === 1 ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>{entry.name}</p>
                <p className="font-display font-bold tabular-nums text-ink-muted">{formatNumber(entry.score)}</p>
                {entry.detail && <p className="text-xs font-semibold text-ink-subtle">{entry.detail}</p>}
              </motion.div>
            ) : (
              <div className="mb-3 h-24" />
            )}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: reduce ? 0 : delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: "bottom" }}
              className={cn("grid w-full place-items-start justify-center rounded-t-2xl pt-3 font-display text-4xl font-extrabold text-night-950 sm:text-5xl", height, color)}
            >
              {place}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
