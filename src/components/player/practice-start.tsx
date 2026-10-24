"use client";

import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { savePlayer } from "@/lib/client/player-session";
import { unlockAudio } from "@/lib/client/sound";

export function PracticeStart({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    unlockAudio();
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ sessionId: string; playerId: string; token: string }>("/api/practice", { method: "POST", body: { quizId } });
      savePlayer(result.sessionId, { playerId: result.playerId, token: result.token, nickname: "Igrač" });
      router.push(`/play/${result.sessionId}?quiz=${quizId}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Vježba nije pokrenuta.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md text-center">
        <Logo />
        <div className="surface mt-8 rounded-3xl p-8">
          <Dumbbell className="mx-auto size-14 text-cyan-300" />
          <h1 className="mt-4 font-display text-3xl font-extrabold">Način vježbe</h1>
          <p className="mt-2 text-ink-muted">Igraš sam, svojim tempom. Nakon svakog pitanja vidiš točan odgovor i objašnjenje.</p>
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-coral-500/15 px-3 py-2 font-semibold text-coral-400">
              {error}
            </p>
          )}
          <Button size="xl" variant="accent" className="mt-6 w-full" loading={busy} onClick={() => void start()}>
            Kreni
          </Button>
          <Button asChild variant="ghost" className="mt-2">
            <Link href="/">Natrag na početnu</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
