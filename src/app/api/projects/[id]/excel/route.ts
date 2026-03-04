import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseExcelBuffer } from "@/lib/excel";
import type { Prisma } from "@/generated/prisma/client";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
  "application/csv",
];

function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/excel — upload and parse an Excel/CSV file        */
/* -------------------------------------------------------------------------- */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    /* ---- Parse multipart form data ---- */
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "No file provided. Use the 'file' form field." },
        { status: 400 }
      );
    }

    /* ---- Validate file name / extension ---- */
    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json(
        {
          data: null,
          error: "Validation error",
          message: `Invalid file type. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    /* ---- Validate MIME type (best-effort) ---- */
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type) && file.type !== "application/octet-stream") {
      return NextResponse.json(
        {
          data: null,
          error: "Validation error",
          message: `Invalid MIME type: ${file.type}. Upload an .xlsx, .xls, or .csv file.`,
        },
        { status: 400 }
      );
    }

    /* ---- Validate file size ---- */
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          data: null,
          error: "Validation error",
          message: `File too large. Maximum size is 10 MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
        },
        { status: 400 }
      );
    }

    /* ---- Read buffer and parse ---- */
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsedData;
    try {
      parsedData = parseExcelBuffer(buffer);
    } catch {
      return NextResponse.json(
        { data: null, error: "Parse error", message: "Failed to parse the uploaded file. Ensure it is a valid Excel or CSV file." },
        { status: 400 }
      );
    }

    /* ---- Persist to database ---- */
    const upload = await prisma.excelUpload.create({
      data: {
        fileName: file.name,
        fileSize: file.size,
        parsedData: parsedData as unknown as Prisma.InputJsonValue,
        columnMappings: undefined,
        uploadedById: session.user.id,
        projectId: id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const data = {
      id: upload.id,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      sheetNames: parsedData.sheetNames,
      createdAt: upload.createdAt,
      uploadedBy: upload.uploadedBy,
    };

    return NextResponse.json(
      { data, error: null, message: "File uploaded and parsed successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/excel error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to upload file." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/excel — list all uploads for the project           */
/* -------------------------------------------------------------------------- */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const uploads = await prisma.excelUpload.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: uploads, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/excel error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch uploads." },
      { status: 500 }
    );
  }
}
