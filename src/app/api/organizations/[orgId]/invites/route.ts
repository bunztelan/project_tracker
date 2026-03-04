import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays } from "date-fns";

const createInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  // Verify user is OWNER or ADMIN in this org
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: orgId,
      },
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json(
      { data: null, error: "forbidden", message: "Only org admins can view invites" },
      { status: 403 }
    );
  }

  const invites = await prisma.pendingInvite.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: invites,
    error: null,
    message: "Invites retrieved",
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  // Verify user is OWNER or ADMIN in this org
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: orgId,
      },
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json(
      { data: null, error: "forbidden", message: "Only org admins can create invites" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "validation", message: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: orgId,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { data: null, error: "conflict", message: "User is already a member of this organization" },
        { status: 409 }
      );
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.pendingInvite.findFirst({
    where: { email, organizationId: orgId },
  });

  if (existingInvite) {
    return NextResponse.json(
      { data: null, error: "conflict", message: "An invite has already been sent to this email" },
      { status: 409 }
    );
  }

  const invite = await prisma.pendingInvite.create({
    data: {
      email,
      organizationId: orgId,
      role: role as "ADMIN" | "MEMBER",
      expiresAt: addDays(new Date(), 7),
    },
  });

  return NextResponse.json(
    { data: invite, error: null, message: "Invite created" },
    { status: 201 }
  );
}
