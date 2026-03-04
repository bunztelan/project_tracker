import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";

/* -------------------------------------------------------------------------- */
/*  Settings page — server component that fetches project, features, members  */
/* -------------------------------------------------------------------------- */

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
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

  // Fetch project details
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      key: true,
      ownerId: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Fetch feature toggles
  const featureToggles = await prisma.featureToggle.findMany({
    where: { projectId: id },
    orderBy: { featureKey: "asc" },
  });

  const features = featureToggles.map((t) => ({
    id: t.id,
    featureKey: t.featureKey,
    enabled: t.enabled,
    description: t.description,
  }));

  // Fetch members with user details
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
    orderBy: { createdAt: "asc" },
  });

  const members = projectMembers.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    user: m.user,
  }));

  const isAdminOrManager =
    membership.role === "ADMIN" || membership.role === "MANAGER";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Settings header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage project configuration, features, and team members
          </p>
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        <SettingsClient
          project={project}
          features={features}
          members={members}
          isAdminOrManager={isAdminOrManager}
          currentUserId={session.user.id}
          activeOrganizationId={session.user.activeOrganizationId ?? null}
        />
      </div>
    </div>
  );
}
