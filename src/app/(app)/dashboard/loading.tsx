import { Skeleton } from "@/components/ui/misc";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12" aria-busy="true" aria-label="Učitavanje kvizova">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-3 h-12 w-72" />
      <Skeleton className="mt-3 h-5 w-56" />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="surface overflow-hidden rounded-2xl">
            <Skeleton className="aspect-[16/7] rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
