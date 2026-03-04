import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> }
) {
  const { orgId, inviteId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: "Not authenticated" },
      { status: 401 }
    );
  }

  // Verify user is OWNER or ADMIN
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
      { data: null, error: "forbidden", message: "Only org admins can delete invites" },
      { status: 403 }
    );
  }

  await prisma.pendingInvite.delete({
    where: { id: inviteId },
  });

  return NextResponse.json({
    data: null,
    error: null,
    message: "Invite deleted",
  });
}
