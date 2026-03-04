import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

type RouteParams = { params: Promise<{ id: string; taskId: string; subtaskId: string }> };

async function authorize(id: string) {
  const { session, membership } = await getSessionAndMembership(id);
  if (!session?.user) return { ok: false as const, status: 401, message: "You must be signed in." };
  if (!membership) return { ok: false as const, status: 403, message: "You are not a member of this project." };
  return { ok: true as const };
}

/* PATCH /api/projects/[id]/tasks/[taskId]/subtasks/[subtaskId] */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, taskId, subtaskId } = await params;
    const auth = await authorize(id);
    if (!auth.ok) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: auth.message },
        { status: auth.status }
      );
    }

    const existing = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      select: { id: true, taskId: true, task: { select: { projectId: true } } },
    });
    if (!existing || existing.taskId !== taskId || existing.task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Subtask not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateSubtaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.completed !== undefined) updateData.completed = parsed.data.completed;
    if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId;
    if (parsed.data.position !== undefined) updateData.position = parsed.data.position;

    const subtask = await prisma.subtask.update({
      where: { id: subtaskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ data: subtask, error: null, message: "Subtask updated." });
  } catch (error) {
    console.error("PATCH subtask error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update subtask." },
      { status: 500 }
    );
  }
}

/* DELETE /api/projects/[id]/tasks/[taskId]/subtasks/[subtaskId] */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, taskId, subtaskId } = await params;
    const auth = await authorize(id);
    if (!auth.ok) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: auth.message },
        { status: auth.status }
      );
    }

    const existing = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      select: { id: true, taskId: true, task: { select: { projectId: true } } },
    });
    if (!existing || existing.taskId !== taskId || existing.task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Subtask not found." },
        { status: 404 }
      );
    }

    await prisma.subtask.delete({ where: { id: subtaskId } });

    return NextResponse.json({ data: null, error: null, message: "Subtask deleted." });
  } catch (error) {
    console.error("DELETE subtask error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete subtask." },
      { status: 500 }
    );
  }
}
