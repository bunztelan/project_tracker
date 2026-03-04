export default function DashboardLoading() {
  return (
    <div className="space-y-8 p-6 lg:p-8">
      {/* Greeting area */}
      <div className="space-y-2">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-8 w-72 animate-pulse rounded bg-muted" />
      </div>

      {/* KPI cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2/3 + 1/3 grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left side – project cards */}
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="flex items-center gap-4">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>

        {/* Right side – activity placeholder */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
