"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  format,
  differenceInDays,
  addDays,
  startOfDay,
  isWeekend,
  isSameDay,
  isToday,
  min,
  max,
} from "date-fns";
import { CheckCircle2, Circle, Square, Diamond, CalendarDays, ChevronRight, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type TimelineTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "STORY" | "BUG" | "TASK" | "EPIC";
  storyPoints: number | null;
  dueDate: string | null;
  createdAt: string;
  assignee: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
  sprintId: string | null;
};

export type TimelineSprint = {
  id: string;
  name: string;
};

interface GanttChartProps {
  tasks: TimelineTask[];
  sprints: TimelineSprint[];
  projectId: string;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const DAY_WIDTH = 40;
const ROW_HEIGHT = 44;
const TASK_COL_WIDTH = 320;
const HEADER_HEIGHT = 56;

/** Pastel / muted bar colors by priority */
const PRIORITY_BAR_COLORS: Record<TimelineTask["priority"], { bg: string; border: string; text: string }> = {
  LOW: {
    bg: "bg-gray-200/70 dark:bg-gray-700/50",
    border: "border-gray-300 dark:border-gray-600",
    text: "text-gray-700 dark:text-gray-300",
  },
  MEDIUM: {
    bg: "bg-blue-200/60 dark:bg-blue-800/40",
    border: "border-blue-300 dark:border-blue-600",
    text: "text-blue-800 dark:text-blue-200",
  },
  HIGH: {
    bg: "bg-orange-200/60 dark:bg-orange-800/40",
    border: "border-orange-300 dark:border-orange-600",
    text: "text-orange-800 dark:text-orange-200",
  },
  CRITICAL: {
    bg: "bg-red-200/60 dark:bg-red-800/40",
    border: "border-red-300 dark:border-red-600",
    text: "text-red-800 dark:text-red-200",
  },
};

const TYPE_CONFIG: Record<
  TimelineTask["type"],
  { icon: typeof CheckCircle2; className: string }
> = {
  STORY: { icon: CheckCircle2, className: "text-emerald-500" },
  BUG: { icon: Circle, className: "text-red-500" },
  TASK: { icon: Square, className: "text-blue-500" },
  EPIC: { icon: Diamond, className: "text-purple-500" },
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
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

export function GanttChart({ tasks, sprints, projectId }: GanttChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [collapsedSprints, setCollapsedSprints] = useState<Set<string>>(new Set());

  // ---- Compute timeline range ----
  const { timelineStart, timelineEnd, days, todayOffset } = useMemo(() => {
    const now = startOfDay(new Date());

    if (tasks.length === 0) {
      const start = addDays(now, -7);
      const end = addDays(now, 21);
      const totalDays = differenceInDays(end, start) + 1;
      return {
        timelineStart: start,
        timelineEnd: end,
        days: Array.from({ length: totalDays }, (_, i) => addDays(start, i)),
        todayOffset: differenceInDays(now, start),
      };
    }

    // Find the earliest start date and latest end date across all tasks
    const dates: Date[] = [];
    for (const task of tasks) {
      dates.push(new Date(task.createdAt));
      if (task.dueDate) {
        dates.push(new Date(task.dueDate));
      }
    }
    dates.push(now);

    const earliest = startOfDay(min(dates));
    const latest = startOfDay(max(dates));

    // Add padding: 3 days before, 14 days after
    const start = addDays(earliest, -3);
    const end = addDays(latest, 14);

    const totalDays = differenceInDays(end, start) + 1;
    return {
      timelineStart: start,
      timelineEnd: end,
      days: Array.from({ length: totalDays }, (_, i) => addDays(start, i)),
      todayOffset: differenceInDays(now, start),
    };
  }, [tasks]);

  // ---- Group tasks by sprint ----
  const groupedTasks = useMemo(() => {
    const sprintMap = new Map<string, TimelineSprint>();
    for (const s of sprints) {
      sprintMap.set(s.id, s);
    }

    const groups: {
      id: string;
      name: string;
      isSprint: boolean;
      tasks: TimelineTask[];
    }[] = [];

    // Tasks grouped by sprint
    const sprintTasksMap = new Map<string, TimelineTask[]>();
    const unsprintedTasks: TimelineTask[] = [];

    for (const task of tasks) {
      if (task.sprintId && sprintMap.has(task.sprintId)) {
        const arr = sprintTasksMap.get(task.sprintId) || [];
        arr.push(task);
        sprintTasksMap.set(task.sprintId, arr);
      } else {
        unsprintedTasks.push(task);
      }
    }

    // Add sprint groups first
    for (const sprint of sprints) {
      const sprintTasks = sprintTasksMap.get(sprint.id);
      if (sprintTasks && sprintTasks.length > 0) {
        groups.push({
          id: sprint.id,
          name: sprint.name,
          isSprint: true,
          tasks: sprintTasks,
        });
      }
    }

    // Add unsprinted tasks
    if (unsprintedTasks.length > 0) {
      groups.push({
        id: "__no_sprint__",
        name: sprints.length > 0 ? "No Sprint" : "All Tasks",
        isSprint: false,
        tasks: unsprintedTasks,
      });
    }

    return groups;
  }, [tasks, sprints]);

  // ---- Build the row list (with group headers) ----
  const rows = useMemo(() => {
    const result: {
      type: "group-header" | "task";
      task?: TimelineTask;
      group?: { id: string; name: string; taskCount: number };
    }[] = [];

    for (const group of groupedTasks) {
      if (groupedTasks.length > 1 || group.isSprint) {
        result.push({
          type: "group-header",
          group: { id: group.id, name: group.name, taskCount: group.tasks.length },
        });
      }

      const isCollapsed = collapsedSprints.has(group.id);
      if (!isCollapsed) {
        for (const task of group.tasks) {
          result.push({ type: "task", task });
        }
      }
    }

    return result;
  }, [groupedTasks, collapsedSprints]);

  // ---- Scroll to today on mount ----
  useEffect(() => {
    if (scrollContainerRef.current && todayOffset > 0) {
      const scrollTo = todayOffset * DAY_WIDTH - scrollContainerRef.current.clientWidth / 3;
      scrollContainerRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  }, [todayOffset]);

  // ---- Toggle sprint collapse ----
  const toggleSprint = useCallback((sprintId: string) => {
    setCollapsedSprints((prev) => {
      const next = new Set(prev);
      if (next.has(sprintId)) {
        next.delete(sprintId);
      } else {
        next.add(sprintId);
      }
      return next;
    });
  }, []);

  // ---- Task bar positioning ----
  const getBarStyle = useCallback(
    (task: TimelineTask) => {
      const startDate = startOfDay(new Date(task.createdAt));
      const endDate = task.dueDate
        ? startOfDay(new Date(task.dueDate))
        : startDate; // single-day marker

      const startOffset = differenceInDays(startDate, timelineStart);
      const duration = Math.max(differenceInDays(endDate, startDate), 0) + 1; // at least 1 day

      return {
        left: startOffset * DAY_WIDTH + 2,
        width: duration * DAY_WIDTH - 4,
        isSingleDay: !task.dueDate,
      };
    },
    [timelineStart]
  );

  // ---- Navigate to task detail ----
  const handleTaskClick = useCallback(
    (taskId: string) => {
      // Navigate to backlog with task param to open detail dialog
      window.location.href = `/projects/${projectId}/backlog?task=${taskId}`;
    },
    [projectId]
  );

  const totalTimelineWidth = days.length * DAY_WIDTH;

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden rounded-lg border bg-white dark:bg-zinc-950">
        {/* ================================================================ */}
        {/*  LEFT: Task names column                                         */}
        {/* ================================================================ */}
        <div
          className="shrink-0 border-r bg-muted/20"
          style={{ width: TASK_COL_WIDTH }}
        >
          {/* Column header */}
          <div
            className="flex items-center border-b px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            style={{ height: HEADER_HEIGHT }}
          >
            <CalendarDays className="mr-2 size-3.5" />
            Task
          </div>

          {/* Task rows */}
          <div className="overflow-y-auto" style={{ maxHeight: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            {rows.map((row, idx) => {
              if (row.type === "group-header" && row.group) {
                const isCollapsed = collapsedSprints.has(row.group.id);
                return (
                  <div
                    key={`group-${row.group.id}`}
                    className="flex items-center gap-2 border-b bg-muted/40 px-3 cursor-pointer hover:bg-muted/60 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => toggleSprint(row.group!.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-foreground truncate">
                      {row.group.name}
                    </span>
                    <span className="ml-auto text-[10px] font-medium text-muted-foreground shrink-0">
                      {row.group.taskCount} task{row.group.taskCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              }

              if (row.type === "task" && row.task) {
                const task = row.task;
                const typeConf = TYPE_CONFIG[task.type];
                const TypeIcon = typeConf.icon;
                const initials = task.assignee ? getInitials(task.assignee.name) : null;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "group flex items-center gap-2 border-b px-3 cursor-pointer transition-colors",
                      "hover:bg-violet-50/50 dark:hover:bg-violet-500/5",
                      idx % 2 === 0
                        ? "bg-white dark:bg-zinc-950"
                        : "bg-muted/10"
                    )}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => handleTaskClick(task.id)}
                  >
                    <TypeIcon
                      className={cn("size-3.5 shrink-0", typeConf.className)}
                    />
                    <span className="text-xs font-medium text-foreground truncate flex-1 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                      {task.title}
                    </span>
                    {task.assignee && (
                      <Avatar size="sm" className="shrink-0">
                        {task.assignee.avatar && (
                          <AvatarImage
                            src={task.assignee.avatar}
                            alt={task.assignee.name}
                          />
                        )}
                        <AvatarFallback className="text-[9px] bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              }

              return null;
            })}

            {rows.length === 0 && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                No tasks to display
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/*  RIGHT: Scrollable timeline                                      */}
        {/* ================================================================ */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="h-full overflow-x-auto overflow-y-auto"
          >
            <div style={{ width: totalTimelineWidth, minHeight: "100%" }} className="relative">
              {/* ---- Time axis header ---- */}
              <div
                className="sticky top-0 z-20 border-b bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm"
                style={{ height: HEADER_HEIGHT }}
              >
                {/* Month row */}
                <div className="flex h-1/2">
                  {(() => {
                    const months: { label: string; startIdx: number; span: number }[] = [];
                    let currentMonth = "";
                    for (let i = 0; i < days.length; i++) {
                      const monthLabel = format(days[i], "MMM yyyy");
                      if (monthLabel !== currentMonth) {
                        months.push({ label: monthLabel, startIdx: i, span: 1 });
                        currentMonth = monthLabel;
                      } else {
                        months[months.length - 1].span++;
                      }
                    }
                    return months.map((m) => (
                      <div
                        key={`${m.label}-${m.startIdx}`}
                        className="flex items-center border-r border-b px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
                        style={{
                          width: m.span * DAY_WIDTH,
                          minWidth: m.span * DAY_WIDTH,
                        }}
                      >
                        {m.label}
                      </div>
                    ));
                  })()}
                </div>

                {/* Day numbers row */}
                <div className="flex h-1/2">
                  {days.map((day, i) => {
                    const weekend = isWeekend(day);
                    const today = isToday(day);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center justify-center border-r text-[10px] font-medium",
                          weekend
                            ? "text-muted-foreground/40 bg-muted/20"
                            : "text-muted-foreground/70",
                          today && "text-violet-700 font-bold dark:text-violet-300"
                        )}
                        style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                      >
                        <span className="leading-none">{format(day, "d")}</span>
                        <span className="ml-0.5 text-[8px] leading-none">
                          {format(day, "EEE").charAt(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ---- Grid background (weekend shading + column lines) ---- */}
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{ top: HEADER_HEIGHT }}
              >
                <div className="flex" style={{ height: rows.length * ROW_HEIGHT }}>
                  {days.map((day, i) => (
                    <div
                      key={i}
                      className={cn(
                        "border-r border-dashed border-border/30",
                        isWeekend(day) && "bg-muted/15 dark:bg-muted/8"
                      )}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    />
                  ))}
                </div>
              </div>

              {/* ---- Today marker ---- */}
              {todayOffset >= 0 && todayOffset < days.length && (
                <div
                  className="absolute z-30 pointer-events-none"
                  style={{
                    left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 - 1,
                    top: 0,
                    bottom: 0,
                  }}
                >
                  {/* "Today" label */}
                  <div className="absolute -top-0 -translate-x-1/2 bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b-md shadow-sm">
                    Today
                  </div>
                  {/* Vertical line */}
                  <div className="w-0.5 h-full bg-violet-500/60 dark:bg-violet-400/50" />
                </div>
              )}

              {/* ---- Task rows with bars ---- */}
              <div style={{ marginTop: HEADER_HEIGHT }}>
                {rows.map((row, idx) => {
                  if (row.type === "group-header" && row.group) {
                    return (
                      <div
                        key={`group-timeline-${row.group.id}`}
                        className="border-b bg-muted/40"
                        style={{ height: ROW_HEIGHT }}
                      />
                    );
                  }

                  if (row.type === "task" && row.task) {
                    const task = row.task;
                    const barStyle = getBarStyle(task);
                    const colors = PRIORITY_BAR_COLORS[task.priority];

                    return (
                      <div
                        key={`bar-${task.id}`}
                        className={cn(
                          "relative border-b",
                          idx % 2 === 0
                            ? "bg-white dark:bg-zinc-950"
                            : "bg-muted/10"
                        )}
                        style={{ height: ROW_HEIGHT }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleTaskClick(task.id)}
                              className={cn(
                                "absolute top-[8px] h-[28px] rounded-md border cursor-pointer",
                                "flex items-center px-2 transition-all",
                                "hover:shadow-md hover:scale-y-110 hover:brightness-95",
                                "focus:outline-none focus:ring-2 focus:ring-violet-400/50",
                                colors.bg,
                                colors.border,
                                barStyle.isSingleDay && "justify-center"
                              )}
                              style={{
                                left: barStyle.left,
                                width: Math.max(barStyle.width, 20),
                              }}
                            >
                              {!barStyle.isSingleDay && barStyle.width > 60 && (
                                <span
                                  className={cn(
                                    "text-[10px] font-medium truncate leading-none",
                                    colors.text
                                  )}
                                >
                                  {task.title}
                                </span>
                              )}
                              {barStyle.isSingleDay && (
                                <div
                                  className={cn(
                                    "size-2 rounded-full",
                                    task.priority === "CRITICAL"
                                      ? "bg-red-500"
                                      : task.priority === "HIGH"
                                        ? "bg-orange-500"
                                        : task.priority === "MEDIUM"
                                          ? "bg-blue-500"
                                          : "bg-gray-400"
                                  )}
                                />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium text-xs">{task.title}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>
                                  {format(new Date(task.createdAt), "MMM d")}
                                  {task.dueDate
                                    ? ` - ${format(new Date(task.dueDate), "MMM d, yyyy")}`
                                    : " (no due date)"}
                                </span>
                              </div>
                              {task.assignee && (
                                <p className="text-[10px] text-muted-foreground">
                                  {task.assignee.name}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
