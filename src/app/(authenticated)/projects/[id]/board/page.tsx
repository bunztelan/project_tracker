import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectFeatures, isFeatureEnabled } from "@/lib/features";
import { KanbanBoard } from "@/components/board/kanban-board";

/* -------------------------------------------------------------------------- */
/*  Board page — server component that fetches data and renders client board  */
/* -------------------------------------------------------------------------- */

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;

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
  if (!isFeatureEnabled(features, "kanban")) {
    notFound();
  }

  // Fetch board with columns and tasks
  const board = await prisma.board.findFirst({
    where: { projectId: id },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
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
          },
        },
      },
    },
  });

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-center">
          <h3 className="text-lg font-semibold">No board found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This project does not have a board set up yet.
          </p>
        </div>
      </div>
    );
  }

  // Shape data for the client component
  const boardData = {
    id: board.id,
    name: board.name,
    projectId: board.projectId,
    createdAt: board.createdAt.toISOString(),
    columns: board.columns.map((col) => ({
      id: col.id,
      name: col.name,
      position: col.position,
      tasks: col.tasks.map((task) => {
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
      }),
    })),
  };

  // Fetch project members for assignee dropdowns
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Board header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Board</h1>
          <p className="text-xs text-muted-foreground">
            Drag and drop tasks between columns to update their status
          </p>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          initialData={boardData}
          projectId={id}
          members={members}
        />
      </div>
    </div>
  );
}
