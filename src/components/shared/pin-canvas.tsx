"use client";

import { useRef } from "react";
import type { MediaRef, NormalizedPoint } from "@/lib/domain/schema";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export interface PinMarker {
  point: NormalizedPoint;
  tone: "player" | "target" | "correct" | "wrong" | "other";
  label?: string;
}

const TONES: Record<PinMarker["tone"], string> = {
  player: "text-sun-400",
  target: "text-mint-400",
  correct: "text-mint-400",
  wrong: "text-coral-500",
  other: "text-cyan-300/80",
};

/**
 * Renders an image at its natural aspect ratio and reports taps/clicks as normalised
 * coordinates (0–1 on both axes), so the same answer works on any screen size.
 */
export function PinCanvas({
  image,
  markers = [],
  radius,
  radiusCenter,
  onPick,
  className,
  label,
  disabled,
}: {
  image: MediaRef;
  markers?: PinMarker[];
  /** Fraction of the image width to draw as an accepted-area circle. */
  radius?: number;
  radiusCenter?: NormalizedPoint | null;
  onPick?: (point: NormalizedPoint) => void;
  className?: string;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const url = mediaUrl(image);
  const interactive = Boolean(onPick) && !disabled;
  const current = markers.find((m) => m.tone === "player" || m.tone === "target")?.point ?? null;

  function pick(clientX: number, clientY: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !onPick) return;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    onPick({ x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 });
  }

  return (
    <div
      ref={ref}
      role={interactive ? "application" : "img"}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-xl bg-night-950 ring-1 ring-white/10",
        interactive && "cursor-crosshair touch-none",
        className,
      )}
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
      onPointerDown={(e) => {
        if (!interactive) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (interactive && e.buttons === 1) pick(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (!interactive || !onPick) return;
        const step = e.shiftKey ? 0.05 : 0.01;
        const base = current ?? { x: 0.5, y: 0.5 };
        const moves: Record<string, NormalizedPoint> = {
          ArrowLeft: { x: base.x - step, y: base.y },
          ArrowRight: { x: base.x + step, y: base.y },
          ArrowUp: { x: base.x, y: base.y - step },
          ArrowDown: { x: base.x, y: base.y + step },
        };
        const next = moves[e.key];
        if (next) {
          e.preventDefault();
          onPick({ x: Math.min(1, Math.max(0, next.x)), y: Math.min(1, Math.max(0, next.y)) });
        }
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={image.alt ?? ""} draggable={false} className="pointer-events-none size-full object-fill" />
      )}
      {radius !== undefined && radiusCenter && (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-mint-300 bg-mint-400/20"
          style={{
            left: `${radiusCenter.x * 100}%`,
            top: `${radiusCenter.y * 100}%`,
            width: `${radius * 200}%`,
            aspectRatio: "1",
            transform: "translate(-50%, -50%)",
          }}
          aria-hidden="true"
        />
      )}
      {markers.map((marker, i) => (
        <span
          key={i}
          className={cn("pointer-events-none absolute -translate-x-1/2 -translate-y-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)]", TONES[marker.tone])}
          style={{ left: `${marker.point.x * 100}%`, top: `${marker.point.y * 100}%` }}
          title={marker.label}
        >
          <svg viewBox="0 0 24 24" className={marker.tone === "other" ? "size-5" : "size-9"} aria-hidden="true">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" fill="currentColor" stroke="#0d0a26" strokeWidth="1.2" />
            <circle cx="12" cy="9" r="2.6" fill="#0d0a26" />
          </svg>
        </span>
      ))}
    </div>
  );
}
