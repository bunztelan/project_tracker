import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

const createSubtaskSchema = z.object({
  title: z.string().min(1).max(500),
  assigneeId: z.string().optional().nullable(),
});

/* GET /api/projects/[id]/tasks/[taskId]/subtasks */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
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

    // Verify task belongs to project
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    const subtasks = await prisma.subtask.findMany({
      where: { taskId },
      orderBy: { position: "asc" },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ data: subtasks, error: null, message: "OK" });
  } catch (error) {
    console.error("GET subtasks error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch subtasks." },
      { status: 500 }
    );
  }
}

/* POST /api/projects/[id]/tasks/[taskId]/subtasks */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
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

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createSubtaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    // Get max position for this task's subtasks
    const maxPos = await prisma.subtask.aggregate({
      where: { taskId },
      _max: { position: true },
    });

    const subtask = await prisma.subtask.create({
      data: {
        title: parsed.data.title,
        assigneeId: parsed.data.assigneeId || null,
        taskId,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json(
      { data: subtask, error: null, message: "Subtask created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST subtask error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to create subtask." },
      { status: 500 }
    );
  }
}
