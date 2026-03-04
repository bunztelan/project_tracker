import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/excel/[uploadId] — return parsed data for upload   */
/* -------------------------------------------------------------------------- */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  try {
    const { id, uploadId } = await params;
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

    const upload = await prisma.excelUpload.findUnique({
      where: { id: uploadId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!upload || upload.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Upload not found." },
        { status: 404 }
      );
    }

    const data = {
      id: upload.id,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      parsedData: upload.parsedData,
      columnMappings: upload.columnMappings,
      createdAt: upload.createdAt,
      uploadedBy: upload.uploadedBy,
    };

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/excel/[uploadId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch upload." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/projects/[id]/excel/[uploadId] — delete an upload             */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  try {
    const { id, uploadId } = await params;
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

    // Only Admin or Manager can delete uploads
    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "Only Admins and Managers can delete uploads." },
        { status: 403 }
      );
    }

    const upload = await prisma.excelUpload.findUnique({
      where: { id: uploadId },
      select: { id: true, projectId: true },
    });

    if (!upload || upload.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Upload not found." },
        { status: 404 }
      );
    }

    await prisma.excelUpload.delete({ where: { id: uploadId } });

    return NextResponse.json({
      data: null,
      error: null,
      message: "Upload deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/excel/[uploadId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete upload." },
      { status: 500 }
    );
  }
}
