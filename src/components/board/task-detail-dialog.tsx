"use client";

import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  Trash2,
  CheckCircle2,
  Circle,
  Square,
  Diamond,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { BoardTask, BoardColumn } from "./task-card";
import { TaskAttachments } from "./task-attachments";
import { TaskComments } from "./task-comments";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface TaskDetailDialogProps {
  task: BoardTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  columns: BoardColumn[];
  members: { id: string; name: string; email: string; avatar: string | null }[];
  onSave: (taskId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

/* -------------------------------------------------------------------------- */
/*  Priority / Type configs                                                   */
/* -------------------------------------------------------------------------- */

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-400" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-500" },
  { value: "HIGH", label: "High", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-500" },
] as const;

const TYPES = [
  { value: "STORY", label: "Story", icon: CheckCircle2, color: "text-emerald-500" },
  { value: "BUG", label: "Bug", icon: Circle, color: "text-red-500" },
  { value: "TASK", label: "Task", icon: Square, color: "text-blue-500" },
  { value: "EPIC", label: "Epic", icon: Diamond, color: "text-purple-500" },
] as const;

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  projectId,
  columns,
  members,
  onSave,
  onDelete,
}: TaskDetailDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [type, setType] = useState<string>("TASK");
  const [status, setStatus] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [storyPoints, setStoryPoints] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync form with task data
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setType(task.type);
      setStatus(task.status);
      setAssigneeId(task.assignee?.id || "none");
      setStoryPoints(
        task.storyPoints != null ? String(task.storyPoints) : ""
      );
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
    }
  }, [task]);

  const handleSave = useCallback(async () => {
    if (!task || !title.trim()) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: title.trim(),
        description: description || null,
        priority,
        type,
        status,
        assigneeId: assigneeId === "none" ? null : assigneeId,
        storyPoints: storyPoints ? parseInt(storyPoints, 10) : null,
        dueDate: dueDate ? dueDate.toISOString() : null,
      };
      await onSave(task.id, data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [
    task, title, description, priority, type, status,
    assigneeId, storyPoints, dueDate, onSave, onOpenChange,
  ]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }, [task, onDelete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col !p-0 gap-0"
        showCloseButton={true}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>Edit task details</DialogDescription>
        </DialogHeader>

        {task && (
          <>
            {/* Title bar */}
            <div className="flex items-center gap-3 border-b px-6 py-4 pr-12">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 border-0 bg-transparent text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
                placeholder="Task title..."
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="shrink-0"
              >
                <Save className="mr-1.5 size-3.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left column — content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Description
                  </Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description..."
                    rows={4}
                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 resize-none"
                  />
                </div>

                {/* Attachments */}
                <TaskAttachments projectId={projectId} taskId={task.id} />

                {/* Comments */}
                <TaskComments projectId={projectId} taskId={task.id} />
              </div>

              {/* Right column — metadata sidebar */}
              <div className="w-48 md:w-56 lg:w-64 shrink-0 border-l bg-muted/20 px-4 py-5 space-y-4 overflow-y-auto">
                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem
                          key={col.id}
                          value={col.name.toLowerCase().replace(/\s+/g, "_")}
                        >
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Priority
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn("inline-block size-2 rounded-full", p.color)} />
                            {p.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Type */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Type
                  </Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <SelectItem key={t.value} value={t.value}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("size-3.5", t.color)} />
                              {t.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Assignee
                  </Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Story Points */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Story Points
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(e.target.value)}
                    placeholder="0"
                    className="h-8 w-20 text-xs"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Due Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left text-xs font-normal h-8",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1.5 size-3" />
                        {dueDate ? format(dueDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {dueDate && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setDueDate(undefined)}
                      className="text-[10px] text-muted-foreground h-5 px-1"
                    >
                      Clear date
                    </Button>
                  )}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Delete */}
                <div className="pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs"
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    {deleting ? "Deleting..." : "Delete task"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
