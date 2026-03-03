"use client";

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GanttChart, type TimelineTask, type TimelineSprint } from "@/components/timeline/gantt-chart";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface TimelineClientProps {
  tasks: TimelineTask[];
  sprints: TimelineSprint[];
  members: { id: string; name: string; email: string; avatar: string | null }[];
  projectId: string;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function TimelineClient({
  tasks,
  sprints,
  members,
  projectId,
}: TimelineClientProps) {
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Apply filters
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (sprintFilter !== "all") {
      if (sprintFilter === "none") {
        result = result.filter((t) => !t.sprintId);
      } else {
        result = result.filter((t) => t.sprintId === sprintFilter);
      }
    }

    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        result = result.filter((t) => !t.assignee);
      } else {
        result = result.filter((t) => t.assignee?.id === assigneeFilter);
      }
    }

    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter);
    }

    return result;
  }, [tasks, sprintFilter, assigneeFilter, typeFilter]);

  // Count tasks with dates vs without
  const withDates = tasks.filter((t) => t.dueDate).length;
  const withoutDates = tasks.length - withDates;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sprint filter */}
        {sprints.length > 0 && (
          <Select value={sprintFilter} onValueChange={setSprintFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All Sprints" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sprints</SelectItem>
              <SelectItem value="none">No Sprint</SelectItem>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Assignee filter */}
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="All Assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="STORY">Story</SelectItem>
            <SelectItem value="BUG">Bug</SelectItem>
            <SelectItem value="TASK">Task</SelectItem>
            <SelectItem value="EPIC">Epic</SelectItem>
          </SelectContent>
        </Select>

        {/* Info counts */}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </span>
          {withoutDates > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-amber-400" />
              {withoutDates} without due date
            </span>
          )}
        </div>
      </div>

      {/* Gantt chart */}
      <div className="flex-1 min-h-0">
        <GanttChart
          tasks={filteredTasks}
          sprints={sprints}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
