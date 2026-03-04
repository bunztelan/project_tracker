import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectFeatures, isFeatureEnabled } from "@/lib/features";
import { BacklogTable } from "@/components/backlog/backlog-table";

/* -------------------------------------------------------------------------- */
/*  Backlog page — server component that fetches data for the table           */
/* -------------------------------------------------------------------------- */

interface BacklogPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ backlogOnly?: string }>;
}

export default async function BacklogPage({
  params,
  searchParams,
}: BacklogPageProps) {
  const { id } = await params;
  const { backlogOnly } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    notFound();
  }

  // Verify membership
  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: id,
      },
    },
  });

  if (!membership) {
    notFound();
  }

  // Feature gate
  const features = await getProjectFeatures(id);
  if (!isFeatureEnabled(features, "backlog")) {
    notFound();
  }

  // Build where clause — optionally filter to only backlog tasks (no sprint)
  const isBacklogOnly = backlogOnly === "true";
  const where: Record<string, unknown> = { projectId: id };
  if (isBacklogOnly) {
    where.sprintId = null;
  }

  // Fetch tasks and count in parallel
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            subtasks: true,
            comments: true,
            attachments: true,
          },
        },
        subtasks: {
          select: { status: true },
        },
      },
    }),
    prisma.task.count({ where }),
  ]);

  // Fetch board columns (needed for TaskDetailDialog status dropdowns)
  const board = await prisma.board.findFirst({
    where: { projectId: id },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
            take: 0, // We don't need tasks in columns, just column metadata
            include: {
              assignee: {
                select: { id: true, name: true, email: true, avatar: true },
              },
              reporter: {
                select: { id: true, name: true, email: true, avatar: true },
              },
              _count: { select: { subtasks: true } },
            },
          },
        },
      },
    },
  });

  // Fetch project members for assignee filter
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
  });

  const members = projectMembers.map((pm) => pm.user);

  // Shape data for the client component
  const shapedTasks = tasks.map((task) => {
    const completedCount = task.subtasks.filter(
      (s: { status: string }) => s.status === "done"
    ).length;

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      storyPoints: task.storyPoints,
      position: task.position,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      assignee: task.assignee,
      reporter: task.reporter,
      subtaskCount: task._count.subtasks,
      commentCount: task._count.comments,
      attachmentCount: task._count.attachments,
      totalSubtasks: task._count.subtasks,
      completedSubtasks: completedCount,
      subtaskProgress: task._count.subtasks > 0
        ? Math.round((completedCount / task._count.subtasks) * 100)
        : 0,
      parentId: task.parentId,
      sprintId: task.sprintId,
    };
  });

  const boardColumns = board
    ? board.columns.map((col) => ({
        id: col.id,
        name: col.name,
        position: col.position,
        tasks: col.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          type: t.type,
          storyPoints: t.storyPoints,
          position: t.position,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          assignee: t.assignee,
          reporter: t.reporter,
          subtaskCount: t._count.subtasks,
          commentCount: 0,
          attachmentCount: 0,
          subtaskProgress: 0,
          completedSubtasks: 0,
          totalSubtasks: t._count.subtasks,
          parentId: t.parentId,
          sprintId: t.sprintId,
        })),
      }))
    : [];

  const pagination = {
    page: 1,
    limit: 20,
    total,
    totalPages: Math.ceil(total / 20),
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Backlog</h1>
          <p className="text-xs text-muted-foreground">
            View and manage all tasks in a table format
          </p>
        </div>

        {/* Toggle: All tasks vs Backlog only */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
          <a
            href={`/projects/${id}/backlog`}
            className={
              !isBacklogOnly
                ? "rounded-md bg-background px-3 py-1.5 text-xs font-medium shadow-sm"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            All Tasks
          </a>
          <a
            href={`/projects/${id}/backlog?backlogOnly=true`}
            className={
              isBacklogOnly
                ? "rounded-md bg-background px-3 py-1.5 text-xs font-medium shadow-sm"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            Backlog Only
          </a>
        </div>
      </div>

      {/* Backlog table */}
      <div className="flex-1 overflow-auto">
        <BacklogTable
          initialTasks={shapedTasks}
          projectId={id}
          members={members}
          columns={boardColumns}
          pagination={pagination}
        />
      </div>
    </div>
  );
}
