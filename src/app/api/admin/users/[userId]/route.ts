import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).optional(),
});

/* -------------------------------------------------------------------------- */
/*  PATCH /api/admin/users/[userId] — update user role or name (Admin only)   */
/* -------------------------------------------------------------------------- */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { session, error } = await requireAdmin();

    if (error === "Unauthorized") {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }

    if (error === "Forbidden" || !session) {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

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

    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "User not found." },
        { status: 404 }
      );
    }

    const updateData: { name?: string; role?: Role } = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.role) updateData.role = parsed.data.role as Role;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: updatedUser,
      error: null,
      message: "User updated successfully.",
    });
  } catch (error) {
    console.error("PATCH /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update user." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/admin/users/[userId] — delete user (Admin only)               */
/* -------------------------------------------------------------------------- */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { session, error } = await requireAdmin();

    if (error === "Unauthorized") {
      return NextResponse.json(
        { data: null, error: "Unauthorized", message: "You must be signed in." },
        { status: 401 }
      );
    }

    if (error === "Forbidden" || !session) {
      return NextResponse.json(
        { data: null, error: "Forbidden", message: "Admin access required." },
        { status: 403 }
      );
    }

    // Can't delete yourself
    if (userId === session.user.id) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "You cannot delete your own account.",
        },
        { status: 403 }
      );
    }

    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "User not found." },
        { status: 404 }
      );
    }

    // Prevent deleting if user owns projects
    const ownedProjects = await prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true },
    });

    if (ownedProjects.length > 0) {
      const projectNames = ownedProjects.map((p) => p.name).join(", ");
      return NextResponse.json(
        {
          data: null,
          error: "Conflict",
          message: `Cannot delete user. They own ${ownedProjects.length} project(s): ${projectNames}. Transfer ownership first.`,
        },
        { status: 409 }
      );
    }

    // Delete user (cascading deletes will handle project memberships)
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      data: null,
      error: null,
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete user." },
      { status: 500 }
    );
  }
}
