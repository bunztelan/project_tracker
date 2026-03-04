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
