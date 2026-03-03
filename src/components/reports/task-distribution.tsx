"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

export type DistributionData = {
  byStatus: DistributionItem[];
  byPriority: DistributionItem[];
  byType: DistributionItem[];
};

interface TaskDistributionProps {
  data: DistributionData;
}

/* -------------------------------------------------------------------------- */
/*  Custom tooltip                                                            */
/* -------------------------------------------------------------------------- */

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { name: string; value: number; color: string; percent: number };
  }>;
}) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const pct = Math.round(entry.payload.percent * 100);

  return (
    <div className="rounded-lg border bg-white px-4 py-3 shadow-lg dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span className="font-medium text-foreground">{entry.payload.name}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {entry.value} task{entry.value !== 1 ? "s" : ""} ({pct}%)
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Custom legend                                                             */
/* -------------------------------------------------------------------------- */

function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Donut sub-chart                                                           */
/* -------------------------------------------------------------------------- */

function DonutSection({
  title,
  items,
}: {
  title: string;
  items: DistributionItem[];
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center">
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          {title}
        </h4>
        <div className="flex h-52 w-52 items-center justify-center">
          <p className="text-xs text-muted-foreground/70">No data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <h4 className="mb-1 text-sm font-medium text-muted-foreground">
        {title}
      </h4>
      <div className="h-56 w-full max-w-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              cx="50%"
              cy="45%"
              innerRadius={45}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {items.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {/* Center label showing total */}
            <text
              x="50%"
              y="45%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-xl font-bold"
            >
              {total}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  TaskDistribution                                                          */
/* -------------------------------------------------------------------------- */

export function TaskDistribution({ data }: TaskDistributionProps) {
  const hasAnyData =
    data.byStatus.some((d) => d.value > 0) ||
    data.byPriority.some((d) => d.value > 0) ||
    data.byType.some((d) => d.value > 0);

  if (!hasAnyData) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
            <svg
              className="h-6 w-6 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No tasks to analyze
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create tasks in this project to see distribution charts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <DonutSection title="By Status" items={data.byStatus} />
      <DonutSection title="By Priority" items={data.byPriority} />
      <DonutSection title="By Type" items={data.byType} />
    </div>
  );
}
