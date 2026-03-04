import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          plan: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    logo: m.organization.logo,
    plan: m.organization.plan,
    role: m.role,
  }));

  return NextResponse.json({
    data: organizations,
    error: null,
    message: "Organizations retrieved",
  });
}
