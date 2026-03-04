"use client";

import React from "react";
import { format } from "date-fns";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
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
import { TaskDetailDialog } from "@/components/board/task-detail-dialog";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG, TYPE_CONFIG, STATUS_CONFIG } from "@/lib/task-constants";
import { useBacklogData } from "@/hooks/use-backlog-data";
import { BacklogFilters } from "@/components/backlog/backlog-filters";
import type { BoardTask, BoardColumn } from "@/components/board/task-card";
import type { SortField, SortDirection } from "@/hooks/use-backlog-data";

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
/*  SortableHeader (module-level component)                                   */
/* -------------------------------------------------------------------------- */

function SortableHeader({
  field,
  sortField,
  sortDirection,
  onSort,
  children,
  className,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
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
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function BacklogTable({
  initialTasks,
  projectId,
  members,
  columns,
  pagination: initialPagination,
}: BacklogTableProps) {
  const {
    sortedTasks,
    pagination,
    search,
    priorityFilter,
    typeFilter,
    assigneeFilter,
    sortField,
    sortDirection,
    loading,
    selectedTask,
    detailOpen,
    createOpen,
    hasActiveFilters,
    setDetailOpen,
    setCreateOpen,
    handleSort,
    handleSearch,
    handlePriorityFilter,
    handleTypeFilter,
    handleAssigneeFilter,
    handleClearFilters,
    handlePageChange,
    handleTaskClick,
    handleTaskSave,
    handleTaskDelete,
    handleCreateSubmit,
  } = useBacklogData({
    initialTasks,
    projectId,
    initialPagination,
  });

  // Get first column for create dialog
  const firstColumn = columns[0];

  return (
    <>
      {/* Filter bar */}
      <BacklogFilters
        search={search}
        priorityFilter={priorityFilter}
        typeFilter={typeFilter}
        assigneeFilter={assigneeFilter}
        hasActiveFilters={hasActiveFilters}
        members={members}
        onSearch={handleSearch}
        onPriorityFilter={handlePriorityFilter}
        onTypeFilter={handleTypeFilter}
        onAssigneeFilter={handleAssigneeFilter}
        onClearFilters={handleClearFilters}
        onCreateClick={() => setCreateOpen(true)}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Table                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-6 py-4">
        <div className="rounded-xl border bg-white shadow-sm dark:bg-zinc-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[380px] py-3.5 px-5">
                  <SortableHeader field="title" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Title
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[80px] py-3.5 px-4">
                  <SortableHeader field="type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Type
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[120px] py-3.5 px-4">
                  <SortableHeader field="priority" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Priority
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[180px] py-3.5 px-4">
                  <SortableHeader field="assignee" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Assignee
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[80px] py-3.5 px-4 text-center">
                  <SortableHeader field="storyPoints" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center">
                    SP
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[120px] py-3.5 px-4">
                  <SortableHeader field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Status
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[130px] py-3.5 px-4">
                  <SortableHeader field="dueDate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Due Date
                  </SortableHeader>
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
