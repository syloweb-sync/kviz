import { Spinner } from "@/components/ui/button";

export default function QuizLoading() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Učitavanje">
      <Spinner className="size-10 text-violet-400" />
    </div>
  );
}
