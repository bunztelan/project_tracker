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
/*  DELETE /api/projects/[id]/tasks/[taskId]/attachments/[attachmentId]        */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; taskId: string; attachmentId: string }>;
  }
) {
  try {
    const { id, taskId, attachmentId } = await params;
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

    // Find attachment
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.taskId !== taskId) {
      return NextResponse.json(
        { data: null, error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Only uploader or ADMIN/MANAGER can delete
    const canDelete =
      attachment.uploadedById === session.user.id ||
      membership.role === "ADMIN" ||
      membership.role === "MANAGER";

    if (!canDelete) {
      return NextResponse.json(
        { data: null, error: "Not authorized to delete this attachment" },
        { status: 403 }
      );
    }

    // Delete file from disk
    const absPath = path.join(process.cwd(), "uploads", attachment.filePath);
    if (existsSync(absPath)) {
      await unlink(absPath);
    }

    // Delete DB record
    await prisma.attachment.delete({ where: { id: attachmentId } });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("DELETE attachment error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
