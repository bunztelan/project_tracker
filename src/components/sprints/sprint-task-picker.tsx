"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Square,
  Diamond,
  Search,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type BacklogTask = {
  id: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "STORY" | "BUG" | "TASK" | "EPIC";
  storyPoints: number | null;
  assignee: { id: string; name: string } | null;
};

interface SprintTaskPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sprintId: string;
  sprintName: string;
  onTasksAdded: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const TYPE_ICONS: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  STORY: { icon: CheckCircle2, className: "text-emerald-500" },
  BUG: { icon: Circle, className: "text-red-500" },
  TASK: { icon: Square, className: "text-blue-500" },
  EPIC: { icon: Diamond, className: "text-purple-500" },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function SprintTaskPicker({
  open,
  onOpenChange,
  projectId,
  sprintId,
  sprintName,
  onTasksAdded,
}: SprintTaskPickerProps) {
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");

  // Fetch backlog tasks (sprintId = null) when dialog opens
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch("");

    async function fetchBacklogTasks() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/tasks?limit=100`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (json.data?.tasks) {
          // Filter to only backlog tasks (no sprint assigned)
          const backlogTasks: BacklogTask[] = json.data.tasks
            .filter((t: Record<string, unknown>) => !t.sprintId)
            .map((t: Record<string, unknown>) => ({
              id: t.id as string,
              title: t.title as string,
              status: t.status as string,
              priority: t.priority as BacklogTask["priority"],
              type: t.type as BacklogTask["type"],
              storyPoints: t.storyPoints as number | null,
              assignee: t.assignee as BacklogTask["assignee"],
            }));
          setTasks(backlogTasks);
        }
      } catch (error) {
        console.error("Failed to fetch backlog tasks:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBacklogTasks();
  }, [open, projectId]);

  const toggleTask = useCallback((taskId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleAssign = useCallback(async () => {
    if (selected.size === 0) return;
    setAssigning(true);
    try {
      // Assign each selected task to the sprint
      const promises = Array.from(selected).map((taskId) =>
        fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sprintId }),
        })
      );
      await Promise.all(promises);
      onTasksAdded();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to assign tasks:", error);
    } finally {
      setAssigning(false);
    }
  }, [selected, projectId, sprintId, onTasksAdded, onOpenChange]);

  // Filter tasks by search
  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalPoints = filteredTasks
    .filter((t) => selected.has(t.id))
    .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Tasks to Sprint</DialogTitle>
          <DialogDescription>
            Select backlog tasks to add to{" "}
            <span className="font-medium">{sprintName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search backlog tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Selection summary */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              {selected.size} task{selected.size > 1 ? "s" : ""} selected
            </span>
            {totalPoints > 0 && (
              <span className="text-xs text-violet-600/70 dark:text-violet-400/70">
                ({totalPoints} story point{totalPoints > 1 ? "s" : ""})
              </span>
            )}
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0 max-h-[40vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {tasks.length === 0
                  ? "No backlog tasks available"
                  : "No tasks match your search"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {tasks.length === 0
                  ? "All tasks are already assigned to sprints"
                  : "Try a different search term"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTasks.map((task) => {
                const isSelected = selected.has(task.id);
                const typeConfig = TYPE_ICONS[task.type] || TYPE_ICONS.TASK;
                const TypeIcon = typeConfig.icon;

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                      isSelected
                        ? "bg-violet-50 border border-violet-200 dark:bg-violet-900/20 dark:border-violet-700"
                        : "hover:bg-muted/50 border border-transparent"
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        isSelected
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="size-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Type icon */}
                    <TypeIcon
                      className={cn("size-4 shrink-0", typeConfig.className)}
                    />

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold",
                            PRIORITY_COLORS[task.priority]
                          )}
                        >
                          {task.priority}
                        </span>
                        {task.assignee && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {task.assignee.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Story points */}
                    {task.storyPoints != null && task.storyPoints > 0 && (
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                        {task.storyPoints}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assigning || selected.size === 0}
          >
            {assigning
              ? "Adding..."
              : `Add ${selected.size} Task${selected.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
