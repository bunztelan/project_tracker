"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Paperclip,
  MessageSquare,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/lib/task-constants";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type TaskAssignee = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "STORY" | "BUG" | "TASK" | "EPIC";
  storyPoints: number | null;
  position: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: TaskAssignee | null;
  reporter: TaskAssignee | null;
  subtaskCount: number;
  commentCount: number;
  attachmentCount: number;
  subtaskProgress: number;
  completedSubtasks: number;
  totalSubtasks: number;
  parentId: string | null;
  sprintId: string | null;
};

export type BoardColumn = {
  id: string;
  name: string;
  position: number;
  tasks: BoardTask[];
};

export type BoardData = {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  columns: BoardColumn[];
};

/* -------------------------------------------------------------------------- */
/*  TaskCard component                                                        */
/* -------------------------------------------------------------------------- */

interface TaskCardProps {
  task: BoardTask;
  onClick: () => void;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, onClick, isDragOverlay }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = PRIORITY_CONFIG[task.priority];

  const initials = task.assignee
    ? task.assignee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      className={cn(
        "group relative rounded-xl border bg-white p-4 shadow-sm transition-all dark:bg-zinc-900",
        isDragging && !isDragOverlay && "opacity-30",
        isDragOverlay &&
          "rotate-[2deg] scale-105 shadow-xl ring-2 ring-brand-400/50",
        !isDragging &&
          !isDragOverlay &&
          "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
      )}
      onClick={isDragOverlay ? undefined : onClick}
    >
      {/* Drag handle */}
      <div
        className={cn(
          "absolute top-3 right-2 opacity-0 transition-opacity cursor-grab active:cursor-grabbing",
          "group-hover:opacity-60 hover:!opacity-100",
          isDragOverlay && "opacity-100"
        )}
        {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </div>

      {/* Priority badge */}
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
          priority.className
        )}
      >
        {priority.label}
      </span>

      {/* Title */}
      <h4 className="mt-2 text-sm font-semibold leading-snug text-foreground line-clamp-2">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          Note: {task.description}
        </p>
      )}

      {/* Progress bar — only shown when task has subtasks */}
      {task.totalSubtasks > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground font-medium">Progress</span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {task.subtaskProgress}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-teal-500 transition-all duration-300"
              style={{ width: `${task.subtaskProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom row: assignee avatar + counts */}
      <div className="mt-3 flex items-center gap-2">
        {/* Assignee avatar */}
        {task.assignee && (
          <Avatar className="size-7">
            {task.assignee.avatar && (
              <AvatarImage
                src={task.assignee.avatar}
                alt={task.assignee.name}
              />
            )}
            <AvatarFallback className="text-[11px] bg-gradient-to-br from-brand-600 to-brand-500 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Attachment count */}
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <Paperclip className="size-3" />
          <span className="text-[11px]">{task.attachmentCount}</span>
        </div>

        {/* Comment count */}
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <MessageSquare className="size-3" />
          <span className="text-[11px]">{task.commentCount}</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Overlay card (rendered in DragOverlay)                                    */
/* -------------------------------------------------------------------------- */

export function TaskCardOverlay({ task }: { task: BoardTask }) {
  return <TaskCard task={task} onClick={() => {}} isDragOverlay />;
}
