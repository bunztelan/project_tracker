"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Send,
  Paperclip,
  X,
  Loader2,
  Trash2,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface CommentInfo {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  author: { id: string; name: string; avatar: string | null };
  attachments: AttachmentInfo[];
}

interface TaskCommentsProps {
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function TaskComments({ projectId, taskId }: TaskCommentsProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<CommentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ---- Fetch ---- */

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/comments`
      );
      const result = await res.json();
      if (result.data) setComments(result.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  /* ---- Submit ---- */

  async function handleSubmit() {
    if (!body.trim() && selectedFiles.length === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("body", body.trim());
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/comments`,
        { method: "POST", body: formData }
      );
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to post comment");
        return;
      }

      if (result.data) {
        setComments((prev) => [...prev, result.data]);
      }
      setBody("");
      setSelectedFiles([]);
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- File selection ---- */

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /* ---- Delete ---- */

  async function handleDelete(commentId: string) {
    setDeletingId(commentId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
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
        Loading comments...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="size-3" />
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {/* Comment list */}
      {comments.length > 0 && (
        <div ref={scrollRef} className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {comments.map((comment) => {
            const canDelete =
              session?.user?.id === comment.authorId;

            return (
              <div
                key={comment.id}
                className="group relative flex gap-2.5"
              >
                {/* Avatar */}
                <Avatar className="size-7 shrink-0 mt-0.5">
                  {comment.author.avatar && (
                    <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
                  )}
                  <AvatarFallback className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                    {getInitials(comment.author.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {comment.author.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  {comment.body && (
                    <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-wrap break-words">
                      {comment.body}
                    </p>
                  )}

                  {/* Comment attachments */}
                  {comment.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {comment.attachments.map((att) => {
                        const isImage = IMAGE_TYPES.has(att.mimeType);
                        const Icon = getFileIcon(att.mimeType);

                        return isImage ? (
                          <a
                            key={att.id}
                            href={`/api/files/${att.filePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={`/api/files/${att.filePath}`}
                              alt={att.fileName}
                              className="h-16 rounded-md object-cover border"
                            />
                          </a>
                        ) : (
                          <a
                            key={att.id}
                            href={`/api/files/${att.filePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            <Icon className="size-3" />
                            <span className="max-w-[120px] truncate">
                              {att.fileName}
                            </span>
                            <span className="text-[10px]">
                              {formatFileSize(att.fileSize)}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Delete button */}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0 mt-0.5"
                  >
                    {deletingId === comment.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Comment input */}
      <div className="space-y-2">
        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
              >
                <Paperclip className="size-2.5" />
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  className="ml-0.5 hover:text-red-500 transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          <div className="flex-1 rounded-lg border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                // Auto-resize
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Write a comment..."
              rows={3}
              className="w-full bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none placeholder:text-muted-foreground resize-none min-h-[72px] max-h-[200px]"
            />
            <div className="flex items-center justify-end px-2 pb-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors rounded"
              >
                <Paperclip className="size-3.5" />
              </button>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || (!body.trim() && selectedFiles.length === 0)}
            className="shrink-0 size-9 p-0 rounded-lg"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
