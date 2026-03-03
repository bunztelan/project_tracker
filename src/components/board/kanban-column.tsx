"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TaskCard, type BoardTask } from "./task-card";

/* -------------------------------------------------------------------------- */
/*  Column color palette (pastel backgrounds with colored dot headers)         */
/* -------------------------------------------------------------------------- */

const COLUMN_COLORS = [
  {
    dot: "bg-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    headerBg: "bg-amber-100/60 dark:bg-amber-900/30",
    dropHighlight: "ring-2 ring-amber-300/60",
  },
  {
    dot: "bg-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    headerBg: "bg-orange-100/60 dark:bg-orange-900/30",
    dropHighlight: "ring-2 ring-orange-300/60",
  },
  {
    dot: "bg-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    headerBg: "bg-emerald-100/60 dark:bg-emerald-900/30",
    dropHighlight: "ring-2 ring-emerald-300/60",
  },
  {
    dot: "bg-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
    headerBg: "bg-green-100/60 dark:bg-green-900/30",
    dropHighlight: "ring-2 ring-green-300/60",
  },
  {
    dot: "bg-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/20",
    headerBg: "bg-rose-100/60 dark:bg-rose-900/30",
    dropHighlight: "ring-2 ring-rose-300/60",
  },
  {
    dot: "bg-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
    headerBg: "bg-cyan-100/60 dark:bg-cyan-900/30",
    dropHighlight: "ring-2 ring-cyan-300/60",
  },
];

/* -------------------------------------------------------------------------- */
/*  KanbanColumn component                                                    */
/* -------------------------------------------------------------------------- */

interface KanbanColumnProps {
  columnId: string;
  columnName: string;
  columnIndex: number;
  tasks: BoardTask[];
  onTaskClick: (task: BoardTask) => void;
  onQuickAdd: (columnId: string, title: string) => void;
  onRename?: (columnId: string, newName: string) => void;
  onDelete?: (columnId: string) => void;
  canDelete?: boolean;
}

export function KanbanColumn({
  columnId,
  columnName,
  columnIndex,
  tasks,
  onTaskClick,
  onQuickAdd,
  onRename,
  onDelete,
  canDelete = false,
}: KanbanColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(columnName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== columnName && onRename) {
      onRename(columnId, trimmed);
    } else {
      setRenameValue(columnName);
    }
    setIsRenaming(false);
  }, [renameValue, columnName, columnId, onRename]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleRenameSubmit();
      }
      if (e.key === "Escape") {
        setRenameValue(columnName);
        setIsRenaming(false);
      }
    },
    [handleRenameSubmit, columnName]
  );

  const colors = COLUMN_COLORS[columnIndex % COLUMN_COLORS.length];

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${columnId}`,
    data: {
      type: "column",
      columnId,
    },
  });

  const handleQuickAdd = useCallback(() => {
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    onQuickAdd(columnId, trimmed);
    setQuickTitle("");
    setIsAdding(false);
  }, [quickTitle, columnId, onQuickAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleQuickAdd();
      }
      if (e.key === "Escape") {
        setIsAdding(false);
        setQuickTitle("");
      }
    },
    [handleQuickAdd]
  );

  const taskIds = tasks.map((t) => t.id);

  return (
    <div className={cn("flex w-[320px] shrink-0 flex-col rounded-xl", colors.bg)}>
      {/* Column header */}
      <div className={cn(
        "flex items-center justify-between rounded-t-xl px-4 py-3",
        colors.headerBg
      )}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Colored dot */}
          <div className={cn("size-2 shrink-0 rounded-full", colors.dot)} />

          {isRenaming ? (
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              maxLength={30}
              className="h-6 text-sm font-semibold px-1.5 py-0"
            />
          ) : (
            <h3
              className="truncate text-sm font-semibold text-foreground"
              title={columnName}
            >
              {columnName}
            </h3>
          )}
        </div>

        {/* "..." dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-60 hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(columnName);
                setIsRenaming(true);
              }}
            >
              <Pencil className="mr-2 size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsAdding(true)}>
              <Plus className="mr-2 size-3.5" />
              Add task
            </DropdownMenuItem>
            {canDelete && onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(columnId)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-3.5" />
                Delete column
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Droppable task area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-3 rounded-b-xl p-3 transition-all",
          isOver && colors.dropHighlight
        )}
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>

        {/* Quick-add inline input */}
        {isAdding && (
          <div className="mt-auto space-y-2">
            <Input
              autoFocus
              placeholder="What needs to be done?"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleQuickAdd} className="flex-1">
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setQuickTitle("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {tasks.length === 0 && !isAdding && (
          <div className="flex flex-1 items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/60">
              No tasks yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
