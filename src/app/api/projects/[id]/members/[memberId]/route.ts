import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]),
});

/* -------------------------------------------------------------------------- */
/*  PATCH /api/projects/[id]/members/[memberId] — update member role          */
/* -------------------------------------------------------------------------- */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const { session, membership } = await getSessionAndMembership(id);

    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "You are not a member of this project." },
        { status: 403 }
      );
    }

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Only Admin and Manager roles can update member roles.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "Validation error",
          message: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    // Verify the target member exists and belongs to this project
    const targetMember = await prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { project: { select: { ownerId: true } } },
    });

    if (!targetMember || targetMember.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Member not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: parsed.data.role as Role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    const data = {
      id: updated.id,
      userId: updated.userId,
      role: updated.role,
      createdAt: updated.createdAt,
      user: updated.user,
    };

    return NextResponse.json({
      data,
      error: null,
      message: "Member role updated successfully.",
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/members/[memberId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update member." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/projects/[id]/members/[memberId] — remove member              */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const { session, membership } = await getSessionAndMembership(id);

    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "You are not a member of this project." },
        { status: 403 }
      );
    }

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Only Admin and Manager roles can remove members.",
        },
        { status: 403 }
      );
    }

    // Verify the target member exists and belongs to this project
    const targetMember = await prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { project: { select: { ownerId: true } } },
    });

    if (!targetMember || targetMember.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Member not found." },
        { status: 404 }
      );
    }

    // Cannot remove the project owner
    if (targetMember.userId === targetMember.project.ownerId) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Cannot remove the project owner from the project.",
        },
        { status: 403 }
      );
    }

    await prisma.projectMember.delete({ where: { id: memberId } });

    return NextResponse.json({
      data: null,
      error: null,
      message: "Member removed successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/members/[memberId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to remove member." },
      { status: 500 }
    );
  }
}
