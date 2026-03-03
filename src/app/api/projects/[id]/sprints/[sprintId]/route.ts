import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SprintStatus } from "@/generated/prisma/client";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const updateSprintSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  goal: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED"]).optional(),
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

async function getSessionAndMembership(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, membership: null };
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
  });

  return { session, membership };
}

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/sprints/[sprintId] — sprint detail with tasks      */
/* -------------------------------------------------------------------------- */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const { id, sprintId } = await params;
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

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        tasks: {
          orderBy: { createdAt: "desc" },
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

    if (!sprint || sprint.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Sprint not found." },
        { status: 404 }
      );
    }

    const completedCount = sprint.tasks.filter(
      (t) => t.status === "done"
    ).length;

    const data = {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      projectId: sprint.projectId,
      createdAt: sprint.createdAt,
      taskCount: sprint.tasks.length,
      completedTaskCount: completedCount,
      tasks: sprint.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        type: task.type,
        storyPoints: task.storyPoints,
        dueDate: task.dueDate,
        assignee: task.assignee,
        sprintId: task.sprintId,
      })),
    };

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/sprints/[sprintId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch sprint." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  PATCH /api/projects/[id]/sprints/[sprintId] — update sprint               */
/* -------------------------------------------------------------------------- */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const { id, sprintId } = await params;
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

    // Only Admin or Manager can update sprints
    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "Only Admins and Managers can update sprints." },
        { status: 403 }
      );
    }

    // Verify the sprint exists and belongs to this project
    const existingSprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, projectId: true, status: true },
    });

    if (!existingSprint || existingSprint.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Sprint not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateSprintSchema.safeParse(body);

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

    const fields = parsed.data;

    // If trying to start a sprint, ensure no other sprint is active
    if (fields.status === "ACTIVE" && existingSprint.status !== SprintStatus.ACTIVE) {
      const activeSprint = await prisma.sprint.findFirst({
        where: {
          projectId: id,
          status: SprintStatus.ACTIVE,
          id: { not: sprintId },
        },
      });

      if (activeSprint) {
        return NextResponse.json(
          {
            data: null,
            error: "Conflict",
            message: "Another sprint is already active. Complete it before starting a new one.",
          },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (fields.name !== undefined) updateData.name = fields.name;
    if (fields.goal !== undefined) updateData.goal = fields.goal;
    if (fields.status !== undefined) updateData.status = fields.status as SprintStatus;
    if (fields.startDate !== undefined) {
      updateData.startDate = fields.startDate ? new Date(fields.startDate) : null;
    }
    if (fields.endDate !== undefined) {
      updateData.endDate = fields.endDate ? new Date(fields.endDate) : null;
    }

    const sprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: updateData,
      include: {
        tasks: {
          select: { id: true, status: true },
        },
      },
    });

    const completedCount = sprint.tasks.filter(
      (t) => t.status === "done"
    ).length;

    const data = {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      projectId: sprint.projectId,
      createdAt: sprint.createdAt,
      taskCount: sprint.tasks.length,
      completedTaskCount: completedCount,
    };

    return NextResponse.json({ data, error: null, message: "Sprint updated successfully." });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/sprints/[sprintId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update sprint." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/projects/[id]/sprints/[sprintId] — delete sprint              */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const { id, sprintId } = await params;
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

    // Only Admin or Manager can delete sprints
    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "Only Admins and Managers can delete sprints." },
        { status: 403 }
      );
    }

    // Verify the sprint exists and belongs to this project
    const existingSprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, projectId: true },
    });

    if (!existingSprint || existingSprint.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Sprint not found." },
        { status: 404 }
      );
    }

    // Unassign all tasks from the sprint before deleting
    await prisma.task.updateMany({
      where: { sprintId },
      data: { sprintId: null },
    });

    await prisma.sprint.delete({ where: { id: sprintId } });

    return NextResponse.json({
      data: null,
      error: null,
      message: "Sprint deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/sprints/[sprintId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete sprint." },
      { status: 500 }
    );
  }
}
