import { Skeleton } from "@/components/ui/misc";

export default function GamesLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12" aria-busy="true" aria-label="Učitavanje igara">
      <Skeleton className="h-12 w-72" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </main>
  );
}
