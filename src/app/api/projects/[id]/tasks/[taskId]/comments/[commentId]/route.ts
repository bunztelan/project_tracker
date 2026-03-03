import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function getSessionAndMembership(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { session: null, membership: null };

  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId: session.user.id, projectId },
    },
  });

  return { session, membership };
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/projects/[id]/tasks/[taskId]/comments/[commentId]             */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; taskId: string; commentId: string }>;
  }
) {
  try {
    const { id, taskId, commentId } = await params;
    const { session, membership } = await getSessionAndMembership(id);

    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (!membership) {
      return NextResponse.json(
        { data: null, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Find comment with its attachments
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { attachments: true },
    });

    if (!comment || comment.taskId !== taskId) {
      return NextResponse.json(
        { data: null, error: "Comment not found" },
        { status: 404 }
      );
    }

    // Only author or ADMIN/MANAGER can delete
    const canDelete =
      comment.authorId === session.user.id ||
      membership.role === "ADMIN" ||
      membership.role === "MANAGER";

    if (!canDelete) {
      return NextResponse.json(
        { data: null, error: "Not authorized to delete this comment" },
        { status: 403 }
      );
    }

    // Delete attachment files from disk
    for (const att of comment.attachments) {
      const absPath = path.join(process.cwd(), "uploads", att.filePath);
      if (existsSync(absPath)) {
        await unlink(absPath);
      }
    }

    // Delete comment (cascades to attachments via Prisma)
    await prisma.comment.delete({ where: { id: commentId } });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("DELETE comment error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
