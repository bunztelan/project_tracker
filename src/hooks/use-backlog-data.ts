"use client";

import { useState, useCallback, useMemo } from "react";
import { PRIORITY_CONFIG } from "@/lib/task-constants";
import type { BoardTask } from "@/components/board/task-card";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type SortField =
  | "title"
  | "type"
  | "priority"
  | "assignee"
  | "storyPoints"
  | "status"
  | "dueDate";

export type SortDirection = "asc" | "desc";

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

interface UseBacklogDataProps {
  initialTasks: BoardTask[];
  projectId: string;
  initialPagination: Pagination;
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

export function useBacklogData({
  initialTasks,
  projectId,
  initialPagination,
}: UseBacklogDataProps) {
  // -- State --
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(false);

  // -- Detail dialog --
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // -- Create dialog --
  const [createOpen, setCreateOpen] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*  Fetch tasks from API                                                      */
  /* -------------------------------------------------------------------------- */

  const fetchTasks = useCallback(
    async (
      page: number,
      searchTerm?: string,
      priority?: string,
      type?: string,
      assignee?: string
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");

        if (searchTerm) params.set("search", searchTerm);
        if (priority && priority !== "all") params.set("priority", priority);
        if (type && type !== "all") params.set("type", type);
        if (assignee && assignee !== "all") params.set("assignee", assignee);

        const res = await fetch(
          `/api/projects/${projectId}/tasks?${params.toString()}`
        );

        if (!res.ok) throw new Error("Failed to fetch tasks");

        const json = await res.json();
        if (json.data) {
          // Shape into BoardTask format
          const shaped: BoardTask[] = json.data.tasks.map(
            (t: Record<string, unknown>) => ({
              id: t.id as string,
              title: t.title as string,
              description: t.description as string | null,
              status: t.status as string,
              priority: t.priority as BoardTask["priority"],
              type: t.type as BoardTask["type"],
              storyPoints: t.storyPoints as number | null,
              position: t.position as number,
              dueDate: t.dueDate as string | null,
              createdAt: t.createdAt as string,
              updatedAt: t.updatedAt as string,
              assignee: t.assignee as BoardTask["assignee"],
              reporter: t.reporter as BoardTask["reporter"],
              subtaskCount: t.subtaskCount as number,
              parentId: t.parentId as string | null,
              sprintId: t.sprintId as string | null,
            })
          );
          setTasks(shaped);
          setPagination(
            json.data.pagination as Pagination
          );
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  /* -------------------------------------------------------------------------- */
  /*  Sorting (client-side on current page)                                     */
  /* -------------------------------------------------------------------------- */

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "priority":
          comparison =
            PRIORITY_CONFIG[a.priority].order -
            PRIORITY_CONFIG[b.priority].order;
          break;
        case "assignee":
          comparison = (a.assignee?.name || "").localeCompare(
            b.assignee?.name || ""
          );
          break;
        case "storyPoints":
          comparison = (a.storyPoints || 0) - (b.storyPoints || 0);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "dueDate":
          comparison =
            new Date(a.dueDate || "9999-12-31").getTime() -
            new Date(b.dueDate || "9999-12-31").getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [tasks, sortField, sortDirection]);

  /* -------------------------------------------------------------------------- */
  /*  Handlers                                                                  */
  /* -------------------------------------------------------------------------- */

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      fetchTasks(1, value, priorityFilter, typeFilter, assigneeFilter);
    },
    [fetchTasks, priorityFilter, typeFilter, assigneeFilter]
  );

  const handlePriorityFilter = useCallback(
    (value: string) => {
      setPriorityFilter(value);
      fetchTasks(1, search, value, typeFilter, assigneeFilter);
    },
    [fetchTasks, search, typeFilter, assigneeFilter]
  );

  const handleTypeFilter = useCallback(
    (value: string) => {
      setTypeFilter(value);
      fetchTasks(1, search, priorityFilter, value, assigneeFilter);
    },
    [fetchTasks, search, priorityFilter, assigneeFilter]
  );

  const handleAssigneeFilter = useCallback(
    (value: string) => {
      setAssigneeFilter(value);
      fetchTasks(1, search, priorityFilter, typeFilter, value);
    },
    [fetchTasks, search, priorityFilter, typeFilter]
  );

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setPriorityFilter("all");
    setTypeFilter("all");
    setAssigneeFilter("all");
    fetchTasks(1, "", "all", "all", "all");
  }, [fetchTasks]);

  const handlePageChange = useCallback(
    (page: number) => {
      fetchTasks(page, search, priorityFilter, typeFilter, assigneeFilter);
    },
    [fetchTasks, search, priorityFilter, typeFilter, assigneeFilter]
  );

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

      if (!res.ok) throw new Error("Failed to update task");

      // Refresh the current page
      await fetchTasks(
        pagination.page,
        search,
        priorityFilter,
        typeFilter,
        assigneeFilter
      );
    },
    [
      projectId,
      fetchTasks,
      pagination.page,
      search,
      priorityFilter,
      typeFilter,
      assigneeFilter,
    ]
  );

  const handleTaskDelete = useCallback(
    async (taskId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Failed to delete task");

      // Refresh the current page
      await fetchTasks(
        pagination.page,
        search,
        priorityFilter,
        typeFilter,
        assigneeFilter
      );
    },
    [
      projectId,
      fetchTasks,
      pagination.page,
      search,
      priorityFilter,
      typeFilter,
      assigneeFilter,
    ]
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

      // Refresh current page
      await fetchTasks(
        pagination.page,
        search,
        priorityFilter,
        typeFilter,
        assigneeFilter
      );
    },
    [
      projectId,
      fetchTasks,
      pagination.page,
      search,
      priorityFilter,
      typeFilter,
      assigneeFilter,
    ]
  );

  const hasActiveFilters =
    search !== "" ||
    priorityFilter !== "all" ||
    typeFilter !== "all" ||
    assigneeFilter !== "all";

  /* -------------------------------------------------------------------------- */
  /*  Return                                                                    */
  /* -------------------------------------------------------------------------- */

  return {
    // State
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

    // State setters (for dialog open/close)
    setDetailOpen,
    setCreateOpen,

    // Handlers
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
  };
}
