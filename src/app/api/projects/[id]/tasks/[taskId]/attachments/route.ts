import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToBlob } from "@/lib/blob";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "csv", "txt", "png", "jpg", "jpeg", "gif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/tasks/[taskId]/attachments                         */
/* -------------------------------------------------------------------------- */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
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

    // List standalone task attachments (not linked to a comment)
    const attachments = await prisma.attachment.findMany({
      where: { taskId, commentId: null },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ data: attachments, error: null });
  } catch (error) {
    console.error("GET attachments error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/tasks/[taskId]/attachments                        */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
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

    // Verify task belongs to project
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Task not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { data: null, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { data: null, error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { data: null, error: "File too large. Maximum is 10 MB." },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `attachments/${id}/${taskId}/${safeFileName}`;
    const { url } = await uploadToBlob(file, pathname);

    // Create DB record
    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        filePath: url,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        taskId,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return NextResponse.json(
      { data: attachment, error: null },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST attachment error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
