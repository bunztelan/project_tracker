import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch invite details (public, for showing invite info before login)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
    include: {
      organization: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!invite) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Invite not found or expired" },
      { status: 404 }
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json(
      { data: null, error: "expired", message: "This invite has expired" },
      { status: 410 }
    );
  }

  return NextResponse.json({
    data: {
      email: invite.email,
      organizationName: invite.organization.name,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    },
    error: null,
    message: "Invite found",
  });
}

// POST: Accept the invite (requires authenticated user)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Please log in to accept this invite" },
      { status: 401 }
    );
  }

  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Invite not found" },
      { status: 404 }
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json(
      { data: null, error: "expired", message: "This invite has expired" },
      { status: 410 }
    );
  }

  // Verify the invite email matches the logged-in user
  if (invite.email !== session.user.email) {
    return NextResponse.json(
      { data: null, error: "email_mismatch", message: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const existing = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: invite.organizationId,
      },
    },
  });

  if (existing) {
    // Already a member — delete invite and return success
    await prisma.pendingInvite.delete({ where: { id: invite.id } });
    return NextResponse.json({
      data: { organizationId: invite.organizationId },
      error: null,
      message: "You are already a member of this organization",
    });
  }

  // Add user to organization and delete invite
  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        userId: session.user.id,
        organizationId: invite.organizationId,
        role: invite.role,
      },
    }),
    prisma.pendingInvite.delete({ where: { id: invite.id } }),
  ]);

  return NextResponse.json({
    data: { organizationId: invite.organizationId },
    error: null,
    message: "Successfully joined the organization",
  });
}
