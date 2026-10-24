import { QuestionTypeIcon } from "@/components/quiz/question-type-icon";
import { QUESTION_TYPE_META } from "@/lib/domain/question-defaults";
import type { PublicQuestion } from "@/lib/domain/public-view";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/** Question title + optional image, sized for a phone or a projector. */
export function QuestionStage({ question, size = "md", showType = true }: { question: PublicQuestion; size?: "sm" | "md" | "lg"; showType?: boolean }) {
  const url = mediaUrl(question.media);
  return (
    <div>
      {showType && (
        <div className="mb-3 flex items-center gap-2">
          <QuestionTypeIcon type={question.type} size="sm" />
          <span className="text-sm font-bold text-ink-subtle">{QUESTION_TYPE_META[question.type].label}</span>
          {question.points === "double" && <span className="rounded-full bg-sun-400 px-2 py-0.5 text-xs font-extrabold text-night-950">2× bodovi</span>}
        </div>
      )}
      <h2
        className={cn(
          "font-display font-extrabold leading-tight",
          size === "lg" ? "text-4xl sm:text-5xl xl:text-6xl" : size === "md" ? "text-2xl sm:text-3xl" : "text-xl",
        )}
      >
        {question.title}
      </h2>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={question.media?.alt ?? ""}
          className={cn("mt-4 w-full rounded-2xl bg-night-950 object-contain", size === "lg" ? "max-h-[38vh]" : "max-h-56")}
        />
      )}
    </div>
  );
}
