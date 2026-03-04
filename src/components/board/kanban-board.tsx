"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { MAX_COLUMNS, MIN_COLUMNS } from "@/lib/task-constants";
import { KanbanColumn } from "./kanban-column";
import { TaskCardOverlay, type BoardData, type BoardColumn, type BoardTask } from "./task-card";
import { TaskDetailDialog } from "./task-detail-dialog";
import { CreateTaskDialog } from "./create-task-dialog";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface KanbanBoardProps {
  initialData: BoardData;
  projectId: string;
  members: { id: string; name: string; email: string; avatar: string | null }[];
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function KanbanBoard({
  initialData,
  projectId,
  members,
}: KanbanBoardProps) {
  // -- Board state (optimistic) --
  const [columns, setColumns] = useState<BoardColumn[]>(initialData.columns);

  // -- Drag state --
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);

  // -- Task detail dialog --
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // -- Create dialog --
  const [createColumnId, setCreateColumnId] = useState<string>("");
  const [createColumnName, setCreateColumnName] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);

  // -- Sensors: PointerSensor with 8px activation distance --
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // -- Flat task lookup for drag operations --
  const taskMap = useMemo(() => {
    const map = new Map<string, { task: BoardTask; columnId: string }>();
    for (const col of columns) {
      for (const task of col.tasks) {
        map.set(task.id, { task, columnId: col.id });
      }
    }
    return map;
  }, [columns]);

  /* -------------------------------------------------------------------------- */
  /*  Drag handlers                                                             */
  /* -------------------------------------------------------------------------- */

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const entry = taskMap.get(active.id as string);
      if (entry) {
        setActiveTask(entry.task);
      }
    },
    [taskMap]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find source column
      const activeEntry = taskMap.get(activeId);
      if (!activeEntry) return;

      // Determine destination column
      let destColumnId: string;
      if (overId.startsWith("column-")) {
        destColumnId = overId.replace("column-", "");
      } else {
        const overEntry = taskMap.get(overId);
        if (!overEntry) return;
        destColumnId = overEntry.columnId;
      }

      const sourceColumnId = activeEntry.columnId;

      // Only process cross-column moves here
      if (sourceColumnId === destColumnId) return;

      setColumns((prev) => {
        const sourceCol = prev.find((c) => c.id === sourceColumnId);
        const destCol = prev.find((c) => c.id === destColumnId);
        if (!sourceCol || !destCol) return prev;

        const sourceIdx = sourceCol.tasks.findIndex((t) => t.id === activeId);
        if (sourceIdx === -1) return prev;

        const task = sourceCol.tasks[sourceIdx];

        // Find insertion index in destination
        let destIdx = destCol.tasks.length;
        if (!overId.startsWith("column-")) {
          const overIdx = destCol.tasks.findIndex((t) => t.id === overId);
          if (overIdx !== -1) {
            destIdx = overIdx;
          }
        }

        const newSource = {
          ...sourceCol,
          tasks: sourceCol.tasks.filter((t) => t.id !== activeId),
        };
        const newDestTasks = [...destCol.tasks];
        newDestTasks.splice(destIdx, 0, task);
        const newDest = { ...destCol, tasks: newDestTasks };

        return prev.map((col) => {
          if (col.id === sourceColumnId) return newSource;
          if (col.id === destColumnId) return newDest;
          return col;
        });
      });
    },
    [taskMap]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find which column the task is now in (after handleDragOver)
      let currentColumnId: string | null = null;
      let currentIndex = -1;

      for (const col of columns) {
        const idx = col.tasks.findIndex((t) => t.id === activeId);
        if (idx !== -1) {
          currentColumnId = col.id;
          currentIndex = idx;
          break;
        }
      }

      if (!currentColumnId) return;

      // Handle same-column reorder
      if (!overId.startsWith("column-")) {
        const col = columns.find((c) => c.id === currentColumnId);
        if (col) {
          const overIdx = col.tasks.findIndex((t) => t.id === overId);
          if (overIdx !== -1 && overIdx !== currentIndex) {
            setColumns((prev) =>
              prev.map((c) => {
                if (c.id !== currentColumnId) return c;
                return {
                  ...c,
                  tasks: arrayMove(c.tasks, currentIndex, overIdx),
                };
              })
            );
            // Update the index for the API call
            currentIndex = overIdx;
          }
        }
      }

      // Persist via reorder API
      try {
        await fetch(`/api/projects/${projectId}/tasks/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: activeId,
            columnId: currentColumnId,
            position: currentIndex,
          }),
        });
      } catch (error) {
        console.error("Failed to persist reorder:", error);
        // On failure, refetch from server
        refreshBoard();
      }
    },
    [columns, projectId]
  );

  /* -------------------------------------------------------------------------- */
  /*  Task operations                                                           */
  /* -------------------------------------------------------------------------- */

  const refreshBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/board`);
      const json = await res.json();
      if (json.data) {
        setColumns(json.data.columns);
      }
    } catch (error) {
      console.error("Failed to refresh board:", error);
    }
  }, [projectId]);

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

      if (!res.ok) {
        throw new Error("Failed to update task");
      }

      // Refresh board to get latest state
      await refreshBoard();
    },
    [projectId, refreshBoard]
  );

  const handleTaskDelete = useCallback(
    async (taskId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error("Failed to delete task");
      }

      // Optimistically remove from columns
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          tasks: col.tasks.filter((t) => t.id !== taskId),
        }))
      );
    },
    [projectId]
  );

  const handleQuickAdd = useCallback(
    async (columnId: string, title: string) => {
      // Optimistically add a placeholder task
      const tempId = `temp-${Date.now()}`;
      const tempTask: BoardTask = {
        id: tempId,
        title,
        description: null,
        status: "todo",
        priority: "MEDIUM",
        type: "TASK",
        storyPoints: null,
        position: 0,
        dueDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignee: null,
        reporter: null,
        subtaskCount: 0,
        commentCount: 0,
        attachmentCount: 0,
        subtaskProgress: 0,
        completedSubtasks: 0,
        totalSubtasks: 0,
        parentId: null,
        sprintId: null,
      };

      setColumns((prev) =>
        prev.map((col) => {
          if (col.id !== columnId) return col;
          return { ...col, tasks: [...col.tasks, tempTask] };
        })
      );

      try {
        const res = await fetch(`/api/projects/${projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, columnId }),
        });

        if (!res.ok) throw new Error("Failed to create task");

        // Refresh to get the real task
        await refreshBoard();
      } catch (error) {
        console.error("Failed to quick-add task:", error);
        // Remove the temp task on failure
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            tasks: col.tasks.filter((t) => t.id !== tempId),
          }))
        );
      }
    },
    [projectId, refreshBoard]
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
      await refreshBoard();
    },
    [projectId, refreshBoard]
  );

  /* -------------------------------------------------------------------------- */
  /*  Column management                                                        */
  /* -------------------------------------------------------------------------- */

  const handleRenameColumn = useCallback(
    async (columnId: string, newName: string) => {
      // Optimistic update
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, name: newName } : col
        )
      );

      try {
        const res = await fetch(
          `/api/projects/${projectId}/board/columns`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "rename", columnId, name: newName }),
          }
        );

        if (!res.ok) {
          const json = await res.json();
          toast.error(json.message || "Failed to rename column");
          await refreshBoard();
        }
      } catch (error) {
        console.error("Failed to rename column:", error);
        toast.error("Failed to rename column");
        await refreshBoard();
      }
    },
    [projectId, refreshBoard]
  );

  const handleDeleteColumn = useCallback(
    async (columnId: string) => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/board/columns`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", columnId }),
          }
        );

        const json = await res.json();

        if (!res.ok) {
          toast.error(json.message || "Failed to delete column");
          return;
        }

        // Remove from state on success
        setColumns((prev) => prev.filter((col) => col.id !== columnId));
      } catch (error) {
        console.error("Failed to delete column:", error);
        toast.error("Failed to delete column");
      }
    },
    [projectId]
  );

  const handleAddColumn = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/board/columns`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", name: "New Column" }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.message || "Failed to add column");
        return;
      }

      // Refresh board to get new column with server-generated ID
      await refreshBoard();
    } catch (error) {
      console.error("Failed to add column:", error);
      toast.error("Failed to add column");
    }
  }, [projectId, refreshBoard]);

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 overflow-x-auto p-6 pb-8">
          {columns.map((col, index) => (
            <KanbanColumn
              key={col.id}
              columnId={col.id}
              columnName={col.name}
              columnIndex={index}
              tasks={col.tasks}
              onTaskClick={handleTaskClick}
              onQuickAdd={handleQuickAdd}
              onRename={handleRenameColumn}
              onDelete={handleDeleteColumn}
              canDelete={columns.length > MIN_COLUMNS && col.tasks.length === 0}
            />
          ))}

          {/* Add column button */}
          {columns.length < MAX_COLUMNS && columns.length > 0 && (
            <button
              onClick={handleAddColumn}
              className="flex w-[320px] shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-muted/10 transition-colors hover:border-primary/40 hover:bg-muted/30 min-h-[200px]"
            >
              <Plus className="size-6 text-muted-foreground/60" />
              <span className="mt-2 text-sm text-muted-foreground/60">
                Add column
              </span>
            </button>
          )}

          {columns.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-20">
              <p className="text-muted-foreground">
                No board columns found. Set up your board to get started.
              </p>
            </div>
          )}
        </div>

        {/* Drag overlay — rendered at top level for smooth animation */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

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
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        columnId={createColumnId}
        columnName={createColumnName}
        members={members}
        onSubmit={handleCreateSubmit}
      />
    </>
  );
}
