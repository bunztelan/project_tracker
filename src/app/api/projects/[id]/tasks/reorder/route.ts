import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";
import { statusFromColumnName } from "@/lib/task-constants";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const reorderSchema = z.object({
  taskId: z.string().min(1),
  columnId: z.string().min(1),
  position: z.number().int().min(0),
});

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/tasks/reorder — drag-and-drop reordering          */
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

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);

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

    const { taskId, columnId, position } = parsed.data;

    // Verify the task exists and belongs to this project
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, columnId: true, position: true },
    });

    if (!task || task.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Task not found." },
        { status: 404 }
      );
    }

    // Verify the destination column exists and belongs to a board in this project
    const column = await prisma.column.findUnique({
      where: { id: columnId },
      include: {
        board: {
          select: { projectId: true },
        },
      },
    });

    if (!column || column.board.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Destination column not found." },
        { status: 404 }
      );
    }

    const sourceColumnId = task.columnId;
    const isMovingColumns = sourceColumnId !== columnId;

    // Determine status from column name
    const status = statusFromColumnName(column.name);

    await prisma.$transaction(async (tx) => {
      if (isMovingColumns) {
        // Remove from source column: shift tasks down in source
        if (sourceColumnId) {
          await tx.task.updateMany({
            where: {
              columnId: sourceColumnId,
              position: { gt: task.position },
            },
            data: {
              position: { decrement: 1 },
            },
          });
        }

        // Make room in destination column: shift tasks up from target position
        await tx.task.updateMany({
          where: {
            columnId,
            position: { gte: position },
          },
          data: {
            position: { increment: 1 },
          },
        });
      } else {
        // Same column: reorder
        if (position > task.position) {
          // Moving down: shift items between old and new position up
          await tx.task.updateMany({
            where: {
              columnId,
              position: { gt: task.position, lte: position },
              id: { not: taskId },
            },
            data: {
              position: { decrement: 1 },
            },
          });
        } else if (position < task.position) {
          // Moving up: shift items between new and old position down
          await tx.task.updateMany({
            where: {
              columnId,
              position: { gte: position, lt: task.position },
              id: { not: taskId },
            },
            data: {
              position: { increment: 1 },
            },
          });
        }
      }

      // Update the task itself
      await tx.task.update({
        where: { id: taskId },
        data: {
          columnId,
          position,
          status,
        },
      });
    });

    // Return the updated task
    const updatedTask = await prisma.task.findUnique({
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
        _count: {
          select: { subtasks: true },
        },
      },
    });

    const data = updatedTask
      ? {
          id: updatedTask.id,
          title: updatedTask.title,
          status: updatedTask.status,
          priority: updatedTask.priority,
          type: updatedTask.type,
          position: updatedTask.position,
          columnId: updatedTask.columnId,
          assignee: updatedTask.assignee,
          reporter: updatedTask.reporter,
          subtaskCount: updatedTask._count.subtasks,
        }
      : null;

    return NextResponse.json({ data, error: null, message: "Task reordered successfully." });
  } catch (error) {
    console.error("POST /api/projects/[id]/tasks/reorder error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to reorder task." },
      { status: 500 }
    );
  }
}
