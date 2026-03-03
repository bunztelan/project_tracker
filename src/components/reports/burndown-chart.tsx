"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type BurndownDataPoint = {
  day: string;
  ideal: number;
  actual: number | null;
};

interface BurndownChartProps {
  data: BurndownDataPoint[];
  totalPoints: number;
}

/* -------------------------------------------------------------------------- */
/*  Custom tooltip                                                            */
/* -------------------------------------------------------------------------- */

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-white px-4 py-3 shadow-lg dark:bg-zinc-900">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">
            {entry.value != null ? entry.value : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  BurndownChart                                                             */
/* -------------------------------------------------------------------------- */

export function BurndownChart({ data, totalPoints }: BurndownChartProps) {
  const yMax = useMemo(() => {
    return Math.max(totalPoints, ...data.map((d) => d.actual ?? 0)) + 2;
  }, [data, totalPoints]);

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/20">
            <svg
              className="h-6 w-6 text-violet-600 dark:text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No burndown data available
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Select a sprint with tasks to view the burndown chart
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-gray-200 dark:text-zinc-700"
          />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={{ stroke: "currentColor", className: "text-gray-200 dark:text-zinc-700" }}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={{ stroke: "currentColor", className: "text-gray-200 dark:text-zinc-700" }}
            label={{
              value: "Story Points",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fontSize: 11, fill: "#9ca3af" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 13 }}
            iconType="line"
          />
          <Line
            type="linear"
            dataKey="ideal"
            name="Ideal"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeDasharray="8 4"
            dot={false}
            activeDot={{ r: 4, stroke: "#9ca3af", fill: "white" }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#8b5cf6", stroke: "white", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "#8b5cf6", fill: "white", strokeWidth: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
