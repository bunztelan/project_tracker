import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectFeatures, isFeatureEnabled } from "@/lib/features";
import { TimelineClient } from "./timeline-client";

/* -------------------------------------------------------------------------- */
/*  Timeline page — server component that fetches tasks with date info        */
/* -------------------------------------------------------------------------- */

interface TimelinePageProps {
  params: Promise<{ id: string }>;
}

export default async function TimelinePage({ params }: TimelinePageProps) {
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
  if (!isFeatureEnabled(features, "timeline")) {
    notFound();
  }

  // Fetch tasks, sprints, and members in parallel
  const [tasks, sprints, projectMembers] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
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
    }),
    prisma.sprint.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.projectMember.findMany({
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
    }),
  ]);

  const members = projectMembers.map((pm) => pm.user);

  // Shape tasks for the client component
  const shapedTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    type: task.type,
    storyPoints: task.storyPoints,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    assignee: task.assignee,
    sprintId: task.sprintId,
  }));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Timeline</h1>
          <p className="text-xs text-muted-foreground">
            Visualize task schedules on a Gantt chart
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-4">
        {tasks.length === 0 ? (
          <div className="flex flex-1 h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20">
                <svg
                  className="h-7 w-7 text-brand-600 dark:text-brand-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">No tasks yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create tasks on the Board or Backlog to see them plotted on the
                timeline. Tasks use their start date and due date to form bars.
              </p>
            </div>
          </div>
        ) : (
          <TimelineClient
            tasks={shapedTasks}
            sprints={sprints}
            members={members}
            projectId={id}
          />
        )}
      </div>
    </div>
  );
}
