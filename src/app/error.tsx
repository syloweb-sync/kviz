"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const notConfigured = /Supabase nije konfiguriran|SUPABASE_SECRET_KEY/.test(error.message);
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-6xl font-extrabold text-coral-400">Ups!</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">{notConfigured ? "Aplikacija nije konfigurirana" : "Nešto je pošlo po zlu"}</h1>
        <p className="mt-2 text-ink-muted">
          {notConfigured ? "Nedostaju Supabase varijable okruženja — pogledajte README (odjeljak „Postavljanje”)." : "Pokušajte ponovno. Ako se greška ponavlja, osvježite stranicu."}
        </p>
        {error.digest && <p className="mt-2 text-xs text-ink-faint">Oznaka greške: {error.digest}</p>}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>
            <RotateCcw /> Pokušaj ponovno
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Na početnu</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
