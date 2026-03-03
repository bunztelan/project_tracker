"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type VelocityDataPoint = {
  sprint: string;
  completed: number;
  committed: number;
};

interface VelocityChartProps {
  data: VelocityDataPoint[];
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
  payload?: Array<{ value: number; name: string; color: string }>;
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
          <span className="font-semibold text-foreground">{entry.value} pts</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Custom bar shape with gradient                                            */
/* -------------------------------------------------------------------------- */

function GradientBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  const id = `velocity-gradient-${x}`;

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.85} />
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={`url(#${id})`}
      />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  VelocityChart                                                             */
/* -------------------------------------------------------------------------- */

export function VelocityChart({ data }: VelocityChartProps) {
  const avgVelocity = useMemo(() => {
    if (data.length === 0) return 0;
    const total = data.reduce((sum, d) => sum + d.completed, 0);
    return Math.round((total / data.length) * 10) / 10;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
            <svg
              className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
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
            No velocity data yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Complete sprints with story points to track velocity
          </p>
        </div>
      </div>
    );
  }

  const yMax =
    Math.ceil(
      Math.max(...data.map((d) => Math.max(d.completed, d.committed))) * 1.2
    ) || 10;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
          barCategoryGap="25%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-gray-200 dark:text-zinc-700"
          />
          <XAxis
            dataKey="sprint"
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
            iconType="rect"
          />
          <ReferenceLine
            y={avgVelocity}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 3"
            label={{
              value: `Avg: ${avgVelocity}`,
              position: "right",
              style: {
                fontSize: 11,
                fill: "#f59e0b",
                fontWeight: 600,
              },
            }}
          />
          <Bar
            dataKey="completed"
            name="Completed"
            shape={<GradientBar />}
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="committed"
            name="Committed"
            fill="#c7d2fe"
            radius={[6, 6, 0, 0]}
            opacity={0.6}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
