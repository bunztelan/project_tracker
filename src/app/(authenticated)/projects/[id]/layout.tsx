import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectFeatures } from "@/lib/features";
import { ProjectProvider } from "@/contexts/project-context";
import { SyncFeatures } from "@/components/layout/sync-features";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    notFound();
  }

  // Fetch project and verify membership in parallel
  const [project, membership] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        key: true,
        description: true,
      },
    }),
    prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: id,
        },
      },
    }),
  ]);

  if (!project || !membership) {
    notFound();
  }

  const features = await getProjectFeatures(project.id);

  return (
    <ProjectProvider
      value={{
        project: {
          id: project.id,
          name: project.name,
          key: project.key,
          description: project.description,
        },
        features,
      }}
    >
      <SyncFeatures features={features} />
      {/* Project sub-header */}
      <div className="border-b bg-muted/30 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
            {project.key.slice(0, 3)}
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">
              {project.name}
            </h2>
            {project.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {project.description}
              </p>
            )}
          </div>
        </div>
      </div>
      {children}
    </ProjectProvider>
  );
}
