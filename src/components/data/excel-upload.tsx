"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/project-context";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface ExcelUploadProps {
  onUploadSuccess: () => void;
}

type UploadState = "idle" | "selected" | "uploading" | "success" | "error";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

const ACCEPTED_EXTENSIONS = ".xlsx,.xls,.csv";

/* -------------------------------------------------------------------------- */
/*  ExcelUpload                                                               */
/* -------------------------------------------------------------------------- */

export function ExcelUpload({ onUploadSuccess }: ExcelUploadProps) {
  const { project } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  /* ---- Drag & drop handlers ---- */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      selectFile(droppedFile);
    }
  }, []);

  /* ---- File selection ---- */

  function selectFile(f: File) {
    const ext = f.name.toLowerCase().split(".").pop();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      setErrorMessage("Invalid file type. Please upload .xlsx, .xls, or .csv files.");
      setUploadState("error");
      return;
    }

    if (f.size > 10 * 1024 * 1024) {
      setErrorMessage("File is too large. Maximum size is 10 MB.");
      setUploadState("error");
      return;
    }

    setFile(f);
    setUploadState("selected");
    setErrorMessage("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      selectFile(selected);
    }
  }

  /* ---- Upload handler ---- */

  async function handleUpload() {
    if (!file) return;

    setUploadState("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/projects/${project.id}/excel`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Upload failed");
      }

      setUploadState("success");

      // Reset after short delay to show success state
      setTimeout(() => {
        setFile(null);
        setUploadState("idle");
        onUploadSuccess();
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploadState("error");
    }
  }

  /* ---- Clear / reset ---- */

  function handleClear() {
    setFile(null);
    setUploadState("idle");
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* ---- Render ---- */

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => uploadState === "idle" && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200
          ${isDragOver
            ? "border-violet-500 bg-violet-50/50 dark:bg-violet-500/10 scale-[1.01]"
            : uploadState === "error"
              ? "border-red-300 bg-red-50/30 dark:border-red-500/40 dark:bg-red-500/5"
              : uploadState === "success"
                ? "border-green-300 bg-green-50/30 dark:border-green-500/40 dark:bg-green-500/5"
                : "border-gray-300 bg-gray-50/30 hover:border-violet-400 hover:bg-violet-50/30 dark:border-zinc-700 dark:bg-zinc-800/30 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/5"
          }
          ${uploadState === "idle" ? "cursor-pointer" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Upload states */}
        {uploadState === "idle" && (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20">
              <Upload className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Drop your file here
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or <span className="text-violet-600 dark:text-violet-400 font-medium">browse</span> to choose a file
            </p>
            <p className="mt-3 text-xs text-muted-foreground/70">
              Supports .xlsx, .xls, .csv (max 10 MB)
            </p>
          </>
        )}

        {(uploadState === "selected" || uploadState === "uploading") && file && (
          <div className="flex w-full max-w-sm items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20">
              <FileSpreadsheet className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            {uploadState === "selected" && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {uploadState === "success" && (
          <div className="flex flex-col items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              File uploaded successfully!
            </p>
          </div>
        )}

        {uploadState === "error" && (
          <div className="flex flex-col items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
              <X className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {errorMessage}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="mt-2 text-xs"
            >
              Try again
            </Button>
          </div>
        )}
      </div>

      {/* Upload button */}
      {uploadState === "selected" && (
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-md shadow-violet-500/25"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>
      )}

      {uploadState === "uploading" && (
        <div className="flex justify-end">
          <Button disabled className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </Button>
        </div>
      )}
    </div>
  );
}
