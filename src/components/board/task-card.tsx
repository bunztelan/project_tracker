"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircle2,
  Circle,
  Square,
  Diamond,
  GripVertical,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
/*  Priority helpers                                                          */
/* -------------------------------------------------------------------------- */

const PRIORITY_CONFIG: Record<
  BoardTask["priority"],
  { label: string; className: string }
> = {
  LOW: {
    label: "Low",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  HIGH: {
    label: "High",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  CRITICAL: {
    label: "Critical",
    className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
};

/* -------------------------------------------------------------------------- */
/*  Task type icon helpers                                                    */
/* -------------------------------------------------------------------------- */

const TYPE_CONFIG: Record<
  BoardTask["type"],
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  STORY: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    label: "Story",
  },
  BUG: {
    icon: Circle,
    className: "text-red-500",
    label: "Bug",
  },
  TASK: {
    icon: Square,
    className: "text-blue-500",
    label: "Task",
  },
  EPIC: {
    icon: Diamond,
    className: "text-purple-500",
    label: "Epic",
  },
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
  const typeConfig = TYPE_CONFIG[task.type];
  const TypeIcon = typeConfig.icon;

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
          "rotate-[2deg] scale-105 shadow-xl ring-2 ring-violet-400/50",
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

      {/* Type icon + title */}
      <div className="flex items-start gap-2 pr-6">
        <TypeIcon
          className={cn("mt-0.5 size-4 shrink-0", typeConfig.className)}
        />
        <h4 className="text-sm font-medium leading-snug text-foreground line-clamp-2">
          {task.title}
        </h4>
      </div>

      {/* Bottom row: priority pill, story points, assignee */}
      <div className="mt-3 flex items-center gap-2">
        {/* Priority pill */}
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            priority.className
          )}
        >
          {priority.label}
        </span>

        {/* Story points */}
        {task.storyPoints != null && task.storyPoints > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
            {task.storyPoints}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Assignee avatar */}
        {task.assignee && (
          <Avatar size="sm">
            {task.assignee.avatar && (
              <AvatarImage
                src={task.assignee.avatar}
                alt={task.assignee.name}
              />
            )}
            <AvatarFallback className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
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
