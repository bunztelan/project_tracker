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
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface KpiCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "violet" | "blue" | "amber" | "emerald";
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
/*  Color tokens                                                              */
/* -------------------------------------------------------------------------- */

const colorMap = {
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
} as const;

const statusDot: Record<string, string> = {
  active: "bg-emerald-500",
  planning: "bg-blue-500",
  completed: "bg-violet-500",
  on_hold: "bg-amber-500",
  archived: "bg-gray-400",
};

/* -------------------------------------------------------------------------- */
/*  Data fetching                                                             */
/* -------------------------------------------------------------------------- */

async function getDashboardData(userId: string, organizationId: string | null) {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m) => m.projectId);

  // Scope by organization if active
  const projectWhere = {
    id: { in: projectIds },
    ...(organizationId ? { organizationId } : {}),
  };

  const [totalProjects, totalTasks, tasksInProgress, tasksCompleted, recentProjectsRaw, organization] =
    await Promise.all([
      prisma.project.count({ where: projectWhere }),
      prisma.task.count({ where: { project: projectWhere } }),
      prisma.task.count({
        where: { project: projectWhere, status: "in_progress" },
      }),
      prisma.task.count({
        where: { project: projectWhere, status: "done" },
      }),
      prisma.project.findMany({
        where: projectWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          _count: { select: { members: true, tasks: true } },
          tasks: { where: { status: "done" }, select: { id: true } },
        },
      }),
      organizationId
        ? prisma.organization.findUnique({
            where: { id: organizationId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

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

  return { totalProjects, totalTasks, tasksInProgress, tasksCompleted, recentProjects, organizationName: organization?.name ?? null };
}

/* -------------------------------------------------------------------------- */
/*  KPI Card                                                                  */
/* -------------------------------------------------------------------------- */

function KpiCardItem({ card, index }: { card: KpiCard; index: number }) {
  const c = colorMap[card.color];
  const Icon = card.icon;

  return (
    <div
      className="animate-dash-fade-up rounded-2xl border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${index * 75}ms` }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.bg}`}
        >
          <Icon className={`h-5 w-5 ${c.text}`} />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {card.label}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">
        {card.value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Project Card                                                              */
/* -------------------------------------------------------------------------- */

function ProjectCard({
  project,
  index,
}: {
  project: RecentProject;
  index: number;
}) {
  const totalTasks = project._count.tasks;
  const doneTasks = project.tasksDone;
  const progress =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const dot = statusDot[project.status] ?? "bg-gray-400";

  return (
    <Link
      href={`/projects/${project.id}/board`}
      className="animate-dash-fade-up group block rounded-2xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-500/20"
      style={{ animationDelay: `${250 + index * 60}ms` }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
            <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300">
              {project.name}
            </h3>
            <Badge
              variant="secondary"
              className="shrink-0 text-[11px] font-mono font-medium"
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
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {project._count.members} member
          {project._count.members !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <CheckSquare className="h-3.5 w-3.5" />
          {doneTasks}/{totalTasks} tasks
        </span>
        {totalTasks > 0 && (
          <span className="ml-auto text-xs font-medium text-foreground">
            {progress}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500 dark:bg-brand-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userName = session.user.name ?? "there";
  const firstName = userName.split(" ")[0];

  /* Time-aware greeting */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let dashboardData: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let fetchError = false;

  try {
    dashboardData = await getDashboardData(session.user.id, session.user.activeOrganizationId ?? null);
  } catch {
    fetchError = true;
  }

  const kpiCards: KpiCard[] = [
    { label: "Projects", value: dashboardData?.totalProjects ?? 0, icon: FolderOpen, color: "violet" },
    { label: "Total Tasks", value: dashboardData?.totalTasks ?? 0, icon: CheckSquare, color: "blue" },
    { label: "In Progress", value: dashboardData?.tasksInProgress ?? 0, icon: Clock, color: "amber" },
    { label: "Completed", value: dashboardData?.tasksCompleted ?? 0, icon: CheckCircle2, color: "emerald" },
  ];

  return (
    <div className="space-y-8">
      {/* ── Greeting ─────────────────────────────────────────── */}
      <div className="animate-dash-fade-up">
        <p className="text-sm font-medium text-muted-foreground">{dateStr}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {greeting}, {firstName}
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          {dashboardData?.organizationName && (
            <Badge variant="outline" className="border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
              {dashboardData.organizationName}
            </Badge>
          )}
          {dashboardData && dashboardData.totalTasks > 0 && (
            <span>
              {dashboardData.tasksInProgress} task
              {dashboardData.tasksInProgress !== 1 ? "s" : ""} in progress
              {" \u00b7 "}
              {dashboardData.tasksCompleted} completed
            </span>
          )}
        </div>
      </div>

      {/* ── DB error notice ──────────────────────────────────── */}
      {fetchError && (
        <div
          className="animate-dash-fade-up rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5"
          style={{ animationDelay: "50ms" }}
        >
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Database not connected
          </p>
          <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
            Dashboard data will appear once the database is configured.
          </p>
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, i) => (
          <KpiCardItem key={card.label} card={card} index={i} />
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent Projects (2/3) */}
        <section className="lg:col-span-2">
          <div
            className="animate-dash-fade-up mb-4 flex items-center justify-between"
            style={{ animationDelay: "200ms" }}
          >
            <h2 className="text-lg font-semibold text-foreground">
              Recent Projects
            </h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {dashboardData && dashboardData.recentProjects.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {dashboardData.recentProjects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          ) : (
            <div
              className="animate-dash-fade-up flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center"
              style={{ animationDelay: "300ms" }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
                <FolderOpen className="h-7 w-7 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                No projects yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first project to get started.
              </p>
              <Link
                href="/projects"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </div>
          )}
        </section>

        {/* Activity (1/3) */}
        <section
          className="animate-dash-fade-up"
          style={{ animationDelay: "350ms" }}
        >
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Activity
          </h2>

          <div className="overflow-hidden rounded-2xl border bg-card">
            {/* Placeholder */}
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Coming soon
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recent actions and team updates
              </p>
            </div>

            {/* Feature preview items */}
            <div className="space-y-1 border-t px-4 py-3">
              {(
                [
                  { icon: TrendingUp, label: "Project analytics", color: "violet" },
                  { icon: CheckCircle2, label: "Task tracking", color: "emerald" },
                  { icon: Users, label: "Team feed", color: "blue" },
                ] as const
              ).map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorMap[item.color].bg}`}
                  >
                    <item.icon
                      className={`h-3.5 w-3.5 ${colorMap[item.color].text}`}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] font-normal"
                  >
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
