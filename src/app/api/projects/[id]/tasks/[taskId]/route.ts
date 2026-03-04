import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskPriority, TaskType } from "@/generated/prisma/client";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["STORY", "BUG", "TASK", "EPIC"]).optional(),
  status: z.string().optional(),
  columnId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  storyPoints: z.number().int().min(0).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/tasks/[taskId] — task detail                       */
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
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        checklistItems: {
          orderBy: { position: "asc" },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    const data = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      storyPoints: task.storyPoints,
      position: task.position,
      dueDate: task.dueDate,
      startDate: task.startDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      columnId: task.columnId,
      assignee: task.assignee,
      reporter: task.reporter,
      parentId: task.parentId,
      sprintId: task.sprintId,
      subtasks: task.checklistItems.map((st) => ({
        id: st.id,
        title: st.title,
        completed: st.completed,
        position: st.position,
        assignee: st.assignee,
        assigneeId: st.assigneeId,
      })),
    };

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/tasks/[taskId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch task." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  PATCH /api/projects/[id]/tasks/[taskId] — update task                     */
/* -------------------------------------------------------------------------- */

export async function PATCH(
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

    // Verify the task exists and belongs to this project
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });

    if (!existingTask || existingTask.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

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

    // Build the update data, only including fields that were provided
    const updateData: Record<string, unknown> = {};
    const fields = parsed.data;

    if (fields.title !== undefined) updateData.title = fields.title;
    if (fields.description !== undefined) updateData.description = fields.description;
    if (fields.status !== undefined) updateData.status = fields.status;
    if (fields.priority !== undefined) updateData.priority = fields.priority as TaskPriority;
    if (fields.type !== undefined) updateData.type = fields.type as TaskType;
    if (fields.columnId !== undefined) updateData.columnId = fields.columnId;
    if (fields.assigneeId !== undefined) updateData.assigneeId = fields.assigneeId;
    if (fields.storyPoints !== undefined) updateData.storyPoints = fields.storyPoints;
    if (fields.position !== undefined) updateData.position = fields.position;
    if (fields.parentId !== undefined) updateData.parentId = fields.parentId;
    if (fields.sprintId !== undefined) updateData.sprintId = fields.sprintId;
    if (fields.dueDate !== undefined) {
      updateData.dueDate = fields.dueDate ? new Date(fields.dueDate) : null;
    }
    if (fields.startDate !== undefined) {
      updateData.startDate = fields.startDate ? new Date(fields.startDate) : null;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: { checklistItems: true },
        },
      },
    });

    const data = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      storyPoints: task.storyPoints,
      position: task.position,
      dueDate: task.dueDate,
      startDate: task.startDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      columnId: task.columnId,
      assignee: task.assignee,
      reporter: task.reporter,
      subtaskCount: task._count.checklistItems,
      parentId: task.parentId,
      sprintId: task.sprintId,
    };

    return NextResponse.json({ data, error: null, message: "Task updated successfully." });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/tasks/[taskId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update task." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/projects/[id]/tasks/[taskId] — delete task                    */
/* -------------------------------------------------------------------------- */

export async function DELETE(
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

    // Verify the task exists and belongs to this project
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });

    if (!existingTask || existingTask.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    await prisma.task.delete({ where: { id: taskId } });

    return NextResponse.json({
      data: null,
      error: null,
      message: "Task deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/tasks/[taskId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete task." },
      { status: 500 }
    );
  }
}
