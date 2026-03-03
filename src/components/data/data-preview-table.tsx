"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface DataPreviewTableProps {
  sheets: Record<string, ParsedSheet>;
  sheetNames: string[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const ROWS_PER_PAGE = 20;

function detectColumnType(rows: Record<string, unknown>[], column: string): string {
  const sampleValues = rows.slice(0, 50).map((r) => r[column]).filter((v) => v != null && v !== "");
  if (sampleValues.length === 0) return "text";

  const allNumbers = sampleValues.every((v) => typeof v === "number" || !isNaN(Number(v)));
  if (allNumbers) return "number";

  const allBooleans = sampleValues.every(
    (v) => typeof v === "boolean" || v === "true" || v === "false" || v === "TRUE" || v === "FALSE"
  );
  if (allBooleans) return "boolean";

  // Rough date detection
  const datePattern = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;
  const allDates = sampleValues.every((v) => typeof v === "string" && datePattern.test(v));
  if (allDates) return "date";

  return "text";
}

function getTypeIcon(type: string) {
  switch (type) {
    case "number":
      return <Hash className="h-3 w-3" />;
    case "date":
      return <Calendar className="h-3 w-3" />;
    case "boolean":
      return <ToggleLeft className="h-3 w-3" />;
    default:
      return <Type className="h-3 w-3" />;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "number":
      return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10";
    case "date":
      return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10";
    case "boolean":
      return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10";
    default:
      return "text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10";
  }
}

function formatCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    // Format numbers with locale-specific formatting
    return value.toLocaleString();
  }
  return String(value);
}

/* -------------------------------------------------------------------------- */
/*  DataPreviewTable                                                          */
/* -------------------------------------------------------------------------- */

export function DataPreviewTable({ sheets, sheetNames }: DataPreviewTableProps) {
  const [activeSheet, setActiveSheet] = useState(sheetNames[0] || "");
  const [currentPage, setCurrentPage] = useState(1);

  const currentSheetData = sheets[activeSheet];
  const headers = currentSheetData?.headers ?? [];
  const rows = currentSheetData?.rows ?? [];

  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

  // Detect column types from sampled data
  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    for (const header of headers) {
      types[header] = detectColumnType(rows, header);
    }
    return types;
  }, [headers, rows]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
    return rows.slice(startIdx, startIdx + ROWS_PER_PAGE);
  }, [rows, currentPage]);

  // Reset page when switching sheets
  function handleSheetChange(name: string) {
    setActiveSheet(name);
    setCurrentPage(1);
  }

  if (sheetNames.length === 0 || !currentSheetData) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-muted-foreground">No data to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sheet selector tabs */}
      {sheetNames.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => handleSheetChange(name)}
              className={`
                shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all
                ${activeSheet === name
                  ? "bg-white text-violet-700 shadow-sm dark:bg-zinc-800 dark:text-violet-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50"
                }
              `}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Data summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
        <span className="h-3 w-px bg-border" />
        <span>{headers.length} column{headers.length !== 1 ? "s" : ""}</span>
        {sheetNames.length > 1 && (
          <>
            <span className="h-3 w-px bg-border" />
            <span>{sheetNames.length} sheet{sheetNames.length !== 1 ? "s" : ""}</span>
          </>
        )}
      </div>

      {/* Table with horizontal scroll */}
      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12 text-center text-xs font-semibold text-muted-foreground sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  #
                </TableHead>
                {headers.map((header) => (
                  <TableHead
                    key={header}
                    className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-xs">{header}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getTypeColor(columnTypes[header])}`}
                      >
                        {getTypeIcon(columnTypes[header])}
                        {columnTypes[header]}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row, rowIndex) => {
                const globalIndex = (currentPage - 1) * ROWS_PER_PAGE + rowIndex + 1;
                return (
                  <TableRow key={rowIndex} className="group">
                    <TableCell className="text-center text-xs font-mono text-muted-foreground/60">
                      {globalIndex}
                    </TableCell>
                    {headers.map((header) => (
                      <TableCell key={header} className="text-sm">
                        {formatCellValue(row[header])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * ROWS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ROWS_PER_PAGE, rows.length)} of {rows.length} rows
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <span className="px-3 text-xs font-medium text-muted-foreground">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
