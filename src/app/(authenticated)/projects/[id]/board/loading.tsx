export default function BoardLoading() {
  const columnCards = [3, 2, 2, 3];

  return (
    <div className="flex gap-4 overflow-x-auto p-6 lg:p-8">
      {columnCards.map((cardCount, colIdx) => (
        <div
          key={colIdx}
          className="w-[320px] shrink-0 rounded-2xl bg-muted/30"
        >
          {/* Column header */}
          <div className="flex items-center gap-2 rounded-t-xl bg-muted/40 px-4 py-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-4 w-6 animate-pulse rounded bg-muted" />
          </div>

          {/* Cards */}
          <div className="space-y-3 p-3">
            {Array.from({ length: cardCount }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="rounded-xl border bg-white p-4 dark:bg-zinc-900"
              >
                <div className="space-y-3">
                  {/* Priority badge */}
                  <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
                  {/* Title */}
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  {/* Progress bar */}
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
                  {/* Footer: avatar + counts */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
