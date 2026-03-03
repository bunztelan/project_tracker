import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SprintStatus } from "@/generated/prisma/client";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const createSprintSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
/*  GET /api/projects/[id]/sprints — list sprints for project                 */
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

    const sprints = await prisma.sprint.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { tasks: true },
        },
        tasks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const data = sprints.map((sprint) => {
      const completedCount = sprint.tasks.filter(
        (t) => t.status === "done"
      ).length;
      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
        projectId: sprint.projectId,
        createdAt: sprint.createdAt,
        taskCount: sprint._count.tasks,
        completedTaskCount: completedCount,
      };
    });

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/sprints error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch sprints." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/sprints — create a new sprint (Admin/Manager)     */
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

    // Only Admin or Manager can create sprints
    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "Only Admins and Managers can create sprints." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSprintSchema.safeParse(body);

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

    const { name, goal, startDate, endDate } = parsed.data;

    // Validate end date > start date if both provided
    if (startDate && endDate) {
      if (new Date(endDate) <= new Date(startDate)) {
        return NextResponse.json(
          { data: null, error: "Validation error", message: "End date must be after start date." },
          { status: 400 }
        );
      }
    }

    const sprint = await prisma.sprint.create({
      data: {
        name,
        goal: goal || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: SprintStatus.PLANNING,
        projectId: id,
      },
    });

    const data = {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      projectId: sprint.projectId,
      createdAt: sprint.createdAt,
      taskCount: 0,
      completedTaskCount: 0,
    };

    return NextResponse.json(
      { data, error: null, message: "Sprint created successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/sprints error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to create sprint." },
      { status: 500 }
    );
  }
}
