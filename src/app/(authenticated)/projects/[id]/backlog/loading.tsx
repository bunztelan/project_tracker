export default function BacklogLoading() {
  return (
    <div className="space-y-4 p-6 lg:p-8">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded-xl bg-muted" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border">
        {/* Header */}
        <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-3">
          {[120, 200, 80, 80, 100, 80].map((w, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-muted"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <div className="h-4 w-[120px] animate-pulse rounded bg-muted" />
            <div className="h-4 w-[200px] animate-pulse rounded bg-muted" />
            <div className="h-5 w-[80px] animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-[80px] animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-[100px] animate-pulse rounded bg-muted" />
            <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
