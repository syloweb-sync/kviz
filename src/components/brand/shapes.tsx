import { cn } from "@/lib/utils";

/**
 * Game answer palette. Each answer slot pairs a colour with a unique shape so the options
 * stay distinguishable for colour-blind players and on dim projectors.
 */
export const ANSWER_STYLES = [
  { key: "coral", shape: "triangle", label: "Trokut", bg: "bg-coral-500", ring: "ring-coral-400", text: "text-coral-400", hex: "#ff6551", shadow: "#e84a36" },
  { key: "cyan", shape: "diamond", label: "Romb", bg: "bg-cyan-500", ring: "ring-cyan-300", text: "text-cyan-300", hex: "#11c3db", shadow: "#0a98ab" },
  { key: "sun", shape: "circle", label: "Krug", bg: "bg-sun-500", ring: "ring-sun-300", text: "text-sun-300", hex: "#f5b400", shadow: "#c48f00" },
  { key: "mint", shape: "square", label: "Kvadrat", bg: "bg-mint-500", ring: "ring-mint-300", text: "text-mint-300", hex: "#17c487", shadow: "#0f9566" },
  { key: "violet", shape: "hexagon", label: "Šesterokut", bg: "bg-violet-500", ring: "ring-violet-400", text: "text-violet-400", hex: "#8a63ff", shadow: "#6f45f0" },
  { key: "rose", shape: "star", label: "Zvijezda", bg: "bg-rose-500", ring: "ring-rose-400", text: "text-rose-400", hex: "#ff4f97", shadow: "#d6336f" },
] as const;

export type AnswerShape = (typeof ANSWER_STYLES)[number]["shape"];

export function answerStyle(index: number) {
  return ANSWER_STYLES[index % ANSWER_STYLES.length]!;
}

const PATHS: Record<AnswerShape, string> = {
  triangle: "M12 3.5 21.5 20h-19Z",
  diamond: "M12 2.5 21.5 12 12 21.5 2.5 12Z",
  circle: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z",
  square: "M4.5 4.5h15v15h-15Z",
  hexagon: "M7 3.3h10l5 8.7-5 8.7H7L2 12Z",
  star: "m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9Z",
};

export function ShapeIcon({ shape, className }: { shape: AnswerShape; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden="true">
      <path d={PATHS[shape]} fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

/** Decorative floating geometry used on hero and lobby screens. */
export function FloatingShapes({ className }: { className?: string }) {
  const items = [
    { shape: "triangle" as const, color: "text-coral-500/70", pos: "left-[6%] top-[18%] size-14", rotate: "-12deg", delay: "0s" },
    { shape: "circle" as const, color: "text-sun-400/70", pos: "right-[8%] top-[12%] size-10", rotate: "0deg", delay: "1.2s" },
    { shape: "diamond" as const, color: "text-cyan-400/60", pos: "right-[14%] bottom-[16%] size-16", rotate: "8deg", delay: "0.6s" },
    { shape: "square" as const, color: "text-mint-400/60", pos: "left-[12%] bottom-[12%] size-9", rotate: "18deg", delay: "2s" },
    { shape: "star" as const, color: "text-rose-400/50", pos: "left-[46%] top-[6%] size-8", rotate: "0deg", delay: "1.6s" },
  ];
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {items.map((item) => (
        <div
          key={item.pos}
          className={cn("absolute animate-float", item.pos, item.color)}
          style={{ ["--float-rotate" as string]: item.rotate, animationDelay: item.delay }}
        >
          <ShapeIcon shape={item.shape} className="size-full" />
        </div>
      ))}
    </div>
  );
}
