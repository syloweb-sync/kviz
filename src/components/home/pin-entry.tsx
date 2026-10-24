"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Large PIN field that hands off to the join flow. */
export function PinEntry({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={cn("surface flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^\d{6}$/.test(pin)) {
          setError("PIN ima točno 6 znamenki.");
          return;
        }
        router.push(`/join?pin=${pin}`);
      }}
      noValidate
    >
      <label htmlFor="home-pin" className="sr-only">
        PIN igre
      </label>
      <input
        id="home-pin"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        placeholder="PIN igre"
        autoFocus={autoFocus}
        value={pin.length > 3 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin}
        onChange={(event) => {
          setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "home-pin-error" : undefined}
        className="h-14 min-w-0 flex-1 rounded-xl bg-night-950/70 px-5 text-center font-display text-3xl font-extrabold tracking-[0.25em] text-ink ring-1 ring-white/10 placeholder:text-xl placeholder:font-bold placeholder:tracking-normal placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:text-left"
      />
      <Button type="submit" size="lg" variant="accent" className="h-14">
        Uđi u igru <ArrowRight />
      </Button>
      {error && (
        <p id="home-pin-error" role="alert" className="text-sm font-semibold text-coral-400 sm:sr-only">
          {error}
        </p>
      )}
    </form>
  );
}
