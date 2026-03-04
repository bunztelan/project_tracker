"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface WidgetConfig {
  uploadId: string;
  sheetName: string;
  xAxis: string;
  yAxes: string[];
  groupBy?: string;
  title?: string;
  kpiColumn?: string;
  kpiAggregation?: "sum" | "avg" | "count" | "min" | "max";
}

export type ChartType = "BAR" | "LINE" | "PIE" | "TABLE" | "KPI";

interface ChartRendererProps {
  type: ChartType;
  config: WidgetConfig;
  data: Record<string, unknown>[];
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CHART_COLORS = [
  "#8b5cf6", // violet-500
  "#6366f1", // indigo-500
  "#3b82f6", // blue-500
  "#06b6d4", // cyan-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
];

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
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">
            {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pie label                                                                  */
/* -------------------------------------------------------------------------- */

function renderPieLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}) {
  const cx = props.cx ?? 0;
  const cy = props.cy ?? 0;
  const midAngle = props.midAngle ?? 0;
  const innerRadius = props.innerRadius ?? 0;
  const outerRadius = props.outerRadius ?? 0;
  const percent = props.percent ?? 0;
  const name = props.name ?? "";

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.04) return null;

  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      className="text-foreground"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart components                                                          */
/* -------------------------------------------------------------------------- */

function BarChartView({ config, data }: { config: WidgetConfig; data: Record<string, unknown>[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-zinc-700" />
          <XAxis
            dataKey={config.xAxis}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={{ stroke: "currentColor", className: "text-gray-200 dark:text-zinc-700" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={{ stroke: "currentColor", className: "text-gray-200 dark:text-zinc-700" }}
          />
          <Tooltip content={<CustomTooltip />} />
          {config.yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="rect" />}
          {config.yAxes.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              opacity={0.9}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartView({ config, data }: { config: WidgetConfig; data: Record<string, unknown>[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-zinc-700" />
          <XAxis
            dataKey={config.xAxis}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={{ stroke: "currentColor", className: "text-gray-200 dark:text-zinc-700" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={{ stroke: "currentColor", className: "text-gray-200 dark:text-zinc-700" }}
          />
          <Tooltip content={<CustomTooltip />} />
          {config.yAxes.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />}
          {config.yAxes.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2.5}
              dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length], stroke: "white", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: CHART_COLORS[i % CHART_COLORS.length], fill: "white", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieChartView({ config, data }: { config: WidgetConfig; data: Record<string, unknown>[] }) {
  const pieData = useMemo(() => {
    const yKey = config.yAxes[0];
    if (!yKey) return [];
    return data.map((row) => ({
      name: String(row[config.xAxis] ?? ""),
      value: Number(row[yKey]) || 0,
    }));
  }, [config, data]);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={90}
            dataKey="value"
            nameKey="name"
            label={renderPieLabel}
            labelLine={{ stroke: "currentColor", className: "text-muted-foreground" }}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TableView({ config, data }: { config: WidgetConfig; data: Record<string, unknown>[] }) {
  const columns = [config.xAxis, ...config.yAxes];
  const displayData = data.slice(0, 50); // Show first 50 rows in widget

  return (
    <div className="max-h-72 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {columns.map((col) => (
              <TableHead key={col} className="text-xs font-semibold">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col} className="text-sm">
                  {row[col] != null ? String(row[col]) : ""}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function KpiView({ config, data }: { config: WidgetConfig; data: Record<string, unknown>[] }) {
  const kpiValue = useMemo(() => {
    const col = config.kpiColumn || config.yAxes[0];
    if (!col) return 0;

    const values = data.map((r) => Number(r[col]) || 0);
    if (values.length === 0) return 0;

    const aggregation = config.kpiAggregation || "sum";
    switch (aggregation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
      case "count":
        return values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }, [config, data]);

  const label = config.title || config.kpiColumn || config.yAxes[0] || "Value";
  const aggregationLabel = config.kpiAggregation || "sum";

  return (
    <div className="flex h-72 flex-col items-center justify-center">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-5xl font-bold bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
        {kpiValue.toLocaleString()}
      </p>
      <p className="mt-2 text-xs text-muted-foreground/70 capitalize">
        {aggregationLabel} of {config.kpiColumn || config.yAxes[0]}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ChartRenderer                                                             */
/* -------------------------------------------------------------------------- */

export function ChartRenderer({ type, config, data, className }: ChartRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex h-72 items-center justify-center ${className || ""}`}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20">
            <BarChart className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {type === "BAR" && <BarChartView config={config} data={data} />}
      {type === "LINE" && <LineChartView config={config} data={data} />}
      {type === "PIE" && <PieChartView config={config} data={data} />}
      {type === "TABLE" && <TableView config={config} data={data} />}
      {type === "KPI" && <KpiView config={config} data={data} />}
    </div>
  );
}
