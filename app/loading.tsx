export default function Loading() {
  return (
    <div className="page-container" aria-label="Loading page" aria-busy="true">
      <div className="mb-8 space-y-3">
        <div className="skeleton h-2.5 w-28 rounded-full" />
        <div className="skeleton h-10 w-[min(70%,360px)] rounded-lg" />
        <div className="skeleton h-3 w-[min(88%,460px)] rounded-full" />
      </div>

      <div className="skeleton aspect-[16/7] w-full rounded-2xl sm:aspect-[16/5]" />

      <div className="mt-10 flex items-end justify-between gap-4">
        <div className="space-y-2.5">
          <div className="skeleton h-2 w-20 rounded-full" />
          <div className="skeleton h-6 w-44 rounded-md" />
        </div>
        <div className="skeleton h-3 w-16 rounded-full" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="skeleton aspect-square w-full rounded-[10px]" />
            <div className="skeleton h-3 w-4/5 rounded-full" />
            <div className="skeleton h-2.5 w-3/5 rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-12 space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg p-2">
            <div className="skeleton h-10 w-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-3 w-[min(54%,220px)] rounded-full" />
              <div className="skeleton h-2.5 w-[min(34%,140px)] rounded-full" />
            </div>
            <div className="skeleton h-2.5 w-8 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
