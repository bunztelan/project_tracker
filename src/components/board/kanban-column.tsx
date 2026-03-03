"use client";

import { useState, useCallback } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TaskCard, type BoardTask } from "./task-card";

/* -------------------------------------------------------------------------- */
/*  Column color palette (cycles through 4 vibrant colors)                    */
/* -------------------------------------------------------------------------- */

const COLUMN_COLORS = [
  {
    bar: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    dropHighlight: "border-blue-400/60",
  },
  {
    bar: "bg-amber-500",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    dropHighlight: "border-amber-400/60",
  },
  {
    bar: "bg-purple-500",
    badge:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
    dropHighlight: "border-purple-400/60",
  },
  {
    bar: "bg-emerald-500",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    dropHighlight: "border-emerald-400/60",
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
}

export function KanbanColumn({
  columnId,
  columnName,
  columnIndex,
  tasks,
  onTaskClick,
  onQuickAdd,
}: KanbanColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

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
    <div className="flex w-[320px] shrink-0 flex-col">
      {/* Color bar */}
      <div className={cn("h-1.5 rounded-t-xl", colors.bar)} />

      {/* Column header */}
      <div className="flex items-center justify-between rounded-b-none border-x border-t border-border/50 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-foreground">
            {columnName}
          </h3>
          <span
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
              colors.badge
            )}
          >
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsAdding(!isAdding)}
          className="opacity-60 hover:opacity-100"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Droppable task area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-3 rounded-b-xl border border-t-0 border-border/50 bg-muted/20 p-3 transition-all",
          isOver && [
            "border-dashed border-2",
            colors.dropHighlight,
            "bg-muted/40",
          ]
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
