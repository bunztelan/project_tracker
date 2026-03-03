import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FolderOpen,
  CheckSquare,
  Clock,
  CheckCircle2,
  ArrowRight,
  Users,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface KpiCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "violet" | "blue" | "amber" | "green";
}

interface RecentProject {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  createdAt: Date;
  _count: { members: number; tasks: number };
  tasksDone: number;
}

/* -------------------------------------------------------------------------- */
/*  Color map — each KPI card gets a unique accent                             */
/* -------------------------------------------------------------------------- */

const colorMap = {
  violet: {
    bg: "bg-gradient-to-br from-violet-500/10 to-violet-600/5",
    border: "border-l-4 border-l-violet-500",
    iconBg: "bg-violet-100 dark:bg-violet-500/20",
    iconText: "text-violet-600 dark:text-violet-400",
    valueText: "text-violet-700 dark:text-violet-300",
  },
  blue: {
    bg: "bg-gradient-to-br from-blue-500/10 to-blue-600/5",
    border: "border-l-4 border-l-blue-500",
    iconBg: "bg-blue-100 dark:bg-blue-500/20",
    iconText: "text-blue-600 dark:text-blue-400",
    valueText: "text-blue-700 dark:text-blue-300",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-500/10 to-amber-600/5",
    border: "border-l-4 border-l-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-500/20",
    iconText: "text-amber-600 dark:text-amber-400",
    valueText: "text-amber-700 dark:text-amber-300",
  },
  green: {
    bg: "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5",
    border: "border-l-4 border-l-emerald-500",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/20",
    iconText: "text-emerald-600 dark:text-emerald-400",
    valueText: "text-emerald-700 dark:text-emerald-300",
  },
} as const;

/* -------------------------------------------------------------------------- */
/*  Data fetching                                                             */
/* -------------------------------------------------------------------------- */

async function getDashboardData(userId: string) {
  // Fetch all projects the user is a member of
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m) => m.projectId);

  // Run aggregate queries in parallel
  const [totalProjects, totalTasks, tasksInProgress, tasksCompleted, recentProjectsRaw] =
    await Promise.all([
      // Total projects count
      prisma.project.count({
        where: { id: { in: projectIds } },
      }),

      // Total tasks across user's projects
      prisma.task.count({
        where: { projectId: { in: projectIds } },
      }),

      // Tasks currently in progress
      prisma.task.count({
        where: {
          projectId: { in: projectIds },
          status: "in_progress",
        },
      }),

      // Completed tasks
      prisma.task.count({
        where: {
          projectId: { in: projectIds },
          status: "done",
        },
      }),

      // Recent 5 projects with member + task counts
      prisma.project.findMany({
        where: { id: { in: projectIds } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          _count: {
            select: { members: true, tasks: true },
          },
          tasks: {
            where: { status: "done" },
            select: { id: true },
          },
        },
      }),
    ]);

  // Map recent projects to include tasksDone count
  const recentProjects: RecentProject[] = recentProjectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
    _count: p._count,
    tasksDone: p.tasks.length,
  }));

  return {
    totalProjects,
    totalTasks,
    tasksInProgress,
    tasksCompleted,
    recentProjects,
  };
}

/* -------------------------------------------------------------------------- */
/*  KPI Card Component                                                        */
/* -------------------------------------------------------------------------- */

function KpiCardItem({ card }: { card: KpiCard }) {
  const colors = colorMap[card.color];
  const Icon = card.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${colors.border} ${colors.bg} p-6 shadow-sm transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {card.label}
          </p>
          <p className={`text-4xl font-bold tracking-tight ${colors.valueText}`}>
            {card.value}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.iconBg}`}
        >
          <Icon className={`h-6 w-6 ${colors.iconText}`} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Project Card Component                                                    */
/* -------------------------------------------------------------------------- */

function ProjectCard({ project }: { project: RecentProject }) {
  const totalTasks = project._count.tasks;
  const doneTasks = project.tasksDone;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <Link
      href={`/projects/${project.id}/board`}
      className="group block rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-violet-200 dark:hover:border-violet-500/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-base font-semibold text-foreground group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
              {project.name}
            </h3>
            <Badge
              variant="secondary"
              className="shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 text-[11px] font-mono font-semibold"
            >
              {project.key}
            </Badge>
          </div>
          {project.description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
      </div>

      {/* Stats row */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {project._count.members} member{project._count.members !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <CheckSquare className="h-3.5 w-3.5" />
          {totalTasks} task{totalTasks !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page Component                                                            */
/* -------------------------------------------------------------------------- */

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const userName = session.user.name ?? "there";
  const firstName = userName.split(" ")[0];

  let dashboardData: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let fetchError = false;

  try {
    dashboardData = await getDashboardData(session.user.id);
  } catch {
    fetchError = true;
  }

  const kpiCards: KpiCard[] = [
    {
      label: "Total Projects",
      value: dashboardData?.totalProjects ?? 0,
      icon: FolderOpen,
      color: "violet",
    },
    {
      label: "Total Tasks",
      value: dashboardData?.totalTasks ?? 0,
      icon: CheckSquare,
      color: "blue",
    },
    {
      label: "In Progress",
      value: dashboardData?.tasksInProgress ?? 0,
      icon: Clock,
      color: "amber",
    },
    {
      label: "Completed",
      value: dashboardData?.tasksCompleted ?? 0,
      icon: CheckCircle2,
      color: "green",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s an overview of your projects and tasks.
        </p>
      </div>

      {/* Database connection notice */}
      {fetchError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-medium">Database not connected</p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            Dashboard data will appear once the database is configured and
            running.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <KpiCardItem key={card.label} card={card} />
          ))}
        </div>
      </section>

      {/* Recent Projects + Activity Feed */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent Projects — takes 2/3 */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
              Recent Projects
            </h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {dashboardData && dashboardData.recentProjects.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboardData.recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/20">
                <FolderOpen className="h-7 w-7 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                No projects yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first project to get started.
              </p>
            </div>
          )}
        </section>

        {/* Activity Feed — takes 1/3 */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            Recent Activity
          </h2>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Activity tracking coming soon
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll show your recent actions and team updates here.
              </p>
            </div>

            {/* Placeholder activity items for visual effect */}
            <div className="mt-4 space-y-3 border-t pt-4">
              {[
                { icon: TrendingUp, text: "Project analytics", color: "text-violet-500" },
                { icon: CheckCircle2, text: "Task completion tracking", color: "text-emerald-500" },
                { icon: Users, text: "Team collaboration feed", color: "text-blue-500" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
                >
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span>{item.text}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    Soon
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
