import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id] — project details with members, toggles, counts    */
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

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
        featureToggles: true,
        _count: {
          select: {
            tasks: true,
            sprints: true,
            boards: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Project not found." },
        { status: 404 }
      );
    }

    // Compute task status counts
    const taskCounts = await prisma.task.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: { status: true },
    });

    const tasksByStatus = Object.fromEntries(
      taskCounts.map((tc) => [tc.status, tc._count.status])
    );

    const data = {
      id: project.id,
      name: project.name,
      description: project.description,
      key: project.key,
      status: project.status,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      members: project.members.map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        user: m.user,
      })),
      featureToggles: Object.fromEntries(
        project.featureToggles.map((ft) => [ft.featureKey, ft.enabled])
      ),
      counts: {
        tasks: project._count.tasks,
        sprints: project._count.sprints,
        boards: project._count.boards,
        tasksByStatus,
      },
    };

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch project." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  PATCH /api/projects/[id] — update project (Admin/Manager only)            */
/* -------------------------------------------------------------------------- */

export async function PATCH(
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

    // Only Admin and Manager roles for the project can update
    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Only Admin and Manager roles can update project details.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

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

    const project = await prisma.project.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({
      data: project,
      error: null,
      message: "Project updated successfully.",
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update project." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/projects/[id] — delete project (Admin only)                   */
/* -------------------------------------------------------------------------- */

export async function DELETE(
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

    // Only Admin can delete projects
    if (membership.role !== Role.ADMIN) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Only Admin role can delete projects.",
        },
        { status: 403 }
      );
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({
      data: null,
      error: null,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete project." },
      { status: 500 }
    );
  }
}
