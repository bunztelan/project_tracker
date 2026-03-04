import { CheckCircle2, Circle, Square, Diamond } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Status                                                                    */
/* -------------------------------------------------------------------------- */

export const TASK_STATUSES = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  DONE: "done",
} as const;

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  todo: {
    label: "To Do",
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  in_review: {
    label: "In Review",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  done: {
    label: "Done",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
};

/* -------------------------------------------------------------------------- */
/*  Priority                                                                  */
/* -------------------------------------------------------------------------- */

export const PRIORITY_CONFIG: Record<
  "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  {
    label: string;
    className: string;
    badgeClassName: string;
    dotColor: string;
    order: number;
  }
> = {
  LOW: {
    label: "Low",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    badgeClassName:
      "bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700",
    dotColor: "bg-gray-400",
    order: 1,
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    badgeClassName:
      "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    dotColor: "bg-blue-500",
    order: 2,
  },
  HIGH: {
    label: "High",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
    badgeClassName:
      "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    dotColor: "bg-orange-500",
    order: 3,
  },
  CRITICAL: {
    label: "Critical",
    className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    badgeClassName:
      "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    dotColor: "bg-red-500",
    order: 4,
  },
};

export const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-400" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-500" },
  { value: "HIGH", label: "High", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-500" },
] as const;

/* -------------------------------------------------------------------------- */
/*  Type                                                                      */
/* -------------------------------------------------------------------------- */

export const TYPE_CONFIG: Record<
  "STORY" | "BUG" | "TASK" | "EPIC",
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  STORY: { icon: CheckCircle2, className: "text-emerald-500", label: "Story" },
  BUG: { icon: Circle, className: "text-red-500", label: "Bug" },
  TASK: { icon: Square, className: "text-blue-500", label: "Task" },
  EPIC: { icon: Diamond, className: "text-purple-500", label: "Epic" },
};

export const TYPES = [
  { value: "STORY", label: "Story", icon: CheckCircle2, color: "text-emerald-500" },
  { value: "BUG", label: "Bug", icon: Circle, color: "text-red-500" },
  { value: "TASK", label: "Task", icon: Square, color: "text-blue-500" },
  { value: "EPIC", label: "Epic", icon: Diamond, color: "text-purple-500" },
] as const;

/* -------------------------------------------------------------------------- */
/*  Column limits                                                             */
/* -------------------------------------------------------------------------- */

export const MAX_COLUMNS = 6;
export const MIN_COLUMNS = 4;

/* -------------------------------------------------------------------------- */
/*  Status from column name                                                   */
/* -------------------------------------------------------------------------- */

export function statusFromColumnName(columnName: string): TaskStatus {
  const lower = columnName.toLowerCase();
  if (lower.includes("progress")) return TASK_STATUSES.IN_PROGRESS;
  if (lower.includes("review")) return TASK_STATUSES.IN_REVIEW;
  if (lower.includes("done")) return TASK_STATUSES.DONE;
  return TASK_STATUSES.TODO;
}
