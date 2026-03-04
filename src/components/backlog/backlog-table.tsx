"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ListFilter,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskDetailDialog } from "@/components/board/task-detail-dialog";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG, TYPE_CONFIG, STATUS_CONFIG } from "@/lib/task-constants";
import type { BoardTask, BoardColumn } from "@/components/board/task-card";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type BacklogMember = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

interface BacklogTableProps {
  initialTasks: BoardTask[];
  projectId: string;
  members: BacklogMember[];
  columns: BoardColumn[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type SortField =
  | "title"
  | "type"
  | "priority"
  | "assignee"
  | "storyPoints"
  | "status"
  | "dueDate";

type SortDirection = "asc" | "desc";

/* -------------------------------------------------------------------------- */
/*  Helper: initials from name                                                */
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

export function BacklogTable({
  initialTasks,
  projectId,
  members,
  columns,
  pagination: initialPagination,
}: BacklogTableProps) {
  const router = useRouter();

  // -- State --
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(false);

  // -- Detail dialog --
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // -- Create dialog --
  const [createOpen, setCreateOpen] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*  Fetch tasks from API                                                      */
  /* -------------------------------------------------------------------------- */

  const fetchTasks = useCallback(
    async (
      page: number,
      searchTerm?: string,
      priority?: string,
      type?: string,
      assignee?: string
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");

        if (searchTerm) params.set("search", searchTerm);
        if (priority && priority !== "all") params.set("priority", priority);
        if (type && type !== "all") params.set("type", type);
        if (assignee && assignee !== "all") params.set("assignee", assignee);

        const res = await fetch(
          `/api/projects/${projectId}/tasks?${params.toString()}`
        );

        if (!res.ok) throw new Error("Failed to fetch tasks");

        const json = await res.json();
        if (json.data) {
          // Shape into BoardTask format
          const shaped: BoardTask[] = json.data.tasks.map(
            (t: Record<string, unknown>) => ({
              id: t.id as string,
              title: t.title as string,
              description: t.description as string | null,
              status: t.status as string,
              priority: t.priority as BoardTask["priority"],
              type: t.type as BoardTask["type"],
              storyPoints: t.storyPoints as number | null,
              position: t.position as number,
              dueDate: t.dueDate as string | null,
              createdAt: t.createdAt as string,
              updatedAt: t.updatedAt as string,
              assignee: t.assignee as BoardTask["assignee"],
              reporter: t.reporter as BoardTask["reporter"],
              subtaskCount: t.subtaskCount as number,
              parentId: t.parentId as string | null,
              sprintId: t.sprintId as string | null,
            })
          );
          setTasks(shaped);
          setPagination(
            json.data.pagination as {
              page: number;
              limit: number;
              total: number;
              totalPages: number;
            }
          );
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  /* -------------------------------------------------------------------------- */
  /*  Sorting (client-side on current page)                                     */
  /* -------------------------------------------------------------------------- */

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "priority":
          comparison =
            PRIORITY_CONFIG[a.priority].order -
            PRIORITY_CONFIG[b.priority].order;
          break;
        case "assignee":
          comparison = (a.assignee?.name || "").localeCompare(
            b.assignee?.name || ""
          );
          break;
        case "storyPoints":
          comparison = (a.storyPoints || 0) - (b.storyPoints || 0);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "dueDate":
          comparison =
            new Date(a.dueDate || "9999-12-31").getTime() -
            new Date(b.dueDate || "9999-12-31").getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [tasks, sortField, sortDirection]);

  /* -------------------------------------------------------------------------- */
  /*  Handlers                                                                  */
  /* -------------------------------------------------------------------------- */

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      fetchTasks(1, value, priorityFilter, typeFilter, assigneeFilter);
    },
    [fetchTasks, priorityFilter, typeFilter, assigneeFilter]
  );

  const handlePriorityFilter = useCallback(
    (value: string) => {
      setPriorityFilter(value);
      fetchTasks(1, search, value, typeFilter, assigneeFilter);
    },
    [fetchTasks, search, typeFilter, assigneeFilter]
  );

  const handleTypeFilter = useCallback(
    (value: string) => {
      setTypeFilter(value);
      fetchTasks(1, search, priorityFilter, value, assigneeFilter);
    },
    [fetchTasks, search, priorityFilter, assigneeFilter]
  );

  const handleAssigneeFilter = useCallback(
    (value: string) => {
      setAssigneeFilter(value);
      fetchTasks(1, search, priorityFilter, typeFilter, value);
    },
    [fetchTasks, search, priorityFilter, typeFilter]
  );

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setPriorityFilter("all");
    setTypeFilter("all");
    setAssigneeFilter("all");
    fetchTasks(1, "", "all", "all", "all");
  }, [fetchTasks]);

  const handlePageChange = useCallback(
    (page: number) => {
      fetchTasks(page, search, priorityFilter, typeFilter, assigneeFilter);
    },
    [fetchTasks, search, priorityFilter, typeFilter, assigneeFilter]
  );

  const handleTaskClick = useCallback((task: BoardTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  const handleTaskSave = useCallback(
    async (taskId: string, data: Record<string, unknown>) => {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) throw new Error("Failed to update task");

      // Refresh the current page
      await fetchTasks(
        pagination.page,
        search,
        priorityFilter,
        typeFilter,
        assigneeFilter
      );
    },
    [
      projectId,
      fetchTasks,
      pagination.page,
      search,
      priorityFilter,
      typeFilter,
      assigneeFilter,
    ]
  );

  const handleTaskDelete = useCallback(
    async (taskId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Failed to delete task");

      // Refresh the current page
      await fetchTasks(
        pagination.page,
        search,
        priorityFilter,
        typeFilter,
        assigneeFilter
      );
    },
    [
      projectId,
      fetchTasks,
      pagination.page,
      search,
      priorityFilter,
      typeFilter,
      assigneeFilter,
    ]
  );

  const handleCreateSubmit = useCallback(
    async (data: {
      title: string;
      columnId: string;
      priority?: string;
      type?: string;
      assigneeId?: string;
    }) => {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create task");

      // Refresh current page
      await fetchTasks(
        pagination.page,
        search,
        priorityFilter,
        typeFilter,
        assigneeFilter
      );
    },
    [
      projectId,
      fetchTasks,
      pagination.page,
      search,
      priorityFilter,
      typeFilter,
      assigneeFilter,
    ]
  );

  const hasActiveFilters =
    search !== "" ||
    priorityFilter !== "all" ||
    typeFilter !== "all" ||
    assigneeFilter !== "all";

  /* -------------------------------------------------------------------------- */
  /*  Sort header component                                                     */
  /* -------------------------------------------------------------------------- */

  function SortableHeader({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors",
          isActive && "text-foreground",
          className
        )}
      >
        {children}
        {isActive ? (
          sortDirection === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    );
  }

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                    */
  /* -------------------------------------------------------------------------- */

  // Get first column for create dialog
  const firstColumn = columns[0];

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Filter bar                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b bg-background/50">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Filter icon label */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ListFilter className="size-4" />
          <span className="text-xs font-medium">Filters</span>
        </div>

        {/* Priority filter */}
        <Select value={priorityFilter} onValueChange={handlePriorityFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={handleTypeFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="STORY">Story</SelectItem>
            <SelectItem value="BUG">Bug</SelectItem>
            <SelectItem value="TASK">Task</SelectItem>
            <SelectItem value="EPIC">Epic</SelectItem>
          </SelectContent>
        </Select>

        {/* Assignee filter */}
        <Select value={assigneeFilter} onValueChange={handleAssigneeFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}

        {/* Create task button */}
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Create Task
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Table                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-6 py-4">
        <div className="rounded-xl border bg-white shadow-sm dark:bg-zinc-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[380px] py-3.5 px-5">
                  <SortableHeader field="title">Title</SortableHeader>
                </TableHead>
                <TableHead className="w-[80px] py-3.5 px-4">
                  <SortableHeader field="type">Type</SortableHeader>
                </TableHead>
                <TableHead className="w-[120px] py-3.5 px-4">
                  <SortableHeader field="priority">Priority</SortableHeader>
                </TableHead>
                <TableHead className="w-[180px] py-3.5 px-4">
                  <SortableHeader field="assignee">Assignee</SortableHeader>
                </TableHead>
                <TableHead className="w-[80px] py-3.5 px-4 text-center">
                  <SortableHeader field="storyPoints" className="justify-center">
                    SP
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[120px] py-3.5 px-4">
                  <SortableHeader field="status">Status</SortableHeader>
                </TableHead>
                <TableHead className="w-[130px] py-3.5 px-4">
                  <SortableHeader field="dueDate">Due Date</SortableHeader>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={`skeleton-cell-${j}`} className="py-4 px-5">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium">No tasks found</p>
                      <p className="text-xs">
                        {hasActiveFilters
                          ? "Try adjusting your filters"
                          : "Create your first task to get started"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTasks.map((task, index) => {
                  const typeConfig = TYPE_CONFIG[task.type];
                  const TypeIcon = typeConfig.icon;
                  const priorityConfig = PRIORITY_CONFIG[task.priority];
                  const statusConfig =
                    STATUS_CONFIG[task.status] || STATUS_CONFIG["todo"];
                  const initials = task.assignee
                    ? getInitials(task.assignee.name)
                    : null;

                  return (
                    <TableRow
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        index % 2 === 1 &&
                          "bg-muted/20 dark:bg-muted/10",
                        "hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
                      )}
                    >
                      {/* Title */}
                      <TableCell className="py-4 px-5">
                        <span className="font-medium text-sm text-foreground line-clamp-1">
                          {task.title}
                        </span>
                      </TableCell>

                      {/* Type icon */}
                      <TableCell className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <TypeIcon
                            className={cn(
                              "size-4 shrink-0",
                              typeConfig.className
                            )}
                          />
                          <span className="text-xs text-muted-foreground hidden xl:inline">
                            {typeConfig.label}
                          </span>
                        </div>
                      </TableCell>

                      {/* Priority pill */}
                      <TableCell className="py-4 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            priorityConfig.badgeClassName
                          )}
                        >
                          {priorityConfig.label}
                        </span>
                      </TableCell>

                      {/* Assignee */}
                      <TableCell className="py-4 px-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              {task.assignee.avatar && (
                                <AvatarImage
                                  src={task.assignee.avatar}
                                  alt={task.assignee.name}
                                />
                              )}
                              <AvatarFallback className="text-[11px] bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-foreground truncate max-w-[120px]">
                              {task.assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>

                      {/* Story Points */}
                      <TableCell className="py-4 px-4 text-center">
                        {task.storyPoints != null && task.storyPoints > 0 ? (
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                            {task.storyPoints}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            --
                          </span>
                        )}
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className="py-4 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            statusConfig.className
                          )}
                        >
                          {statusConfig.label}
                        </span>
                      </TableCell>

                      {/* Due date */}
                      <TableCell className="py-4 px-4">
                        {task.dueDate ? (
                          <span
                            className={cn(
                              "text-sm",
                              new Date(task.dueDate) < new Date()
                                ? "text-red-600 font-medium dark:text-red-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {format(new Date(task.dueDate), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No date
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Pagination                                                       */}
        {/* ---------------------------------------------------------------- */}
        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {pagination.total}
              </span>{" "}
              tasks
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>

              {/* Page numbers */}
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  // Show first, last, current, and neighbors
                  if (p === 1 || p === pagination.totalPages) return true;
                  if (Math.abs(p - pagination.page) <= 1) return true;
                  return false;
                })
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0) {
                    const prev = arr[i - 1];
                    if (p - prev > 1) acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  typeof item === "string" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-xs text-muted-foreground"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant={
                        pagination.page === item ? "default" : "outline"
                      }
                      size="icon-sm"
                      onClick={() => handlePageChange(item)}
                      className="text-xs"
                    >
                      {item}
                    </Button>
                  )
                )}

              <Button
                variant="outline"
                size="icon-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dialogs                                                             */}
      {/* ------------------------------------------------------------------ */}

      {/* Task detail slide-in */}
      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        projectId={projectId}
        columns={columns}
        members={members}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
      />

      {/* Create task dialog */}
      {firstColumn && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          columnId={firstColumn.id}
          columnName={firstColumn.name}
          members={members}
          onSubmit={handleCreateSubmit}
        />
      )}
    </>
  );
}
