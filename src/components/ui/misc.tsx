import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface rounded-xl", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-white/10 text-ink-muted",
  violet: "bg-violet-500/20 text-violet-400",
  cyan: "bg-cyan-400/15 text-cyan-300",
  coral: "bg-coral-500/18 text-coral-400",
  sun: "bg-sun-400/18 text-sun-300",
  mint: "bg-mint-400/15 text-mint-300",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", badgeTones[tone], className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border-2 border-dashed border-white/10 px-6 py-14 text-center", className)}>
      {icon && <div className="mb-5">{icon}</div>}
      <h3 className="font-display text-2xl font-bold">{title}</h3>
      {description && <p className="mt-2 max-w-md text-ink-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-xs font-bold text-ink-muted">{children}</kbd>;
}
