"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TEAM_BG } from "@/components/game/game-ui";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { lastNickname, loadPlayer, rememberNickname, savePlayer } from "@/lib/client/player-session";
import { unlockAudio } from "@/lib/client/sound";
import { NICKNAME_MAX, NICKNAME_MIN } from "@/lib/domain/nickname";
import { cn } from "@/lib/utils";

interface Lookup {
  sessionId: string;
  quizTitle: string;
  state: string;
  teams: { id: string; name: string; color: string; position: number }[];
}

export function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [pin, setPin] = useState(() => (params.get("pin") ?? "").replace(/\D/g, "").slice(0, 6));
  const [game, setGame] = useState<Lookup | null>(null);
  const [nickname, setNickname] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("reason") === "expired" ? "Ta igra više nije dostupna. Upiši novi PIN." : null);
  const [busy, setBusy] = useState(false);


  async function lookup(value: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<Lookup>("/api/join", { method: "POST", body: { pin: value } });
      // Already joined from this device? Go straight back in.
      if (loadPlayer(result.sessionId)) {
        router.push(`/play/${result.sessionId}`);
        return;
      }
      setGame(result);
      setNickname((current) => current || lastNickname());
      setTeamId(result.teams[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Provjera PIN-a nije uspjela.");
    } finally {
      setBusy(false);
    }
  }

  // Auto-check a PIN that came from a QR code / link.
  useEffect(() => {
    const fromUrl = (params.get("pin") ?? "").replace(/\D/g, "");
    if (fromUrl.length !== 6) return;
    const timer = window.setTimeout(() => void lookup(fromUrl), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join() {
    if (!game) return;
    const trimmed = nickname.replace(/\s+/g, " ").trim();
    if (trimmed.length < NICKNAME_MIN) return setError(`Nadimak treba barem ${NICKNAME_MIN} znaka.`);
    setBusy(true);
    setError(null);
    unlockAudio();
    try {
      const result = await apiFetch<{ playerId: string; token: string; nickname: string }>(`/api/games/${game.sessionId}/players`, {
        method: "POST",
        body: { nickname: trimmed, teamId },
      });
      savePlayer(game.sessionId, { playerId: result.playerId, token: result.token, nickname: result.nickname });
      rememberNickname(result.nickname);
      router.push(`/play/${game.sessionId}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Ulazak nije uspio.");
      setBusy(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
      {!game ? (
        <motion.form
          key="pin"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="surface rounded-3xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length !== 6) return setError("PIN ima točno 6 znamenki.");
            void lookup(pin);
          }}
          noValidate
        >
          <h1 className="text-center font-display text-3xl font-extrabold">Upiši PIN igre</h1>
          <p className="mt-1 text-center text-ink-muted">Vidi se na ekranu domaćina.</p>
          <label htmlFor="join-pin" className="sr-only">
            PIN igre
          </label>
          <input
            id="join-pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000 000"
            value={pin.length > 3 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            className="mt-6 h-20 w-full rounded-2xl bg-night-950/70 text-center font-display text-5xl font-extrabold tracking-[0.18em] ring-2 ring-white/12 placeholder:text-ink-faint/50 focus-visible:outline-none focus-visible:ring-cyan-300"
          />
          {error && (
            <p role="alert" className="mt-3 text-center font-semibold text-coral-400">
              {error}
            </p>
          )}
          <Button type="submit" size="xl" variant="accent" className="mt-6 w-full" loading={busy} disabled={pin.length !== 6}>
            Dalje <ArrowRight />
          </Button>
        </motion.form>
      ) : (
        <motion.form
          key="nick"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="surface rounded-3xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
          noValidate
        >
          <button type="button" onClick={() => setGame(null)} className="flex items-center gap-1 text-sm font-bold text-ink-subtle hover:text-ink">
            <ArrowLeft className="size-4" /> Drugi PIN
          </button>
          <p className="mt-4 text-center text-sm font-bold uppercase tracking-widest text-cyan-300">Igra pronađena</p>
          <h1 className="mt-1 text-center font-display text-2xl font-extrabold">{game.quizTitle}</h1>
          <label htmlFor="join-nickname" className="mt-6 block font-bold text-ink-muted">
            Tvoj nadimak
          </label>
          <input
            id="join-nickname"
            autoFocus
            autoComplete="nickname"
            maxLength={NICKNAME_MAX}
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
            placeholder="npr. Kvizomanka"
            className="mt-2 h-16 w-full rounded-2xl bg-night-950/70 px-5 text-center font-display text-3xl font-extrabold ring-2 ring-white/12 placeholder:text-xl placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-cyan-300"
          />
          {game.teams.length > 0 && (
            <fieldset className="mt-6">
              <legend className="font-bold text-ink-muted">Odaberi tim</legend>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
                {game.teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    role="radio"
                    aria-checked={teamId === team.id}
                    onClick={() => setTeamId(team.id)}
                    className={cn(
                      "h-14 rounded-xl font-display text-lg font-extrabold text-night-950 transition-all",
                      TEAM_BG[team.color] ?? "bg-violet-500",
                      teamId === team.id ? "ring-4 ring-white" : "opacity-50",
                    )}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="mt-3 text-center font-semibold text-coral-400">
              {error}
            </p>
          )}
          <Button type="submit" size="xl" variant="accent" className="mt-6 w-full" loading={busy}>
            Uđi u igru
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
