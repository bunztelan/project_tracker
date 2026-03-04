import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/board — board with columns and tasks               */
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

    // Find the first board for this project (projects have one main board)
    const board = await prisma.board.findFirst({
      where: { projectId: id },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
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
                reporter: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                  },
                },
                _count: {
                  select: {
                    subtasks: true,
                    comments: true,
                    attachments: true,
                  },
                },
                subtasks: {
                  select: { status: true },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "No board found for this project." },
        { status: 404 }
      );
    }

    // Shape the response for clarity
    const data = {
      id: board.id,
      name: board.name,
      projectId: board.projectId,
      createdAt: board.createdAt,
      columns: board.columns.map((col) => ({
        id: col.id,
        name: col.name,
        position: col.position,
        tasks: col.tasks.map((task) => {
          const completedCount = task.subtasks.filter(
            (s: { status: string }) => s.status === "done"
          ).length;

          return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            type: task.type,
            storyPoints: task.storyPoints,
            position: task.position,
            dueDate: task.dueDate,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            assignee: task.assignee,
            reporter: task.reporter,
            subtaskCount: task._count.subtasks,
            commentCount: task._count.comments,
            attachmentCount: task._count.attachments,
            totalSubtasks: task._count.subtasks,
            completedSubtasks: completedCount,
            subtaskProgress: task._count.subtasks > 0
              ? Math.round((completedCount / task._count.subtasks) * 100)
              : 0,
            parentId: task.parentId,
            sprintId: task.sprintId,
          };
        }),
      })),
    };

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/board error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch board." },
      { status: 500 }
    );
  }
}
