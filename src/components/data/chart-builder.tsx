"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TableIcon,
  Hash,
  Save,
  Loader2,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProject } from "@/contexts/project-context";
import { ChartRenderer, type WidgetConfig, type ChartType } from "./chart-renderer";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface UploadInfo {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface ParsedData {
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
}

interface ChartBuilderProps {
  uploads: UploadInfo[];
  onWidgetSaved: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Chart type options                                                        */
/* -------------------------------------------------------------------------- */

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: "BAR", label: "Bar", icon: <BarChart3 className="h-5 w-5" />, description: "Compare values" },
  { type: "LINE", label: "Line", icon: <LineChartIcon className="h-5 w-5" />, description: "Show trends" },
  { type: "PIE", label: "Pie", icon: <PieChartIcon className="h-5 w-5" />, description: "Show proportions" },
  { type: "TABLE", label: "Table", icon: <TableIcon className="h-5 w-5" />, description: "Raw data view" },
  { type: "KPI", label: "KPI", icon: <Hash className="h-5 w-5" />, description: "Key metric" },
];

/* -------------------------------------------------------------------------- */
/*  ChartBuilder                                                              */
/* -------------------------------------------------------------------------- */

export function ChartBuilder({ uploads, onWidgetSaved }: ChartBuilderProps) {
  const { project } = useProject();

  // State
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [chartType, setChartType] = useState<ChartType>("BAR");
  const [xAxis, setXAxis] = useState("");
  const [yAxes, setYAxes] = useState<string[]>([]);
  const [chartTitle, setChartTitle] = useState("");
  const [kpiAggregation, setKpiAggregation] = useState<"sum" | "avg" | "count" | "min" | "max">("sum");
  const [saving, setSaving] = useState(false);

  /* ---- Fetch parsed data when upload is selected ---- */

  const fetchUploadData = useCallback(async (uploadId: string) => {
    if (!uploadId) return;
    setLoadingData(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/excel/${uploadId}`);
      const result = await res.json();
      if (result.data?.parsedData) {
        const pd = result.data.parsedData as ParsedData;
        setParsedData(pd);
        // Auto-select first sheet
        if (pd.sheetNames.length > 0) {
          setSelectedSheet(pd.sheetNames[0]);
        }
      }
    } catch {
      setParsedData(null);
    } finally {
      setLoadingData(false);
    }
  }, [project.id]);

  useEffect(() => {
    if (selectedUploadId) {
      fetchUploadData(selectedUploadId);
      // Reset chart config
      setSelectedSheet("");
      setXAxis("");
      setYAxes([]);
      setChartTitle("");
    }
  }, [selectedUploadId, fetchUploadData]);

  /* ---- Derived data ---- */

  const currentSheet = parsedData?.sheets[selectedSheet];
  const headers = currentSheet?.headers ?? [];
  const rows = currentSheet?.rows ?? [];

  // Detect numeric columns for Y-axis suggestions
  const numericColumns = useMemo(() => {
    if (!rows.length) return [];
    return headers.filter((h) => {
      const sample = rows.slice(0, 20).map((r) => r[h]);
      return sample.some((v) => typeof v === "number" || (!isNaN(Number(v)) && v !== "" && v != null));
    });
  }, [headers, rows]);

  // Available Y columns (exclude already selected + xAxis)
  const availableYColumns = useMemo(() => {
    return headers.filter((h) => h !== xAxis && !yAxes.includes(h));
  }, [headers, xAxis, yAxes]);

  // Preview data for chart
  const previewData = useMemo(() => {
    if (!rows.length || !xAxis || yAxes.length === 0) return [];
    return rows.slice(0, 100).map((row) => {
      const item: Record<string, unknown> = { [xAxis]: row[xAxis] };
      for (const y of yAxes) {
        item[y] = Number(row[y]) || 0;
      }
      return item;
    });
  }, [rows, xAxis, yAxes]);

  // Build widget config
  const widgetConfig: WidgetConfig = {
    uploadId: selectedUploadId,
    sheetName: selectedSheet,
    xAxis,
    yAxes,
    title: chartTitle || undefined,
    kpiColumn: chartType === "KPI" ? yAxes[0] : undefined,
    kpiAggregation: chartType === "KPI" ? kpiAggregation : undefined,
  };

  /* ---- Handlers ---- */

  function handleAddYAxis(column: string) {
    if (column && !yAxes.includes(column)) {
      setYAxes([...yAxes, column]);
    }
  }

  function handleRemoveYAxis(column: string) {
    setYAxes(yAxes.filter((y) => y !== column));
  }

  function handleSheetChange(name: string) {
    setSelectedSheet(name);
    setXAxis("");
    setYAxes([]);
  }

  async function handleSaveWidget() {
    if (!xAxis || yAxes.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/dashboards/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: chartType,
          config: widgetConfig,
          title: chartTitle,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save widget");
      }

      onWidgetSaved();
      // Reset after save
      setChartTitle("");
    } catch {
      // Error handled silently, user can retry
    } finally {
      setSaving(false);
    }
  }

  const canPreview = xAxis && yAxes.length > 0 && previewData.length > 0;
  const canSave = canPreview && selectedUploadId && selectedSheet;

  /* ---- Render ---- */

  if (uploads.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-500/20 dark:to-brand-500/20">
          <Sparkles className="h-7 w-7 text-brand-600 dark:text-brand-400" />
        </div>
        <p className="text-sm font-semibold text-foreground">No data to visualize</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload an Excel or CSV file first to start building charts
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* ------------------------------------------------------------------ */}
      {/*  Configuration Panel                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-5">
        {/* Data source */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Data Source
          </label>
          <Select value={selectedUploadId} onValueChange={setSelectedUploadId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a file..." />
            </SelectTrigger>
            <SelectContent>
              {uploads.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sheet selector */}
        {parsedData && parsedData.sheetNames.length > 1 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Sheet
            </label>
            <Select value={selectedSheet} onValueChange={handleSheetChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sheet..." />
              </SelectTrigger>
              <SelectContent>
                {parsedData.sheetNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loadingData && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading data...
          </div>
        )}

        {/* Chart type selector */}
        {selectedSheet && headers.length > 0 && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Chart Type
              </label>
              <div className="grid grid-cols-5 gap-2">
                {CHART_TYPES.map((ct) => (
                  <button
                    key={ct.type}
                    onClick={() => setChartType(ct.type)}
                    className={`
                      flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all
                      ${chartType === ct.type
                        ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-500/15 dark:text-brand-400 dark:border-brand-500/60"
                        : "border-transparent bg-muted/50 text-muted-foreground hover:border-gray-300 hover:bg-muted dark:hover:border-zinc-600"
                      }
                    `}
                  >
                    {ct.icon}
                    <span className="text-[10px] font-medium">{ct.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chart title */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Title (optional)
              </label>
              <input
                type="text"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
                placeholder="e.g. Monthly Revenue"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* X-Axis */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {chartType === "KPI" ? "Label Column" : "X-Axis"}
              </label>
              <Select value={xAxis} onValueChange={setXAxis}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Y-Axis */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {chartType === "KPI" ? "Value Column" : "Y-Axis"}
              </label>

              {/* Selected Y-axis columns */}
              {yAxes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {yAxes.map((y) => (
                    <span
                      key={y}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-400"
                    >
                      {y}
                      <button
                        onClick={() => handleRemoveYAxis(y)}
                        className="ml-0.5 rounded-full hover:bg-brand-200 dark:hover:bg-brand-500/30"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add more Y-axis columns */}
              {(chartType !== "PIE" && chartType !== "KPI" ? true : yAxes.length === 0) && availableYColumns.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select
                    value=""
                    onValueChange={(v) => handleAddYAxis(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={yAxes.length === 0 ? "Select column..." : "Add another column..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYColumns.map((h) => (
                        <SelectItem key={h} value={h}>
                          <span className="flex items-center gap-2">
                            {h}
                            {numericColumns.includes(h) && (
                              <span className="text-[10px] text-blue-500 font-medium">(numeric)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* KPI Aggregation */}
            {chartType === "KPI" && yAxes.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Aggregation
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["sum", "avg", "count", "min", "max"] as const).map((agg) => (
                    <button
                      key={agg}
                      onClick={() => setKpiAggregation(agg)}
                      className={`
                        rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all
                        ${kpiAggregation === agg
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        }
                      `}
                    >
                      {agg}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save button */}
            <Button
              onClick={handleSaveWidget}
              disabled={!canSave || saving}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-700 hover:to-brand-600 shadow-md shadow-brand-500/25 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save to Dashboard
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Live Preview                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {chartTitle || "Chart Preview"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canPreview ? (
            <ChartRenderer
              type={chartType}
              config={widgetConfig}
              data={previewData}
            />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-500/20 dark:to-brand-500/20">
                <Sparkles className="h-7 w-7 text-brand-500/50 dark:text-brand-400/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground/70">
                Configure your chart
              </p>
              <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground/50">
                Select a data source, choose a chart type, and map your columns to see a live preview
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
