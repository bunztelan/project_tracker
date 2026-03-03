import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportsClient } from "./reports-client";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type BurndownDataPoint = {
  day: string;
  ideal: number;
  actual: number | null;
};

type VelocityDataPoint = {
  sprint: string;
  completed: number;
  committed: number;
};

type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

type SprintInfo = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

/* -------------------------------------------------------------------------- */
/*  Color maps                                                                */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",       // slate-400
  in_progress: "#3b82f6", // blue-500
  in_review: "#f59e0b",   // amber-500
  done: "#22c55e",         // green-500
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#94a3b8",       // slate-400
  MEDIUM: "#3b82f6",    // blue-500
  HIGH: "#f97316",      // orange-500
  CRITICAL: "#ef4444",  // red-500
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const TYPE_COLORS: Record<string, string> = {
  STORY: "#10b981",   // emerald-500
  BUG: "#ef4444",     // red-500
  TASK: "#3b82f6",    // blue-500
  EPIC: "#a855f7",    // purple-500
};

const TYPE_LABELS: Record<string, string> = {
  STORY: "Story",
  BUG: "Bug",
  TASK: "Task",
  EPIC: "Epic",
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function computeBurndown(
  sprint: {
    startDate: Date | null;
    endDate: Date | null;
    tasks: Array<{ status: string; storyPoints: number | null; updatedAt: Date }>;
  }
): { data: BurndownDataPoint[]; totalPoints: number } {
  if (!sprint.startDate || !sprint.endDate) {
    return { data: [], totalPoints: 0 };
  }

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const totalPoints = sprint.tasks.reduce(
    (sum, t) => sum + (t.storyPoints ?? 1),
    0
  );

  if (totalPoints === 0) return { data: [], totalPoints: 0 };

  // Calculate number of days in sprint
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / msPerDay)
  );

  // Build day-by-day data
  const data: BurndownDataPoint[] = [];
  const today = new Date();

  for (let i = 0; i <= totalDays; i++) {
    const currentDay = new Date(start.getTime() + i * msPerDay);
    const dayLabel = `Day ${i + 1}`;

    // Ideal burndown: straight line from totalPoints to 0
    const idealRemaining =
      Math.round((totalPoints * (1 - i / totalDays)) * 10) / 10;

    // Actual: count remaining points at end of this day
    let actual: number | null = null;
    if (currentDay <= today) {
      const completedByDay = sprint.tasks
        .filter(
          (t) =>
            t.status === "done" &&
            new Date(t.updatedAt) <= new Date(currentDay.getTime() + msPerDay)
        )
        .reduce((sum, t) => sum + (t.storyPoints ?? 1), 0);

      actual = totalPoints - completedByDay;
    }

    data.push({
      day: dayLabel,
      ideal: idealRemaining,
      actual,
    });
  }

  return { data, totalPoints };
}

function computeVelocity(
  sprints: Array<{
    name: string;
    status: string;
    tasks: Array<{ status: string; storyPoints: number | null }>;
  }>
): VelocityDataPoint[] {
  // Only include completed or active sprints
  return sprints
    .filter((s) => s.status === "COMPLETED" || s.status === "ACTIVE")
    .map((sprint) => {
      const committed = sprint.tasks.reduce(
        (sum, t) => sum + (t.storyPoints ?? 1),
        0
      );
      const completed = sprint.tasks
        .filter((t) => t.status === "done")
        .reduce((sum, t) => sum + (t.storyPoints ?? 1), 0);

      return {
        sprint: sprint.name,
        committed,
        completed,
      };
    });
}

function computeDistribution(
  tasks: Array<{
    status: string;
    priority: string;
    type: string;
  }>
) {
  // Status distribution
  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};

  for (const task of tasks) {
    statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
    priorityCounts[task.priority] = (priorityCounts[task.priority] ?? 0) + 1;
    typeCounts[task.type] = (typeCounts[task.type] ?? 0) + 1;
  }

  const byStatus: DistributionItem[] = Object.entries(statusCounts).map(
    ([key, value]) => ({
      name: STATUS_LABELS[key] ?? key,
      value,
      color: STATUS_COLORS[key] ?? "#94a3b8",
    })
  );

  const byPriority: DistributionItem[] = Object.entries(priorityCounts).map(
    ([key, value]) => ({
      name: PRIORITY_LABELS[key] ?? key,
      value,
      color: PRIORITY_COLORS[key] ?? "#94a3b8",
    })
  );

  const byType: DistributionItem[] = Object.entries(typeCounts).map(
    ([key, value]) => ({
      name: TYPE_LABELS[key] ?? key,
      value,
      color: TYPE_COLORS[key] ?? "#94a3b8",
    })
  );

  return { byStatus, byPriority, byType };
}

/* -------------------------------------------------------------------------- */
/*  Reports page — server component                                           */
/* -------------------------------------------------------------------------- */

interface ReportsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
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

  // Fetch sprints and all tasks in parallel
  const [sprints, allTasks] = await Promise.all([
    prisma.sprint.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            storyPoints: true,
            priority: true,
            type: true,
            updatedAt: true,
          },
        },
      },
    }),
    prisma.task.findMany({
      where: { projectId: id },
      select: {
        status: true,
        priority: true,
        type: true,
      },
    }),
  ]);

  // Shape sprint info for the dropdown
  const sprintInfos: SprintInfo[] = sprints.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate ? s.startDate.toISOString() : null,
    endDate: s.endDate ? s.endDate.toISOString() : null,
    status: s.status,
  }));

  // Compute burndown for each sprint
  const burndownBySprint: Record<
    string,
    { data: BurndownDataPoint[]; totalPoints: number }
  > = {};
  for (const sprint of sprints) {
    burndownBySprint[sprint.id] = computeBurndown(sprint);
  }

  // Compute velocity data
  const velocityData = computeVelocity(sprints);

  // Compute distribution data
  const distributionData = computeDistribution(allTasks);

  // Pick default sprint (prefer active, then most recent)
  const activeSprint = sprints.find((s) => s.status === "ACTIVE");
  const defaultSprintId =
    activeSprint?.id ?? sprints[sprints.length - 1]?.id ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Reports</h1>
          <p className="text-xs text-muted-foreground">
            Charts and insights to track your project progress
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <ReportsClient
          sprints={sprintInfos}
          burndownBySprint={burndownBySprint}
          velocityData={velocityData}
          distributionData={distributionData}
          defaultSprintId={defaultSprintId}
        />
      </div>
    </div>
  );
}
