"use client";

import {
  Search,
  ListFilter,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BacklogMember } from "@/components/backlog/backlog-table";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface BacklogFiltersProps {
  search: string;
  priorityFilter: string;
  typeFilter: string;
  assigneeFilter: string;
  hasActiveFilters: boolean;
  members: BacklogMember[];
  onSearch: (value: string) => void;
  onPriorityFilter: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onAssigneeFilter: (value: string) => void;
  onClearFilters: () => void;
  onCreateClick: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function BacklogFilters({
  search,
  priorityFilter,
  typeFilter,
  assigneeFilter,
  hasActiveFilters,
  members,
  onSearch,
  onPriorityFilter,
  onTypeFilter,
  onAssigneeFilter,
  onClearFilters,
  onCreateClick,
}: BacklogFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b bg-background/50">
      {/* Search */}
      <div className="relative flex-1 min-w-[240px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Filter icon label */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <ListFilter className="size-4" />
        <span className="text-xs font-medium">Filters</span>
      </div>

      {/* Priority filter */}
      <Select value={priorityFilter} onValueChange={onPriorityFilter}>
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
      <Select value={typeFilter} onValueChange={onTypeFilter}>
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
      <Select value={assigneeFilter} onValueChange={onAssigneeFilter}>
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
          onClick={onClearFilters}
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
          onClick={onCreateClick}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Create Task
        </Button>
      </div>
    </div>
  );
}
