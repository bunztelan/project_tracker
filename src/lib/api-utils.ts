import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

export async function getSessionAndMembership(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, membership: null };
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
  });

  return { session, membership };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: "Unauthorized" as const };
  }
  if (session.user.role !== Role.ADMIN) {
    return { session: null, error: "Forbidden" as const };
  }
  return { session, error: null };
}

/**
 * Get session with active organization context.
 * Returns null session if user is not authenticated or has no active org.
 */
export async function getSessionWithOrg() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, organizationId: null };
  }

  const organizationId = session.user.activeOrganizationId;
  if (!organizationId) {
    return { session, organizationId: null };
  }

  return { session, organizationId };
}

/**
 * Verify the project belongs to the user's active organization.
 * Returns session, membership, and organizationId if valid.
 */
export async function getSessionMembershipAndOrg(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, membership: null, organizationId: null };
  }

  const organizationId = session.user.activeOrganizationId;
  if (!organizationId) {
    return { session, membership: null, organizationId: null };
  }

  // Verify project belongs to the active org AND user is a project member
  const [project, membership] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    }),
    prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
    }),
  ]);

  if (!project) {
    return { session, membership: null, organizationId };
  }

  return { session, membership, organizationId };
}
