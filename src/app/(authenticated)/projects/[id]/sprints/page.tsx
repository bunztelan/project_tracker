import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SprintBoard } from "@/components/sprints/sprint-board";

/* -------------------------------------------------------------------------- */
/*  Sprints page — server component that fetches data for the client board    */
/* -------------------------------------------------------------------------- */

interface SprintsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SprintsPage({ params }: SprintsPageProps) {
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

  const canManage =
    membership.role === "ADMIN" || membership.role === "MANAGER";

  // Fetch sprints with task data
  const sprints = await prisma.sprint.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: {
      tasks: {
        orderBy: { createdAt: "desc" },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  // Shape sprint data for the client
  const shapedSprints = sprints.map((sprint) => {
    const completedCount = sprint.tasks.filter(
      (t) => t.status === "done"
    ).length;

    return {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate ? sprint.startDate.toISOString() : null,
      endDate: sprint.endDate ? sprint.endDate.toISOString() : null,
      status: sprint.status as "PLANNING" | "ACTIVE" | "COMPLETED",
      createdAt: sprint.createdAt.toISOString(),
      taskCount: sprint.tasks.length,
      completedTaskCount: completedCount,
      tasks: sprint.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        type: task.type as "STORY" | "BUG" | "TASK" | "EPIC",
        storyPoints: task.storyPoints,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        assignee: task.assignee,
        sprintId: task.sprintId,
      })),
    };
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Sprints</h1>
          <p className="text-xs text-muted-foreground">
            Plan and track your team&apos;s work in time-boxed iterations
          </p>
        </div>
      </div>

      {/* Sprint board */}
      <div className="flex-1 overflow-auto">
        <SprintBoard
          initialSprints={shapedSprints}
          projectId={id}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
