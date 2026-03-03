"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import {
  Plus,
  Zap,
  CheckCircle2,
  Circle,
  Square,
  Diamond,
  Target,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Play,
  CheckCheck,
  Trash2,
  ListPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CreateSprintDialog } from "@/components/sprints/create-sprint-dialog";
import { SprintTaskPicker } from "@/components/sprints/sprint-task-picker";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type SprintTask = {
  id: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "STORY" | "BUG" | "TASK" | "EPIC";
  storyPoints: number | null;
  dueDate: string | null;
  assignee: { id: string; name: string; email: string; avatar: string | null } | null;
  sprintId: string | null;
};

type SprintData = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "PLANNING" | "ACTIVE" | "COMPLETED";
  createdAt: string;
  taskCount: number;
  completedTaskCount: number;
  tasks: SprintTask[];
};

interface SprintBoardProps {
  initialSprints: SprintData[];
  projectId: string;
  canManage: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  PLANNING: {
    label: "Planning",
    className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700",
  },
};

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

const TASK_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  todo: { label: "To Do", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  in_review: { label: "In Review", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  done: { label: "Done", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
};

/* -------------------------------------------------------------------------- */
/*  Helper                                                                    */
/* -------------------------------------------------------------------------- */

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

export function SprintBoard({
  initialSprints,
  projectId,
  canManage,
}: SprintBoardProps) {
  const router = useRouter();
  const [sprints, setSprints] = useState<SprintData[]>(initialSprints);
  const [createOpen, setCreateOpen] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [activePickerSprint, setActivePickerSprint] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  // Separate sprints by status
  const activeSprint = sprints.find((s) => s.status === "ACTIVE") || null;
  const planningSprints = sprints.filter((s) => s.status === "PLANNING");
  const completedSprints = sprints.filter((s) => s.status === "COMPLETED");

  /* -------------------------------------------------------------------------- */
  /*  Refresh data                                                              */
  /* -------------------------------------------------------------------------- */

  const refreshSprints = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.data) return;

      // We need to fetch detailed data for each sprint to get tasks
      const detailedSprints: SprintData[] = await Promise.all(
        json.data.map(async (s: SprintData) => {
          const detailRes = await fetch(
            `/api/projects/${projectId}/sprints/${s.id}`
          );
          if (!detailRes.ok) return { ...s, tasks: [] };
          const detailJson = await detailRes.json();
          return detailJson.data || { ...s, tasks: [] };
        })
      );

      setSprints(detailedSprints);
    } catch (error) {
      console.error("Failed to refresh sprints:", error);
    }
  }, [projectId]);

  /* -------------------------------------------------------------------------- */
  /*  Handlers                                                                  */
  /* -------------------------------------------------------------------------- */

  const handleCreateSprint = useCallback(
    async (data: {
      name: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create sprint");
      await refreshSprints();
    },
    [projectId, refreshSprints]
  );

  const handleStartSprint = useCallback(
    async (sprintId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/sprints/${sprintId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        alert(json.message || "Failed to start sprint");
        return;
      }

      await refreshSprints();
    },
    [projectId, refreshSprints]
  );

  const handleCompleteSprint = useCallback(
    async (sprintId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/sprints/${sprintId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        }
      );

      if (!res.ok) throw new Error("Failed to complete sprint");
      await refreshSprints();
    },
    [projectId, refreshSprints]
  );

  const handleDeleteSprint = useCallback(
    async (sprintId: string) => {
      if (!confirm("Are you sure you want to delete this sprint? Tasks will be moved back to the backlog.")) return;

      const res = await fetch(
        `/api/projects/${projectId}/sprints/${sprintId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Failed to delete sprint");
      await refreshSprints();
    },
    [projectId, refreshSprints]
  );

  const handleRemoveTask = useCallback(
    async (taskId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sprintId: null }),
        }
      );

      if (!res.ok) throw new Error("Failed to remove task");
      await refreshSprints();
    },
    [projectId, refreshSprints]
  );

  const openTaskPicker = useCallback(
    (sprint: { id: string; name: string }) => {
      setActivePickerSprint(sprint);
      setTaskPickerOpen(true);
    },
    []
  );

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  /* -------------------------------------------------------------------------- */
  /*  Sprint Card (for Active sprint — full card)                               */
  /* -------------------------------------------------------------------------- */

  function ActiveSprintCard({ sprint }: { sprint: SprintData }) {
    const progress =
      sprint.taskCount > 0
        ? Math.round((sprint.completedTaskCount / sprint.taskCount) * 100)
        : 0;

    const totalPoints = sprint.tasks.reduce(
      (sum, t) => sum + (t.storyPoints || 0),
      0
    );
    const completedPoints = sprint.tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    const daysLeft =
      sprint.endDate
        ? Math.max(0, differenceInDays(new Date(sprint.endDate), new Date()))
        : null;

    return (
      <div className="relative rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/50 shadow-lg dark:border-blue-800 dark:from-blue-950/30 dark:via-zinc-900 dark:to-violet-950/20">
        {/* Gradient accent bar at top */}
        <div className="h-1.5 rounded-t-lg bg-gradient-to-r from-blue-500 via-violet-500 to-indigo-500" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-md shadow-blue-500/20">
                <Zap className="size-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">{sprint.name}</h2>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      STATUS_BADGE.ACTIVE.className
                    )}
                  >
                    {STATUS_BADGE.ACTIVE.label}
                  </span>
                </div>
                {sprint.goal && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Target className="size-3.5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {sprint.goal}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {canManage && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    openTaskPicker({ id: sprint.id, name: sprint.name })
                  }
                >
                  <ListPlus className="size-4" />
                  Add Tasks
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleCompleteSprint(sprint.id)}
                >
                  <CheckCheck className="size-4" />
                  Complete Sprint
                </Button>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-4 gap-4">
            {/* Progress */}
            <div className="rounded-lg border bg-white/70 p-3 dark:bg-zinc-800/50">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Progress
              </p>
              <p className="mt-1 text-2xl font-bold">{progress}%</p>
            </div>

            {/* Tasks */}
            <div className="rounded-lg border bg-white/70 p-3 dark:bg-zinc-800/50">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Tasks
              </p>
              <p className="mt-1 text-2xl font-bold">
                {sprint.completedTaskCount}
                <span className="text-base font-normal text-muted-foreground">
                  /{sprint.taskCount}
                </span>
              </p>
            </div>

            {/* Story Points */}
            <div className="rounded-lg border bg-white/70 p-3 dark:bg-zinc-800/50">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Story Points
              </p>
              <p className="mt-1 text-2xl font-bold">
                {completedPoints}
                <span className="text-base font-normal text-muted-foreground">
                  /{totalPoints}
                </span>
              </p>
            </div>

            {/* Days left or date range */}
            <div className="rounded-lg border bg-white/70 p-3 dark:bg-zinc-800/50">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {daysLeft !== null ? "Days Left" : "Date Range"}
              </p>
              {daysLeft !== null ? (
                <p
                  className={cn(
                    "mt-1 text-2xl font-bold",
                    daysLeft <= 2 && "text-red-600 dark:text-red-400",
                    daysLeft > 2 && daysLeft <= 5 && "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {daysLeft}
                </p>
              ) : (
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  No dates set
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {sprint.startDate && sprint.endDate && (
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {format(new Date(sprint.startDate), "MMM d")}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {format(new Date(sprint.endDate), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>

          {/* Task list */}
          {sprint.tasks.length > 0 && (
            <div className="mt-5">
              <TaskList
                tasks={sprint.tasks}
                canManage={canManage}
                onRemoveTask={handleRemoveTask}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /*  Sprint Section (for Planning / Completed)                                 */
  /* -------------------------------------------------------------------------- */

  function SprintSection({
    sprint,
    sectionType,
  }: {
    sprint: SprintData;
    sectionType: "planning" | "completed";
  }) {
    const isCollapsed = collapsedSections.has(sprint.id);
    const progress =
      sprint.taskCount > 0
        ? Math.round((sprint.completedTaskCount / sprint.taskCount) * 100)
        : 0;

    const statusBadge = STATUS_BADGE[sprint.status];

    return (
      <div className="rounded-xl border bg-white shadow-sm dark:bg-zinc-900">
        {/* Section header — clickable */}
        <button
          type="button"
          onClick={() => toggleSection(sprint.id)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl"
        >
          {isCollapsed ? (
            <ChevronRight className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">{sprint.name}</h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-semibold",
                  statusBadge.className
                )}
              >
                {statusBadge.label}
              </span>
            </div>
            {sprint.goal && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {sprint.goal}
              </p>
            )}
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-4 shrink-0">
            {sprint.startDate && sprint.endDate && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {format(new Date(sprint.startDate), "MMM d")} -{" "}
                {format(new Date(sprint.endDate), "MMM d")}
              </span>
            )}

            <span className="text-xs font-medium">
              {sprint.completedTaskCount}/{sprint.taskCount} tasks
            </span>

            {sprint.taskCount > 0 && (
              <div className="w-20 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    sectionType === "completed"
                      ? "bg-emerald-500"
                      : "bg-violet-500"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Actions */}
            {canManage && (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {sectionType === "planning" && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() =>
                        openTaskPicker({ id: sprint.id, name: sprint.name })
                      }
                    >
                      <ListPlus className="size-3.5" />
                      Add Tasks
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      onClick={() => handleStartSprint(sprint.id)}
                    >
                      <Play className="size-3.5" />
                      Start
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  onClick={() => handleDeleteSprint(sprint.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </button>

        {/* Collapsed content */}
        {!isCollapsed && sprint.tasks.length > 0 && (
          <div className="border-t px-5 py-3">
            <TaskList
              tasks={sprint.tasks}
              canManage={canManage}
              onRemoveTask={handleRemoveTask}
            />
          </div>
        )}

        {!isCollapsed && sprint.tasks.length === 0 && (
          <div className="border-t px-5 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              No tasks in this sprint yet.
            </p>
            {canManage && sectionType === "planning" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5 text-xs"
                onClick={() =>
                  openTaskPicker({ id: sprint.id, name: sprint.name })
                }
              >
                <Plus className="size-3.5" />
                Add Tasks from Backlog
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <>
      <div className="px-6 py-5 space-y-6">
        {/* Create Sprint button */}
        {canManage && (
          <div className="flex justify-end">
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Create Sprint
            </Button>
          </div>
        )}

        {/* Active Sprint */}
        {activeSprint ? (
          <ActiveSprintCard sprint={activeSprint} />
        ) : (
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 p-8 text-center">
            <Zap className="mx-auto size-10 text-muted-foreground/30" />
            <h3 className="mt-3 text-sm font-semibold text-muted-foreground">
              No Active Sprint
            </h3>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Start a planning sprint to track your team&apos;s work.
            </p>
          </div>
        )}

        {/* Planning Sprints */}
        {planningSprints.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Planning
              </h2>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {planningSprints.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {planningSprints.map((sprint) => (
                <SprintSection
                  key={sprint.id}
                  sprint={sprint}
                  sectionType="planning"
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Sprints */}
        {completedSprints.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Completed
              </h2>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {completedSprints.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {completedSprints.map((sprint) => (
                <SprintSection
                  key={sprint.id}
                  sprint={sprint}
                  sectionType="completed"
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no sprints at all */}
        {sprints.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 p-12 text-center">
            <Zap className="mx-auto size-12 text-muted-foreground/20" />
            <h3 className="mt-4 text-base font-semibold text-muted-foreground">
              No sprints yet
            </h3>
            <p className="mt-2 text-sm text-muted-foreground/70 max-w-md mx-auto">
              Sprints help you organize work into focused, time-boxed
              iterations. Create your first sprint to get started.
            </p>
            {canManage && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-4 gap-1.5"
              >
                <Plus className="size-4" />
                Create First Sprint
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Sprint dialog */}
      <CreateSprintDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateSprint}
      />

      {/* Task picker dialog */}
      {activePickerSprint && (
        <SprintTaskPicker
          open={taskPickerOpen}
          onOpenChange={setTaskPickerOpen}
          projectId={projectId}
          sprintId={activePickerSprint.id}
          sprintName={activePickerSprint.name}
          onTasksAdded={refreshSprints}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  TaskList sub-component                                                    */
/* -------------------------------------------------------------------------- */

function TaskList({
  tasks,
  canManage,
  onRemoveTask,
}: {
  tasks: SprintData["tasks"];
  canManage: boolean;
  onRemoveTask: (taskId: string) => void;
}) {
  return (
    <div className="divide-y">
      {tasks.map((task) => {
        const typeConfig = TYPE_ICONS[task.type] || TYPE_ICONS.TASK;
        const TypeIcon = typeConfig.icon;
        const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo;
        const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM;

        return (
          <div
            key={task.id}
            className="flex items-center gap-3 py-2.5 group"
          >
            {/* Type icon */}
            <TypeIcon
              className={cn("size-4 shrink-0", typeConfig.className)}
            />

            {/* Title */}
            <span className="flex-1 text-sm font-medium truncate min-w-0">
              {task.title}
            </span>

            {/* Priority */}
            <span
              className={cn(
                "hidden sm:inline-flex items-center rounded-full px-2 py-0 text-[10px] font-semibold shrink-0",
                priorityColor
              )}
            >
              {task.priority}
            </span>

            {/* Status */}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0 text-[10px] font-semibold shrink-0",
                statusConfig.className
              )}
            >
              {statusConfig.label}
            </span>

            {/* Story Points */}
            {task.storyPoints != null && task.storyPoints > 0 && (
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                {task.storyPoints}
              </span>
            )}

            {/* Assignee */}
            {task.assignee && (
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className="text-[9px] bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  {getInitials(task.assignee.name)}
                </AvatarFallback>
              </Avatar>
            )}

            {/* Remove button */}
            {canManage && (
              <button
                type="button"
                onClick={() => onRemoveTask(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Remove from sprint"
              >
                <X className="size-3.5 text-red-500" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
