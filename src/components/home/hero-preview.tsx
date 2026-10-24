"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ShapeIcon, answerStyle } from "@/components/brand/shapes";
import { cn } from "@/lib/utils";

const OPTIONS = ["Dinara", "Velebit", "Biokovo", "Učka"];
const PLAYERS = ["Maja", "Luka", "Teta Vesna", "Ivan", "Sara", "Đuro"];

/**
 * Looping illustration of a live round — host screen plus a player's phone. Purely
 * presentational (clearly a product preview); it does not talk to the server.
 */
export function HeroPreview() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 8), 1400);
    return () => window.clearInterval(id);
  }, []);

  const revealed = tick >= 5;
  const picked = tick >= 2 ? 0 : null;
  const joined = Math.min(PLAYERS.length, 2 + tick);
  const counts = [9, 3, 2, 1];

  return (
    <div className="relative mx-auto w-full max-w-xl" aria-label="Pregled igre uživo" role="img">
      {/* Host screen */}
      <div className="surface relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between text-sm font-bold text-ink-subtle">
          <span>Pitanje 3 / 10</span>
          <span className="flex items-center gap-2">
            <span className="size-2 animate-pulse-soft rounded-full bg-mint-400" />
            {joined} igrača
          </span>
        </div>
        <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
          Koji je najviši vrh Hrvatske?
        </h3>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {OPTIONS.map((option, i) => {
            const style = answerStyle(i);
            const correct = i === 0;
            return (
              <motion.div
                key={option}
                animate={{ opacity: revealed && !correct ? 0.35 : 1, scale: revealed && correct ? 1.03 : 1 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  "relative flex h-16 items-center gap-2.5 overflow-hidden rounded-xl px-3.5 font-bold text-white sm:h-[4.5rem]",
                  style.bg,
                )}
              >
                <ShapeIcon shape={style.shape} className="size-5 shrink-0 opacity-90" />
                <span className="truncate">{option}</span>
                {revealed && (
                  <motion.span
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-auto rounded-full bg-night-950/30 px-2 py-0.5 text-sm tabular-nums"
                  >
                    {counts[i]}
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
        <div className="mt-5 flex -space-x-2">
          <AnimatePresence>
            {PLAYERS.slice(0, joined).map((name, i) => (
              <motion.span
                key={name}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={cn(
                  "grid size-9 place-items-center rounded-full text-sm font-extrabold text-night-950 ring-2 ring-night-800",
                  answerStyle(i + 1).bg,
                )}
                title={name}
              >
                {name.charAt(0)}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Phone */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="absolute -bottom-10 -right-2 w-40 rotate-[5deg] rounded-[1.8rem] bg-night-950 p-2 shadow-[var(--shadow-lift)] ring-1 ring-white/10 sm:-right-8 sm:w-48"
      >
        <div className="rounded-[1.4rem] bg-night-800 p-2.5">
          <div className="mb-2 h-1.5 w-12 rounded-full bg-white/15 mx-auto" />
          <AnimatePresence mode="wait">
            {revealed ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="grid h-44 place-items-center rounded-xl bg-mint-500 text-center text-night-950 sm:h-52"
              >
                <div>
                  <p className="font-display text-xl font-extrabold">Točno!</p>
                  <p className="mt-1 text-sm font-bold">+ 920</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="answers" exit={{ opacity: 0 }} className="grid h-44 grid-cols-2 gap-1.5 sm:h-52">
                {OPTIONS.map((option, i) => {
                  const style = answerStyle(i);
                  return (
                    <div
                      key={option}
                      className={cn(
                        "grid place-items-center rounded-lg text-white transition-transform",
                        style.bg,
                        picked === i && "scale-95 ring-4 ring-white",
                        picked !== null && picked !== i && "opacity-40",
                      )}
                    >
                      <ShapeIcon shape={style.shape} className="size-7" />
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
