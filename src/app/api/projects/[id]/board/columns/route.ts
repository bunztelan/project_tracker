import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionAndMembership } from "@/lib/api-utils";
import { MAX_COLUMNS, MIN_COLUMNS } from "@/lib/task-constants";

/* -------------------------------------------------------------------------- */
/*  Validation schemas                                                        */
/* -------------------------------------------------------------------------- */

const renameSchema = z.object({
  action: z.literal("rename"),
  columnId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(30, "Name must be 30 characters or less"),
});

const addSchema = z.object({
  action: z.literal("add"),
  name: z.string().min(1).max(30).default("New Column"),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  columnId: z.string().min(1),
});

const actionSchema = z.discriminatedUnion("action", [
  renameSchema,
  addSchema,
  deleteSchema,
]);

/* -------------------------------------------------------------------------- */
/*  PATCH /api/projects/[id]/board/columns                                    */
/* -------------------------------------------------------------------------- */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { session, membership } = await getSessionAndMembership(projectId);

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

    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "Only admins and managers can modify board columns." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    // Find the board for this project
    const board = await prisma.board.findFirst({
      where: { projectId },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: { _count: { select: { tasks: true } } },
        },
      },
    });

    if (!board) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "No board found for this project." },
        { status: 404 }
      );
    }

    const data = parsed.data;

    /* ---------------------------------------------------------------------- */
    /*  RENAME                                                                */
    /* ---------------------------------------------------------------------- */
    if (data.action === "rename") {
      const column = board.columns.find((c) => c.id === data.columnId);
      if (!column) {
        return NextResponse.json(
          { data: null, error: "Not found", message: "Column not found." },
          { status: 404 }
        );
      }

      const updated = await prisma.column.update({
        where: { id: data.columnId },
        data: { name: data.name },
      });

      return NextResponse.json({
        data: { id: updated.id, name: updated.name, position: updated.position },
        error: null,
        message: "Column renamed.",
      });
    }

    /* ---------------------------------------------------------------------- */
    /*  ADD                                                                   */
    /* ---------------------------------------------------------------------- */
    if (data.action === "add") {
      if (board.columns.length >= MAX_COLUMNS) {
        return NextResponse.json(
          { data: null, error: "Limit reached", message: `Maximum of ${MAX_COLUMNS} columns allowed.` },
          { status: 400 }
        );
      }

      const nextPosition = board.columns.length > 0
        ? Math.max(...board.columns.map((c) => c.position)) + 1
        : 0;

      const created = await prisma.column.create({
        data: {
          name: data.name,
          position: nextPosition,
          boardId: board.id,
        },
      });

      return NextResponse.json({
        data: { id: created.id, name: created.name, position: created.position },
        error: null,
        message: "Column added.",
      });
    }

    /* ---------------------------------------------------------------------- */
    /*  DELETE                                                                */
    /* ---------------------------------------------------------------------- */
    if (data.action === "delete") {
      if (board.columns.length <= MIN_COLUMNS) {
        return NextResponse.json(
          { data: null, error: "Limit reached", message: `Minimum of ${MIN_COLUMNS} columns required.` },
          { status: 400 }
        );
      }

      const column = board.columns.find((c) => c.id === data.columnId);
      if (!column) {
        return NextResponse.json(
          { data: null, error: "Not found", message: "Column not found." },
          { status: 404 }
        );
      }

      if (column._count.tasks > 0) {
        return NextResponse.json(
          { data: null, error: "Column not empty", message: "Cannot delete a column that has tasks. Move or delete the tasks first." },
          { status: 400 }
        );
      }

      await prisma.column.delete({ where: { id: data.columnId } });

      // Recalculate positions for remaining columns
      const remaining = board.columns
        .filter((c) => c.id !== data.columnId)
        .sort((a, b) => a.position - b.position);

      await Promise.all(
        remaining.map((col, idx) =>
          prisma.column.update({
            where: { id: col.id },
            data: { position: idx },
          })
        )
      );

      return NextResponse.json({
        data: null,
        error: null,
        message: "Column deleted.",
      });
    }

    // Should not reach here due to discriminated union
    return NextResponse.json(
      { data: null, error: "Invalid action", message: "Unknown action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH /api/projects/[id]/board/columns error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update columns." },
      { status: 500 }
    );
  }
}
