"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Paperclip,
  X,
  Loader2,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface AttachmentInfo {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  uploadedBy: { id: string; name: string; avatar: string | null };
}

interface TaskAttachmentsProps {
  projectId: string;
  taskId: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ACCEPTED_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.svg";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/svg+xml"]);

const DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const SHEET_TYPES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (IMAGE_TYPES.has(mimeType)) return ImageIcon;
  if (DOC_TYPES.has(mimeType)) return FileText;
  if (SHEET_TYPES.has(mimeType)) return FileSpreadsheet;
  return FileIcon;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function TaskAttachments({ projectId, taskId }: TaskAttachmentsProps) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Fetch ---- */

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments`
      );
      const result = await res.json();
      if (result.data) setAttachments(result.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  /* ---- Upload ---- */

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `/api/projects/${projectId}/tasks/${taskId}/attachments`,
          { method: "POST", body: formData }
        );
        const result = await res.json();

        if (!res.ok) {
          toast.error(result.error || "Upload failed");
          return;
        }

        if (result.data) {
          setAttachments((prev) => [result.data, ...prev]);
        }
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [projectId, taskId]
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ---- Drag & drop ---- */

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  /* ---- Delete ---- */

  async function handleDelete(attachmentId: string) {
    setDeletingId(attachmentId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      } else {
        const result = await res.json();
        toast.error(result.error || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Loading attachments...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="size-3" />
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-muted-foreground h-6"
        >
          {uploading ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <span className="mr-1">+</span>
          )}
          Add file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Drop zone + attachment grid */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          min-h-[48px] rounded-lg border border-dashed transition-colors
          ${
            isDragOver
              ? "border-violet-500 bg-violet-50/50 dark:bg-violet-500/10"
              : attachments.length === 0
                ? "border-border/50"
                : "border-transparent"
          }
        `}
      >
        {attachments.length === 0 && !uploading ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center py-4 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Drop files here or click to attach
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-1">
            {attachments.map((att) => {
              const isImage = IMAGE_TYPES.has(att.mimeType);
              const Icon = getFileIcon(att.mimeType);

              return (
                <div
                  key={att.id}
                  className="group relative flex items-center gap-2 rounded-lg border bg-muted/30 p-2 transition-colors hover:bg-muted/50"
                >
                  {/* Thumbnail or icon */}
                  {isImage ? (
                    <a
                      href={`/api/files/${att.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <img
                        src={`/api/files/${att.filePath}`}
                        alt={att.fileName}
                        className="size-10 rounded object-cover"
                      />
                    </a>
                  ) : (
                    <a
                      href={`/api/files/${att.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-10 shrink-0 items-center justify-center rounded bg-muted"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                    </a>
                  )}

                  {/* Name + size */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {att.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(att.fileSize)}
                    </p>
                  </div>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(att.id)}
                    disabled={deletingId === att.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 absolute top-1 right-1 size-5"
                  >
                    {deletingId === att.id ? (
                      <Loader2 className="size-2.5 animate-spin" />
                    ) : (
                      <X className="size-2.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
