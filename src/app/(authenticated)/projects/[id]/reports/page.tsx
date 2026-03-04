import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectFeatures, isFeatureEnabled } from "@/lib/features";
import {
  computeBurndown,
  computeVelocity,
  computeDistribution,
  type BurndownDataPoint,
} from "@/lib/reports";
import { ReportsClient } from "./reports-client";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type SprintInfo = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

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

  // Feature gate
  const features = await getProjectFeatures(id);
  if (!isFeatureEnabled(features, "reports")) {
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
