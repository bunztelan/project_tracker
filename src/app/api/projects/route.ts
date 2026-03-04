import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  key: z.string().min(2).max(10).toUpperCase(),
});

/* -------------------------------------------------------------------------- */
/*  GET /api/projects — list all projects the user is a member of             */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }

    // Find all project IDs the user is a member of
    const memberships = await prisma.projectMember.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });
    const projectIds = memberships.map((m) => m.projectId);

    // Fetch projects with member count & task count (scoped by active org)
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        ...(session.user.activeOrganizationId
          ? { organizationId: session.user.activeOrganizationId }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { members: true, tasks: true },
        },
        tasks: {
          where: { status: "done" },
          select: { id: true },
        },
      },
    });

    // Map to include tasksDone count, strip raw tasks array
    const data = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      key: p.key,
      status: p.status,
      ownerId: p.ownerId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      memberCount: p._count.members,
      taskCount: p._count.tasks,
      tasksDone: p.tasks.length,
    }));

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch projects." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects — create a new project (Admin/Manager only)            */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }

    // Require active organization
    if (!session.user.activeOrganizationId) {
      return NextResponse.json(
        { data: null, error: "no_organization", message: "No active organization" },
        { status: 400 }
      );
    }

    // Role gate — only Admin & Manager can create projects
    if (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Only Admin and Manager roles can create projects.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

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

    const { name, description, key } = parsed.data;

    // Check for duplicate key
    const existing = await prisma.project.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json(
        {
          data: null,
          error: "Conflict",
          message: `A project with the key "${key}" already exists.`,
        },
        { status: 409 }
      );
    }

    // Create project with all defaults in a transaction
    const project = await prisma.$transaction(async (tx) => {
      // 1. Create the project
      const newProject = await tx.project.create({
        data: {
          name,
          description,
          key,
          ownerId: session.user.id,
          organizationId: session.user.activeOrganizationId!,
        },
      });

      // 2. Add creator as a project member
      await tx.projectMember.create({
        data: {
          userId: session.user.id,
          projectId: newProject.id,
          role: session.user.role,
        },
      });

      // 3. Create default board with 4 columns
      const board = await tx.board.create({
        data: {
          name: "Main Board",
          projectId: newProject.id,
        },
      });

      await tx.column.createMany({
        data: [
          { name: "To Do", position: 0, boardId: board.id, statusKey: "todo" },
          { name: "In Progress", position: 1, boardId: board.id, statusKey: "in_progress" },
          { name: "In Review", position: 2, boardId: board.id, statusKey: "in_review" },
          { name: "Done", position: 3, boardId: board.id, statusKey: "done" },
        ],
      });

      // 4. Create default feature toggles
      await tx.featureToggle.createMany({
        data: [
          { featureKey: "kanban_board", enabled: true, description: "Kanban board view", projectId: newProject.id },
          { featureKey: "backlog", enabled: true, description: "Backlog management", projectId: newProject.id },
          { featureKey: "sprint_planning", enabled: false, description: "Sprint planning", projectId: newProject.id },
          { featureKey: "gantt_timeline", enabled: false, description: "Gantt timeline view", projectId: newProject.id },
          { featureKey: "reports", enabled: true, description: "Project reports", projectId: newProject.id },
          { featureKey: "excel_visualization", enabled: true, description: "Excel data visualization", projectId: newProject.id },
        ],
      });

      // 5. Create default dashboard
      await tx.dashboard.create({
        data: {
          name: "Project Dashboard",
          projectId: newProject.id,
        },
      });

      return newProject;
    });

    return NextResponse.json(
      {
        data: project,
        error: null,
        message: "Project created successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to create project." },
      { status: 500 }
    );
  }
}
