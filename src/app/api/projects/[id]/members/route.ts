import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).optional().default("MEMBER"),
});

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/members — list members with user details           */
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

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
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
      orderBy: { createdAt: "asc" },
    });

    const data = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
    }));

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/members error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch members." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/members — add a member (Admin/Manager only)       */
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

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Only Admin and Manager roles can add members.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = addMemberSchema.safeParse(body);

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

    const { email, role } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, avatar: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "No user found with that email address." },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existing = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { data: null, error: "Conflict", message: "This user is already a member of the project." },
        { status: 409 }
      );
    }

    const member = await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: id,
        role: role as Role,
      },
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
    });

    const data = {
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      user: member.user,
    };

    return NextResponse.json(
      { data, error: null, message: "Member added successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/members error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to add member." },
      { status: 500 }
    );
  }
}
