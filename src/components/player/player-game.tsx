"use client";

import { DoorOpen, Dumbbell, Hourglass, LogOut, PartyPopper, RotateCcw, Trophy } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { AnswerInput } from "@/components/game/answer-input";
import {
  Avatar,
  ConnectionBadge,
  CountdownRing,
  LeadIn,
  Leaderboard,
  SoundToggle,
  TEAM_BG,
  TeamStandings,
  fireConfetti,
  useCountdown,
} from "@/components/game/game-ui";
import { QuestionStage } from "@/components/game/question-stage";
import { ResultBanner, RevealView } from "@/components/game/reveal";
import { useGame } from "@/components/game/use-game";
import { Button, Spinner } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { forgetPlayer, loadPlayer, savePlayer, type StoredPlayer } from "@/lib/client/player-session";
import { playSound, unlockAudio } from "@/lib/client/sound";
import type { GameView, SubmitAnswerResult } from "@/lib/game/types";
import { cn, formatNumber, plural } from "@/lib/utils";

export function PlayerGame({ sessionId }: { sessionId: string }) {
  const [stored, setStored] = useState<StoredPlayer | null | undefined>(undefined);
  useEffect(() => setStored(loadPlayer(sessionId)), [sessionId]);

  if (stored === undefined) return <FullScreenMessage title="Učitavanje…" spinner />;
  if (stored === null) {
    return (
      <FullScreenMessage
        title="Nisi u ovoj igri"
        text="Uđi s PIN-om igre da bi zaigrao."
        action={
          <Button asChild size="lg" variant="accent">
            <Link href="/join">Upiši PIN</Link>
          </Button>
        }
      />
    );
  }
  return <PlayerGameInner sessionId={sessionId} player={stored} />;
}

function FullScreenMessage({ title, text, action, spinner }: { title: string; text?: string; action?: React.ReactNode; spinner?: boolean }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        {spinner && <Spinner className="mx-auto mb-4 size-10 text-violet-400" />}
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
        {text && <p className="mt-2 text-ink-muted">{text}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

function PlayerGameInner({ sessionId, player }: { sessionId: string; player: StoredPlayer }) {
  const router = useRouter();
  const game = useGame({ sessionId, token: player.token, role: "player" });
  const { view, error, connection, refresh, now } = game;
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  if (error && !view) {
    if (error.kind === "not_joined" || error.kind === "not_found") forgetPlayer(sessionId);
    return (
      <FullScreenMessage
        title={error.kind === "kicked" ? "Uklonjen si iz igre" : error.kind === "not_found" ? "Igra ne postoji" : error.kind === "network" ? "Nema veze" : "Ne možeš u ovu igru"}
        text={error.message}
        action={
          error.kind === "network" ? (
            <Button size="lg" onClick={() => void refresh()}>
              <RotateCcw /> Pokušaj ponovno
            </Button>
          ) : (
            <Button asChild size="lg" variant="accent">
              <Link href="/join">Upiši novi PIN</Link>
            </Button>
          )
        }
      />
    );
  }
  if (!view) return <FullScreenMessage title="Spajanje na igru…" spinner />;
  if (error?.kind === "kicked") return <FullScreenMessage title="Uklonjen si iz igre" text={error.message} action={<Button asChild><Link href="/join">Upiši PIN</Link></Button>} />;

  const practice = view.session.mode === "practice";

  async function leave() {
    try {
      await apiFetch(`/api/games/${sessionId}/players`, { method: "DELETE", headers: { "x-player-token": player.token } });
    } catch {
      // Leaving locally is enough if the server can't be reached.
    }
    forgetPlayer(sessionId);
    router.push("/");
  }

  return (
    <div className={cn("flex min-h-dvh flex-col", view.session.settings.reducedMotion && "reduce-motion")}>
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={view.me?.nickname ?? player.nickname} id={view.me?.id ?? player.playerId} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{view.me?.nickname ?? player.nickname}</p>
            <p className="text-xs font-bold tabular-nums text-ink-subtle">
              {formatNumber(view.me?.score ?? 0)} bod. {view.me && !practice && view.session.state !== "lobby" ? `· ${view.me.rank}. mjesto` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!practice && <ConnectionBadge state={connection} />}
          <SoundToggle />
          {view.session.state !== "finished" && view.session.state !== "cancelled" && (
            <Button variant="ghost" size="icon" aria-label="Napusti igru" onClick={() => setLeaveOpen(true)}>
              <LogOut />
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4">
        <PlayerStage view={view} player={player} sessionId={sessionId} game={game} />
      </main>
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Napustiti igru?"
        description="Tvoji bodovi neće se računati u poretku. Možeš ponovno ući s PIN-om, ali kao novi igrač."
        confirmLabel="Napusti"
        onConfirm={() => void leave()}
      />
      {!practice && connection === "offline" && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-coral-500 px-4 py-2 text-center text-sm font-bold text-white" role="alert">
          Veza je prekinuta — pokušavamo se ponovno spojiti…
        </div>
      )}
    </div>
  );
}

type GameHook = ReturnType<typeof useGame>;

function PlayerStage({ view, player, sessionId, game }: { view: GameView; player: StoredPlayer; sessionId: string; game: GameHook }) {
  const { state } = view.session;
  switch (state) {
    case "lobby":
      return <Lobby view={view} player={player} sessionId={sessionId} refresh={game.refresh} />;
    case "question_active":
      return <ActiveQuestion key={`${view.session.currentIndex}`} view={view} player={player} sessionId={sessionId} game={game} />;
    case "question_revealing":
      return <Revealed view={view} game={game} />;
    case "leaderboard":
      return <MyStanding view={view} />;
    case "finished":
      return <Finished view={view} />;
    case "cancelled":
      return (
        <FullScreenMessage
          title="Igra je otkazana"
          text="Domaćin je završio igru prije početka."
          action={
            <Button asChild>
              <Link href="/join">Nova igra</Link>
            </Button>
          }
        />
      );
  }
}

function Lobby({ view, player, sessionId, refresh }: { view: GameView; player: StoredPlayer; sessionId: string; refresh: () => Promise<void> }) {
  const myTeam = view.teams.find((t) => t.id === view.me?.teamId);
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
        <Avatar name={player.nickname} id={player.playerId} size="xl" />
      </motion.div>
      <h1 className="mt-6 font-display text-4xl font-extrabold">Unutra si!</h1>
      <p className="mt-2 text-lg text-ink-muted">Vidiš li svoj nadimak na ekranu? Igra uskoro počinje.</p>
      <div className="mt-8 flex items-center gap-3 rounded-full bg-white/6 px-5 py-2.5">
        <Hourglass className="size-5 animate-pulse-soft text-sun-300" />
        <span className="font-bold">
          {view.playerCount} {plural(view.playerCount, "igrač", "igrača", "igrača")} u predvorju
        </span>
      </div>
      <p className="mt-6 font-display text-xl font-bold text-ink-subtle">{view.session.quizTitle}</p>
      {view.session.teamsEnabled && view.teams.length > 0 && (
        <div className="mt-8 w-full">
          <p className="font-bold text-ink-muted">Tvoj tim {myTeam ? `· ${myTeam.name}` : ""}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {view.teams
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((team) => (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={team.id === view.me?.teamId}
                  onClick={async () => {
                    try {
                      await apiFetch(`/api/games/${sessionId}/players`, { method: "PATCH", body: { teamId: team.id }, headers: { "x-player-token": player.token } });
                      await refresh();
                    } catch (err) {
                      toast.error(err instanceof ApiClientError ? err.message : "Promjena tima nije uspjela.");
                    }
                  }}
                  className={cn(
                    "h-14 rounded-xl font-display text-lg font-extrabold text-night-950",
                    TEAM_BG[team.color] ?? "bg-violet-500",
                    team.id === view.me?.teamId ? "ring-4 ring-white" : "opacity-45",
                  )}
                >
                  {team.name} · {team.memberCount}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveQuestion({ view, player, sessionId, game }: { view: GameView; player: StoredPlayer; sessionId: string; game: GameHook }) {
  const question = view.question!;
  const s = view.session;
  const info = useCountdown(
    { startsAt: s.questionStartsAt, deadline: s.deadline, pausedRemainingMs: s.pausedRemainingMs, limitSeconds: question.timeLimit },
    game.now,
    true,
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<SubmitAnswerResult["feedback"]>(null);
  const [localAnswer, setLocalAnswer] = useState<Record<string, unknown> | null>(null);
  const submitted = view.me?.currentAnswer.answer ?? localAnswer;
  const allowChange = s.settings.allowAnswerChange && question.feedback !== "immediate";
  const lastTick = useRef<number | null>(null);
  const timeUpFired = useRef(false);

  // Countdown ticks in the last five seconds; ask the server to close once time is up.
  useEffect(() => {
    if (info.phase === "running") {
      const sec = Math.ceil(info.remainingMs / 1000);
      if (sec <= 5 && sec !== lastTick.current && !submitted) {
        lastTick.current = sec;
        playSound("tick");
      }
    }
    if (info.phase === "over" && !timeUpFired.current) {
      timeUpFired.current = true;
      if (!submitted) playSound("timeUp");
      const t = window.setTimeout(() => void game.refresh(), 900);
      return () => window.clearTimeout(t);
    }
  }, [info.phase, info.remainingMs, submitted, game]);

  async function submit(answer: Record<string, unknown>) {
    setBusy(true);
    try {
      const result = await apiFetch<SubmitAnswerResult>(`/api/games/${sessionId}/answers`, {
        method: "POST",
        body: { questionIndex: s.currentIndex, answer },
        headers: { "x-player-token": player.token },
      });
      setLocalAnswer(answer);
      playSound("submit");
      if (result.feedback) {
        setFeedback(result.feedback);
        playSound(result.feedback.status === "correct" ? "correct" : result.feedback.status === "incorrect" ? "incorrect" : "submit");
      }
      void game.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Odgovor nije poslan.");
      void game.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (info.phase === "lead_in") {
    return (
      <div className="flex flex-1 flex-col">
        <p className="mt-6 text-center font-bold text-ink-subtle">
          Pitanje {s.currentIndex + 1} / {s.totalQuestions}
        </p>
        <LeadIn ms={info.leadInMs} label="Pripremi se!" />
      </div>
    );
  }

  const showInput = !submitted || allowChange;
  const closed = info.phase === "over";

  return (
    <div className="flex flex-1 flex-col pt-2">
      <div className="flex items-start justify-between gap-4">
        <p className="pt-1 text-sm font-bold text-ink-subtle">
          Pitanje {s.currentIndex + 1} / {s.totalQuestions}
        </p>
        <CountdownRing info={info} size={64} />
      </div>
      <div className="mt-2">
        <QuestionStage question={question} size="md" />
      </div>
      {info.phase === "paused" && (
        <p className="mt-4 rounded-xl bg-sun-400/15 px-4 py-3 text-center font-bold text-sun-300" role="status">
          Igra je pauzirana — pričekaj domaćina.
        </p>
      )}
      <div className="mt-5 flex-1">
        {feedback ? (
          <div className="space-y-4">
            <ResultBanner status={feedback.status} points={feedback.points} />
            {feedback.correctAnswer && <RevealView question={question} answer={feedback.correctAnswer} stats={null} own={submitted} />}
            {feedback.explanation && <p className="rounded-xl bg-night-800 p-4 text-ink-muted">{feedback.explanation}</p>}
          </div>
        ) : submitted && !allowChange ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="surface grid place-items-center rounded-3xl px-6 py-12 text-center">
            <Hourglass className="size-12 text-cyan-300" />
            <p className="mt-4 font-display text-3xl font-extrabold">Odgovor je zaprimljen!</p>
            <p className="mt-1 text-ink-muted">
              Čekamo ostale · odgovorilo {view.answeredCount} / {view.playerCount}
            </p>
          </motion.div>
        ) : closed ? (
          <div className="surface rounded-3xl px-6 py-12 text-center">
            <p className="font-display text-3xl font-extrabold">Vrijeme je isteklo</p>
            <p className="mt-1 text-ink-muted">Rezultati stižu za trenutak…</p>
          </div>
        ) : (
          showInput && (
            <>
              {submitted && allowChange && <p className="mb-3 text-center text-sm font-bold text-mint-300">Odgovor je poslan — možeš ga promijeniti do isteka vremena.</p>}
              <AnswerInput question={question} disabled={busy || info.phase !== "running"} submitted={submitted} allowChange={allowChange} busy={busy} onSubmit={(a) => void submit(a)} />
            </>
          )
        )}
      </div>
    </div>
  );
}

function Revealed({ view, game }: { view: GameView; game: GameHook }) {
  const me = view.me;
  const status = me?.currentAnswer.status ?? null;
  const played = useRef(false);
  const [advancing, setAdvancing] = useState(false);
  const practice = view.session.mode === "practice";
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (status === "correct") {
      playSound("correct");
      fireConfetti("small");
    } else if (status === "incorrect") playSound("incorrect");
    else playSound("reveal");
  }, [status]);

  return (
    <div className="space-y-5 pt-2">
      {me?.currentAnswer.submitted ? (
        <ResultBanner status={status} points={me.currentAnswer.points} />
      ) : (
        <div className="rounded-3xl bg-night-700 px-6 py-5">
          <p className="font-display text-3xl font-extrabold">Bez odgovora</p>
          <p className="text-ink-muted">Ovaj put nisi stigao odgovoriti.</p>
        </div>
      )}
      {view.question && (
        <div className="surface rounded-2xl p-4">
          <p className="mb-3 font-display text-lg font-bold">{view.question.title}</p>
          <RevealView question={view.question} answer={view.reveal?.answer ?? null} stats={view.reveal?.stats ?? null} own={me?.currentAnswer.answer ?? null} />
        </div>
      )}
      {view.reveal?.explanation && <p className="rounded-xl bg-violet-500/15 p-4 text-ink">{view.reveal.explanation}</p>}
      {!practice && me && (
        <p className="text-center font-bold text-ink-muted">
          Trenutačno si {me.rank}. od {view.playerCount} · {formatNumber(me.score)} bodova
        </p>
      )}
      {practice && (
        <Button
          size="xl"
          variant="accent"
          className="w-full"
          loading={advancing}
          onClick={async () => {
            setAdvancing(true);
            try {
              await game.act({ action: "next", expectedVersion: view.session.version });
            } catch (err) {
              toast.error(err instanceof ApiClientError ? err.message : "Nije uspjelo.");
            } finally {
              setAdvancing(false);
            }
          }}
        >
          {view.session.currentIndex + 1 >= view.session.totalQuestions ? "Pogledaj rezultat" : "Sljedeće pitanje"}
        </Button>
      )}
    </div>
  );
}

function MyStanding({ view }: { view: GameView }) {
  const me = view.me;
  useEffect(() => playSound("leaderboard"), []);
  const diff = me?.previousRank ? me.previousRank - me.rank : 0;
  return (
    <div className="space-y-6 pt-4">
      {me && (
        <div className="surface rounded-3xl p-6 text-center">
          <p className="font-bold text-ink-subtle">Tvoj poredak</p>
          <p className="font-display text-7xl font-extrabold text-sun-300">{me.rank}.</p>
          <p className="font-display text-2xl font-bold tabular-nums">{formatNumber(me.score)} bodova</p>
          {diff !== 0 && (
            <p className={cn("mt-2 font-bold", diff > 0 ? "text-mint-300" : "text-coral-400")}>
              {diff > 0 ? `▲ ${diff} ${plural(diff, "mjesto", "mjesta", "mjesta")} gore` : `▼ ${-diff} ${plural(-diff, "mjesto", "mjesta", "mjesta")} dolje`}
            </p>
          )}
        </div>
      )}
      {view.session.teamsEnabled && view.teams.length > 0 && <TeamStandings teams={view.teams} highlightTeamId={me?.teamId} />}
      <Leaderboard players={view.players} limit={5} highlightId={me?.id} />
      <p className="text-center text-ink-subtle">Sljedeće pitanje stiže kad domaćin krene…</p>
    </div>
  );
}

function Finished({ view }: { view: GameView }) {
  const me = view.me;
  const router = useRouter();
  const practice = view.session.mode === "practice";
  const [restarting, setRestarting] = useState(false);
  const fired = useRef(false);
  const accuracy = me && view.session.gradedQuestions ? Math.round((me.correctCount / view.session.gradedQuestions) * 100) : 0;
  useEffect(() => {
    if (fired.current || !me) return;
    fired.current = true;
    if (practice || me.rank <= 3) {
      playSound("winner");
      fireConfetti("big");
    } else playSound("leaderboard");
  }, [me, practice]);

  return (
    <div className="space-y-6 pt-4 text-center">
      <div className="surface rounded-3xl p-6">
        {practice ? <Dumbbell className="mx-auto size-12 text-cyan-300" /> : me && me.rank <= 3 ? <Trophy className="mx-auto size-12 text-sun-300" /> : <PartyPopper className="mx-auto size-12 text-violet-400" />}
        <h1 className="mt-3 font-display text-4xl font-extrabold">{practice ? "Vježba završena!" : me?.rank === 1 ? "Pobjeda!" : "Kraj igre!"}</h1>
        {me && (
          <>
            {!practice && <p className="mt-2 font-display text-6xl font-extrabold text-sun-300">{me.rank}. mjesto</p>}
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatNumber(me.score)} bodova</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-night-800 p-3">
                <p className="font-display text-3xl font-extrabold">{me.correctCount}</p>
                <p className="text-sm font-bold text-ink-subtle">točnih odgovora</p>
              </div>
              <div className="rounded-2xl bg-night-800 p-3">
                <p className="font-display text-3xl font-extrabold">{accuracy} %</p>
                <p className="text-sm font-bold text-ink-subtle">točnost</p>
              </div>
            </div>
          </>
        )}
      </div>
      {!practice && view.session.teamsEnabled && view.teams.length > 0 && <TeamStandings teams={view.teams} highlightTeamId={me?.teamId} />}
      {!practice && <Leaderboard players={view.players} limit={10} highlightId={me?.id} />}
      <div className="flex flex-col gap-3">
        {practice && view.session.id && (
          <Button
            size="lg"
            variant="accent"
            loading={restarting}
            onClick={async () => {
              setRestarting(true);
              try {
                const quizId = new URLSearchParams(window.location.search).get("quiz");
                if (!quizId) throw new ApiClientError(400, "no_quiz", "Pokrenite vježbu ponovno s poveznice.");
                const result = await apiFetch<{ sessionId: string; playerId: string; token: string }>("/api/practice", { method: "POST", body: { quizId } });
                savePlayer(result.sessionId, { playerId: result.playerId, token: result.token, nickname: me?.nickname ?? "Igrač" });
                router.push(`/play/${result.sessionId}?quiz=${quizId}`);
              } catch (err) {
                toast.error(err instanceof ApiClientError ? err.message : "Nije uspjelo.");
                setRestarting(false);
              }
            }}
          >
            <RotateCcw /> Vježbaj ponovno
          </Button>
        )}
        <Button asChild size="lg" variant="secondary">
          <Link href={practice ? "/dashboard" : "/join"}>
            <DoorOpen /> {practice ? "Natrag" : "Nova igra"}
          </Link>
        </Button>
        <div className="mt-4 flex justify-center">
          <Logo />
        </div>
      </div>
    </div>
  );
}
