import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FolderOpen,
  Users,
  CheckSquare,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface ProjectData {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  memberCount: number;
  taskCount: number;
  tasksDone: number;
}

/* -------------------------------------------------------------------------- */
/*  Color palette — each project card gets a unique accent color              */
/* -------------------------------------------------------------------------- */

const projectColors = [
  {
    border: "border-l-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    progress: "from-violet-500 to-indigo-500",
    hover: "hover:border-violet-200 dark:hover:border-violet-500/30",
    nameHover: "group-hover:text-violet-700 dark:group-hover:text-violet-300",
  },
  {
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    progress: "from-blue-500 to-cyan-500",
    hover: "hover:border-blue-200 dark:hover:border-blue-500/30",
    nameHover: "group-hover:text-blue-700 dark:group-hover:text-blue-300",
  },
  {
    border: "border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    progress: "from-emerald-500 to-teal-500",
    hover: "hover:border-emerald-200 dark:hover:border-emerald-500/30",
    nameHover: "group-hover:text-emerald-700 dark:group-hover:text-emerald-300",
  },
  {
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    progress: "from-amber-500 to-orange-500",
    hover: "hover:border-amber-200 dark:hover:border-amber-500/30",
    nameHover: "group-hover:text-amber-700 dark:group-hover:text-amber-300",
  },
  {
    border: "border-l-rose-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    progress: "from-rose-500 to-pink-500",
    hover: "hover:border-rose-200 dark:hover:border-rose-500/30",
    nameHover: "group-hover:text-rose-700 dark:group-hover:text-rose-300",
  },
  {
    border: "border-l-sky-500",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    progress: "from-sky-500 to-blue-500",
    hover: "hover:border-sky-200 dark:hover:border-sky-500/30",
    nameHover: "group-hover:text-sky-700 dark:group-hover:text-sky-300",
  },
];

/* -------------------------------------------------------------------------- */
/*  Data fetching                                                             */
/* -------------------------------------------------------------------------- */

async function getProjects(userId: string): Promise<ProjectData[]> {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m) => m.projectId);

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { members: true, tasks: true },
      },
      tasks: {
        where: { status: "done" },
        select: { id: true },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
    description: p.description,
    status: p.status,
    memberCount: p._count.members,
    taskCount: p._count.tasks,
    tasksDone: p.tasks.length,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Project Card Component                                                    */
/* -------------------------------------------------------------------------- */

function ProjectCard({
  project,
  colorIndex,
}: {
  project: ProjectData;
  colorIndex: number;
}) {
  const colors = projectColors[colorIndex % projectColors.length];
  const progress =
    project.taskCount > 0
      ? Math.round((project.tasksDone / project.taskCount) * 100)
      : 0;

  return (
    <Link
      href={`/projects/${project.id}/board`}
      className={`group relative block overflow-hidden rounded-xl border border-l-4 ${colors.border} bg-card p-6 shadow-sm transition-all duration-200 ${colors.hover} hover:shadow-md hover:-translate-y-0.5`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3
              className={`truncate text-lg font-semibold text-foreground transition-colors ${colors.nameHover}`}
            >
              {project.name}
            </h3>
            <Badge
              variant="secondary"
              className={`shrink-0 ${colors.badge} text-[11px] font-mono font-semibold`}
            >
              {project.key}
            </Badge>
          </div>
          {project.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
              {project.description}
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 mt-1.5" />
      </div>

      {/* Stats row */}
      <div className="mt-5 flex items-center gap-5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {project.memberCount} member{project.memberCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <CheckSquare className="h-4 w-4" />
          {project.taskCount} task{project.taskCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-foreground">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.progress} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page Component                                                            */
/* -------------------------------------------------------------------------- */

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const canCreate =
    session.user.role === Role.ADMIN || session.user.role === Role.MANAGER;

  let projects: ProjectData[] = [];
  let fetchError = false;

  try {
    projects = await getProjects(session.user.id);
  } catch {
    fetchError = true;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-dash-fade-up flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="mt-1 text-muted-foreground">
            {projects.length > 0
              ? `You have ${projects.length} project${projects.length !== 1 ? "s" : ""}`
              : "Manage and track all your projects"}
          </p>
        </div>

        {canCreate && (
          <Link href="/projects/new">
            <Button className="h-11 gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 text-white shadow-md shadow-brand-500/25 transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg hover:shadow-brand-500/30">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        )}
      </div>

      {/* Database connection notice */}
      {fetchError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-medium">Database not connected</p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            Projects will appear once the database is configured and running.
          </p>
        </div>
      )}

      {/* Projects Grid */}
      {!fetchError && projects.length > 0 && (
        <div
          className="animate-dash-fade-up grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          style={{ animationDelay: "75ms" }}
        >
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              colorIndex={index}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!fetchError && projects.length === 0 && (
        <div
          className="animate-dash-fade-up flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/25 px-8 py-20 text-center"
          style={{ animationDelay: "75ms" }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-500/20 dark:to-brand-400/20">
            <FolderOpen className="h-8 w-8 text-brand-600 dark:text-brand-400" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">
            No projects yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {canCreate
              ? "Get started by creating your first project. You can set up boards, invite team members, and start tracking work."
              : "You are not a member of any projects yet. Ask an admin or manager to invite you to a project."}
          </p>
          {canCreate && (
            <Link href="/projects/new" className="mt-6">
              <Button className="h-11 gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 text-white shadow-md shadow-brand-500/25 transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-lg hover:shadow-brand-500/30">
                <Plus className="h-4 w-4" />
                Create your first project
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
