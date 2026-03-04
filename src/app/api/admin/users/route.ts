import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).optional().default("MEMBER"),
});

/* -------------------------------------------------------------------------- */
/*  GET /api/admin/users — list all users (Admin only)                        */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
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

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: users, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch users." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/admin/users — create a new user (Admin only)                    */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  try {
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
    const parsed = createUserSchema.safeParse(body);

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

    const { name, email, password, role } = parsed.data;

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          data: null,
          error: "Conflict",
          message: "A user with this email already exists.",
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as Role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { data: user, error: null, message: "User created successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to create user." },
      { status: 500 }
    );
  }
}
