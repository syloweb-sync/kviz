import {
  ChartColumn,
  CircleDot,
  Hash,
  Image as ImageIcon,
  Link2,
  ListChecks,
  ListOrdered,
  MapPin,
  Medal,
  SlidersHorizontal,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { QuestionType } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";

export const QUESTION_TYPE_ICONS: Record<QuestionType, LucideIcon> = {
  single_choice: CircleDot,
  multi_select: ListChecks,
  true_false: ToggleLeft,
  slider: SlidersHorizontal,
  short_answer: Type,
  numeric: Hash,
  pin_image: MapPin,
  ordering: ListOrdered,
  matching: Link2,
  image_choice: ImageIcon,
  poll: ChartColumn,
  ranking: Medal,
};

/** Accent colour per type, used for icon tiles in the editor and on the homepage. */
export const QUESTION_TYPE_TONES: Record<QuestionType, string> = {
  single_choice: "bg-violet-500/20 text-violet-400",
  multi_select: "bg-cyan-400/15 text-cyan-300",
  true_false: "bg-coral-500/18 text-coral-400",
  slider: "bg-sun-400/18 text-sun-300",
  short_answer: "bg-mint-400/15 text-mint-300",
  numeric: "bg-rose-400/15 text-rose-400",
  pin_image: "bg-coral-500/18 text-coral-400",
  ordering: "bg-violet-500/20 text-violet-400",
  matching: "bg-cyan-400/15 text-cyan-300",
  image_choice: "bg-mint-400/15 text-mint-300",
  poll: "bg-sun-400/18 text-sun-300",
  ranking: "bg-rose-400/15 text-rose-400",
};

export function QuestionTypeIcon({ type, className, size = "md" }: { type: QuestionType; className?: string; size?: "sm" | "md" | "lg" }) {
  const Icon = QUESTION_TYPE_ICONS[type];
  const sizes = { sm: "size-8 rounded-lg [&_svg]:size-4", md: "size-11 rounded-xl [&_svg]:size-5", lg: "size-14 rounded-2xl [&_svg]:size-7" };
  return (
    <span className={cn("grid shrink-0 place-items-center", sizes[size], QUESTION_TYPE_TONES[type], className)} aria-hidden="true">
      <Icon />
    </span>
  );
}
