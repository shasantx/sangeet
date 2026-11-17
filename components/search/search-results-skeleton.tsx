import { Skeleton } from "@/components/music/loading-state";

export function SearchResultsSkeleton() {
  return (
    <div className="mt-9" aria-busy="true" aria-label="Searching the Sangeet catalogue">
      <div className="mb-5 flex items-center justify-between">
        <Skeleton className="h-3 w-40 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[.82fr_1.18fr]">
        <section>
          <Skeleton className="mb-3 h-6 w-28 rounded-lg" />
          <div className="rounded-xl border border-white/[.05] bg-white/[.02] p-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="mt-5 h-7 w-2/3 rounded-lg" />
            <Skeleton className="mt-2 h-3 w-20 rounded-full" />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-3 w-6 rounded-full" />
          </div>
          <div className="space-y-1 rounded-xl border border-white/[.045] bg-white/[.012] p-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-2.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/5 rounded-full" />
                  <Skeleton className="h-2.5 w-1/4 rounded-full" />
                </div>
                <Skeleton className="hidden h-3 w-20 rounded-full sm:block" />
                <Skeleton className="h-2.5 w-8 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <Skeleton className="mb-5 h-6 w-24 rounded-lg" />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center">
              <Skeleton className="aspect-square w-full rounded-full" />
              <Skeleton className="mt-3 h-3 w-2/3 rounded-full" />
              <Skeleton className="mt-1.5 h-2.5 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <Skeleton className="mb-5 h-6 w-20 rounded-lg" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="aspect-square w-full rounded-[10px]" />
              <Skeleton className="mt-3 h-3 w-3/4 rounded-full" />
              <Skeleton className="mt-1.5 h-2.5 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
