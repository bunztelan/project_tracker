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
/*  GET /api/projects/[id]/tasks/[taskId]/comments                            */
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

    const comments = await prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          include: {
            uploadedBy: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: comments, error: null });
  } catch (error) {
    console.error("GET comments error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/tasks/[taskId]/comments                           */
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
    const body = (formData.get("body") as string)?.trim();

    // Collect files from formData
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (!body && files.length === 0) {
      return NextResponse.json(
        { data: null, error: "Comment must have text or at least one file" },
        { status: 400 }
      );
    }

    // Validate all files first
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { data: null, error: `File type not allowed: ${file.name}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { data: null, error: `File too large: ${file.name}. Maximum is 10 MB.` },
          { status: 400 }
        );
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        body: body || "",
        taskId,
        authorId: session.user.id,
      },
    });

    // Upload files to Vercel Blob and create attachment records
    const attachmentData = [];
    for (const file of files) {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const pathname = `attachments/${id}/${taskId}/${safeFileName}`;
      const { url } = await uploadToBlob(file, pathname);

      attachmentData.push({
        fileName: file.name,
        filePath: url,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        taskId,
        commentId: comment.id,
        uploadedById: session.user.id,
      });
    }

    if (attachmentData.length > 0) {
      await prisma.attachment.createMany({ data: attachmentData });
    }

    // Re-fetch with relations
    const result = await prisma.comment.findUnique({
      where: { id: comment.id },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          include: {
            uploadedBy: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    return NextResponse.json(
      { data: result, error: null },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST comment error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
