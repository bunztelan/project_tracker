import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskPriority, TaskType } from "@/generated/prisma/client";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["STORY", "BUG", "TASK", "EPIC"]).optional(),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  storyPoints: z.number().int().min(0).optional(),
  dueDate: z.string().optional(),
  parentId: z.string().optional(),
  sprintId: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/tasks — list tasks with filters and pagination     */
/* -------------------------------------------------------------------------- */

export async function GET(
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

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get("status");
    const assignee = searchParams.get("assignee");
    const priority = searchParams.get("priority");
    const sprint = searchParams.get("sprint");
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    // Build where clause
    const where: Record<string, unknown> = { projectId: id };

    if (status) {
      where.status = status;
    }
    if (assignee) {
      where.assigneeId = assignee;
    }
    if (priority && Object.values(TaskPriority).includes(priority as TaskPriority)) {
      where.priority = priority as TaskPriority;
    }
    if (sprint) {
      where.sprintId = sprint;
    }
    if (type && Object.values(TaskType).includes(type as TaskType)) {
      where.type = type as TaskType;
    }
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
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
      }),
      prisma.task.count({ where }),
    ]);

    const data = {
      tasks: tasks.map((task) => ({
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
        columnId: task.columnId,
        assignee: task.assignee,
        reporter: task.reporter,
        subtaskCount: task._count.subtasks,
        parentId: task.parentId,
        sprintId: task.sprintId,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/tasks error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch tasks." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/tasks — create a new task                         */
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
    const parsed = createTaskSchema.safeParse(body);

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

    const {
      title,
      description,
      priority,
      type,
      columnId,
      assigneeId,
      storyPoints,
      dueDate,
      parentId,
      sprintId,
    } = parsed.data;

    // If columnId not provided, assign to first column of the board
    let resolvedColumnId = columnId;
    if (!resolvedColumnId) {
      const board = await prisma.board.findFirst({
        where: { projectId: id },
        include: {
          columns: {
            orderBy: { position: "asc" },
            take: 1,
          },
        },
      });

      if (board && board.columns.length > 0) {
        resolvedColumnId = board.columns[0].id;
      }
    }

    // Determine the next position in the target column
    let position = 0;
    if (resolvedColumnId) {
      const lastTask = await prisma.task.findFirst({
        where: { columnId: resolvedColumnId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = lastTask ? lastTask.position + 1 : 0;
    }

    // Determine status from column name if column exists
    let status = "todo";
    if (resolvedColumnId) {
      const column = await prisma.column.findUnique({
        where: { id: resolvedColumnId },
        select: { name: true },
      });
      if (column) {
        const colNameLower = column.name.toLowerCase();
        if (colNameLower.includes("progress")) {
          status = "in_progress";
        } else if (colNameLower.includes("review")) {
          status = "in_review";
        } else if (colNameLower.includes("done")) {
          status = "done";
        }
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority as TaskPriority | undefined,
        type: type as TaskType | undefined,
        storyPoints,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        position,
        status,
        projectId: id,
        columnId: resolvedColumnId,
        assigneeId,
        reporterId: session.user.id,
        parentId,
        sprintId,
      },
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
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      columnId: task.columnId,
      assignee: task.assignee,
      reporter: task.reporter,
      subtaskCount: task._count.subtasks,
      parentId: task.parentId,
      sprintId: task.sprintId,
    };

    return NextResponse.json(
      { data, error: null, message: "Task created successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/tasks error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to create task." },
      { status: 500 }
    );
  }
}
