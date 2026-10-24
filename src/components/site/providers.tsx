"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: "!bg-night-700 !border-white/10 !text-ink !rounded-xl !font-sans !shadow-[var(--shadow-lift)]",
            description: "!text-ink-muted",
          },
        }}
      />
    </MotionConfig>
  );
}
