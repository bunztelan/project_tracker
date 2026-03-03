"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  Trash2,
  Eye,
  X,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useProject } from "@/contexts/project-context";
import { isFeatureEnabled } from "@/lib/feature-utils";
import { ExcelUpload } from "@/components/data/excel-upload";
import { DataPreviewTable } from "@/components/data/data-preview-table";
import { ChartBuilder } from "@/components/data/chart-builder";
import { ChartRenderer, type WidgetConfig, type ChartType } from "@/components/data/chart-renderer";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface UploadInfo {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: { id: string; name: string };
}

interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface ParsedData {
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
}

interface DashboardWidget {
  id: string;
  type: ChartType;
  config: WidgetConfig;
  position: number;
  size: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* -------------------------------------------------------------------------- */
/*  DataPage                                                                  */
/* -------------------------------------------------------------------------- */

export default function DataPage() {
  const { project, features } = useProject();
  const router = useRouter();

  // Feature gate — redirect if excel feature is disabled
  useEffect(() => {
    if (!isFeatureEnabled(features, "excel")) {
      router.replace(`/projects/${project.id}/board`);
    }
  }, [features, project.id, router]);

  // State
  const [uploads, setUploads] = useState<UploadInfo[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [loadingWidgets, setLoadingWidgets] = useState(true);
  const [previewUploadId, setPreviewUploadId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ParsedData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [widgetDataCache, setWidgetDataCache] = useState<Record<string, Record<string, unknown>[]>>({});
  const [showUploadSection, setShowUploadSection] = useState(true);

  /* ---- Fetch uploads ---- */

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/excel`);
      const result = await res.json();
      if (result.data) {
        setUploads(result.data);
      }
    } catch {
      // Silent failure
    } finally {
      setLoadingUploads(false);
    }
  }, [project.id]);

  /* ---- Fetch dashboard widgets ---- */

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/dashboards`);
      const result = await res.json();
      if (result.data?.widgets) {
        setWidgets(result.data.widgets);
      }
    } catch {
      // Silent failure
    } finally {
      setLoadingWidgets(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchUploads();
    fetchWidgets();
  }, [fetchUploads, fetchWidgets]);

  /* ---- Load widget data for rendering ---- */

  const loadWidgetData = useCallback(async (widget: DashboardWidget) => {
    const cacheKey = `${widget.config.uploadId}__${widget.config.sheetName}`;
    if (widgetDataCache[cacheKey]) return;

    try {
      const res = await fetch(`/api/projects/${project.id}/excel/${widget.config.uploadId}`);
      const result = await res.json();
      if (result.data?.parsedData) {
        const pd = result.data.parsedData as ParsedData;
        const sheet = pd.sheets[widget.config.sheetName];
        if (sheet) {
          setWidgetDataCache((prev) => ({
            ...prev,
            [cacheKey]: sheet.rows,
          }));
        }
      }
    } catch {
      // Silent failure
    }
  }, [project.id, widgetDataCache]);

  // Load data for all widgets
  useEffect(() => {
    for (const widget of widgets) {
      loadWidgetData(widget);
    }
  }, [widgets, loadWidgetData]);

  /* ---- Preview a file ---- */

  async function handlePreview(uploadId: string) {
    if (previewUploadId === uploadId) {
      setPreviewUploadId(null);
      setPreviewData(null);
      return;
    }

    setPreviewUploadId(uploadId);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/excel/${uploadId}`);
      const result = await res.json();
      if (result.data?.parsedData) {
        setPreviewData(result.data.parsedData as ParsedData);
      }
    } catch {
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  /* ---- Delete a file ---- */

  async function handleDelete(uploadId: string) {
    setDeletingId(uploadId);
    try {
      const res = await fetch(`/api/projects/${project.id}/excel/${uploadId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        if (previewUploadId === uploadId) {
          setPreviewUploadId(null);
          setPreviewData(null);
        }
      }
    } catch {
      // Silent failure
    } finally {
      setDeletingId(null);
    }
  }

  /* ---- Delete a widget ---- */

  async function handleDeleteWidget(widgetId: string) {
    setDeletingWidgetId(widgetId);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/dashboards/widgets?widgetId=${widgetId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
      }
    } catch {
      // Silent failure
    } finally {
      setDeletingWidgetId(null);
    }
  }

  /* ---- Render ---- */

  return (
    <div className="space-y-8 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Data & Visualization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload spreadsheets, explore your data, and build interactive charts
        </p>
      </div>

      {/* ================================================================== */}
      {/*  Section 1: Upload & Preview                                        */}
      {/* ================================================================== */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Upload & Preview
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUploadSection(!showUploadSection)}
          >
            {showUploadSection ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {showUploadSection && (
          <div className="space-y-6">
            {/* Upload zone */}
            <ExcelUpload
              onUploadSuccess={() => {
                fetchUploads();
              }}
            />

            {/* Uploaded files list */}
            {loadingUploads ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading files...
              </div>
            ) : uploads.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Uploaded Files ({uploads.length})
                </h3>
                <div className="divide-y rounded-lg border">
                  {uploads.map((upload) => (
                    <div
                      key={upload.id}
                      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20">
                        <FileSpreadsheet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {upload.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(upload.fileSize)}
                          {upload.uploadedBy && (
                            <> &middot; by {upload.uploadedBy.name}</>
                          )}
                          {" "}&middot; {formatDate(upload.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handlePreview(upload.id)}
                          className={
                            previewUploadId === upload.id
                              ? "text-violet-600 dark:text-violet-400"
                              : ""
                          }
                        >
                          {previewUploadId === upload.id ? (
                            <X className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(upload.id)}
                          disabled={deletingId === upload.id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          {deletingId === upload.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Data preview */}
            {previewUploadId && (
              <Card className="rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Data Preview</CardTitle>
                  <CardDescription>
                    {uploads.find((u) => u.id === previewUploadId)?.fileName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPreview ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                    </div>
                  ) : previewData ? (
                    <DataPreviewTable
                      sheets={previewData.sheets}
                      sheetNames={previewData.sheetNames}
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center">
                      <p className="text-sm text-muted-foreground">Failed to load preview</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/*  Section 2: Chart Builder                                           */}
      {/* ================================================================== */}
      <section className="space-y-6">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          Visualization
        </h2>

        <ChartBuilder
          uploads={uploads}
          onWidgetSaved={() => {
            fetchWidgets();
          }}
        />
      </section>

      {/* ================================================================== */}
      {/*  Section 3: Saved Charts / Widget Grid                              */}
      {/* ================================================================== */}
      {(widgets.length > 0 || loadingWidgets) && (
        <section className="space-y-6">
          <h2 className="text-base font-semibold text-foreground">
            Saved Charts
          </h2>

          {loadingWidgets ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading saved charts...
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {widgets.map((widget) => {
                const cacheKey = `${widget.config.uploadId}__${widget.config.sheetName}`;
                const data = widgetDataCache[cacheKey] || [];
                const config = widget.config;

                return (
                  <Card key={widget.id} className="group relative rounded-xl shadow-sm transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {config.title || `${widget.type} Chart`}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDeleteWidget(widget.id)}
                          disabled={deletingWidgetId === widget.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          {deletingWidgetId === widget.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <CardDescription className="text-xs">
                        {widget.type} &middot; {config.xAxis}
                        {config.yAxes?.length > 0 && (
                          <> vs {config.yAxes.join(", ")}</>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {data.length > 0 ? (
                        <ChartRenderer
                          type={widget.type}
                          config={config}
                          data={data}
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-500/50" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
