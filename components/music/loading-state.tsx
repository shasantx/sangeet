import { cn } from "@/lib/utils";

export function LoadingState({ label = "Loading your music" }: { label?: string }) {
  return (
    <div className="page-container" aria-busy="true" aria-label={label}>
      <div className="mb-10 space-y-4">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-10 w-2/3 max-w-md rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="skeleton aspect-square rounded-[10px]" />
            <div className="skeleton h-3 w-3/4 rounded-full" />
            <div className="skeleton h-2.5 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}
