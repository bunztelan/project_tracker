"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface SubtaskAssignee {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  position: number;
  assignee: SubtaskAssignee | null;
  assigneeId: string | null;
}

interface SubtaskChecklistProps {
  projectId: string;
  taskId: string;
  members: { id: string; name: string; email: string; avatar: string | null }[];
}

/* -------------------------------------------------------------------------- */
/*  Sortable subtask row                                                      */
/* -------------------------------------------------------------------------- */

function SortableSubtaskRow({
  subtask,
  onToggle,
  onUpdateTitle,
  onUpdateAssignee,
  onDelete,
  members,
}: {
  subtask: Subtask;
  onToggle: (id: string, completed: boolean) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  onDelete: (id: string) => void;
  members: SubtaskChecklistProps["members"];
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== subtask.title) {
      onUpdateTitle(subtask.id, trimmed);
    } else {
      setEditTitle(subtask.title);
    }
    setEditing(false);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const initials = subtask.assignee
    ? subtask.assignee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
        "hover:bg-muted/50",
        isDragging && "opacity-50 shadow-lg bg-background ring-1 ring-ring/10"
      )}
    >
      {/* Drag handle */}
      <div
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5 text-muted-foreground" />
      </div>

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(subtask.id, !subtask.completed)}
        className={cn(
          "size-4 shrink-0 rounded border-2 transition-all duration-200 flex items-center justify-center",
          subtask.completed
            ? "bg-teal-500 border-teal-500 scale-100"
            : "border-muted-foreground/40 hover:border-teal-400"
        )}
      >
        {subtask.completed && <Check className="size-3 text-white" strokeWidth={3} />}
      </button>

      {/* Title */}
      {editing ? (
        <input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveTitle();
            if (e.key === "Escape") {
              setEditTitle(subtask.title);
              setEditing(false);
            }
          }}
          className="flex-1 min-w-0 text-sm bg-transparent border-0 outline-none ring-0 px-0 py-0"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={cn(
            "flex-1 min-w-0 text-sm cursor-text truncate",
            subtask.completed && "line-through text-muted-foreground"
          )}
        >
          {subtask.title}
        </span>
      )}

      {/* Assignee */}
      <Select
        value={subtask.assigneeId || "none"}
        onValueChange={(val) => onUpdateAssignee(subtask.id, val === "none" ? null : val)}
      >
        <SelectTrigger className="h-6 w-6 p-0 border-0 shadow-none bg-transparent [&>svg]:hidden shrink-0">
          <SelectValue>
            {subtask.assignee ? (
              <Avatar className="size-5">
                {subtask.assignee.avatar && (
                  <AvatarImage src={subtask.assignee.avatar} alt={subtask.assignee.name} />
                )}
                <AvatarFallback className="text-[9px] bg-gradient-to-br from-brand-600 to-brand-500 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="size-5 rounded-full border border-dashed border-muted-foreground/30 opacity-0 group-hover:opacity-60" />
            )}
          </SelectValue>
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

      {/* Delete button */}
      <button
        type="button"
        onClick={() => onDelete(subtask.id)}
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0"
      >
        <X className="size-3.5 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main checklist component                                                  */
/* -------------------------------------------------------------------------- */

export function SubtaskChecklist({ projectId, taskId, members }: SubtaskChecklistProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /* --- Fetch subtasks --- */
  const fetchSubtasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks`);
      const json = await res.json();
      if (json.data) setSubtasks(json.data);
    } catch {
      console.error("Failed to fetch subtasks");
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  /* --- Create --- */
  const handleAdd = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const json = await res.json();
      if (json.data) {
        setSubtasks((prev) => [...prev, json.data]);
        setNewTitle("");
      }
    } catch {
      toast.error("Failed to add subtask");
    } finally {
      setAdding(false);
    }
  }, [projectId, taskId, newTitle]);

  /* --- Toggle completed --- */
  const handleToggle = useCallback(async (subtaskId: string, completed: boolean) => {
    // Optimistic update
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, completed } : s))
    );
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
    } catch {
      // Revert on error
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtaskId ? { ...s, completed: !completed } : s))
      );
      toast.error("Failed to update subtask");
    }
  }, [projectId, taskId]);

  /* --- Update title --- */
  const handleUpdateTitle = useCallback(async (subtaskId: string, title: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, title } : s))
    );
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      toast.error("Failed to update subtask");
    }
  }, [projectId, taskId]);

  /* --- Update assignee --- */
  const handleUpdateAssignee = useCallback(async (subtaskId: string, assigneeId: string | null) => {
    const assignee = assigneeId ? members.find((m) => m.id === assigneeId) ?? null : null;
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, assigneeId, assignee } : s))
    );
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
    } catch {
      toast.error("Failed to update subtask");
    }
  }, [projectId, taskId, members]);

  /* --- Delete --- */
  const handleDelete = useCallback(async (subtaskId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
      });
    } catch {
      toast.error("Failed to delete subtask");
      fetchSubtasks(); // Refetch on error
    }
  }, [projectId, taskId, fetchSubtasks]);

  /* --- Drag reorder --- */
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(subtasks, oldIndex, newIndex);

    // Optimistic update
    setSubtasks(reordered);

    // Update the moved item's position on server
    try {
      await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/subtasks/${active.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: newIndex }),
        }
      );
    } catch {
      toast.error("Failed to reorder subtasks");
      fetchSubtasks();
    }
  }, [subtasks, projectId, taskId, fetchSubtasks]);

  /* --- Render --- */
  const completedCount = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
        <div className="h-8 w-full bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Subtasks
        </span>
        {total > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{total}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-muted/60 max-w-[120px]">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Subtask list */}
      {total > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subtasks.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {subtasks.map((subtask) => (
                <SortableSubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={handleToggle}
                  onUpdateTitle={handleUpdateTitle}
                  onUpdateAssignee={handleUpdateAssignee}
                  onDelete={handleDelete}
                  members={members}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add subtask input */}
      <div className="flex items-center gap-2">
        <Plus className="size-3.5 text-muted-foreground shrink-0" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !adding) handleAdd();
          }}
          placeholder="Add a subtask..."
          disabled={adding}
          className="flex-1 text-sm bg-transparent border-0 outline-none ring-0 placeholder:text-muted-foreground/60 py-1"
        />
      </div>
    </div>
  );
}
