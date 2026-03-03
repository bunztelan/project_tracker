import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
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
/*  GET /api/projects/[id]/dashboards — get project dashboard with widgets    */
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

    // Get or create a default dashboard for the project
    let dashboard = await prisma.dashboard.findFirst({
      where: { projectId: id },
      include: {
        widgets: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!dashboard) {
      dashboard = await prisma.dashboard.create({
        data: {
          name: "Default Dashboard",
          projectId: id,
        },
        include: {
          widgets: {
            orderBy: { position: "asc" },
          },
        },
      });
    }

    return NextResponse.json({ data: dashboard, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/dashboards error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch dashboard." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/dashboards — create a dashboard                  */
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
    const name = body.name || "Dashboard";

    const dashboard = await prisma.dashboard.create({
      data: {
        name,
        projectId: id,
      },
      include: {
        widgets: true,
      },
    });

    return NextResponse.json(
      { data: dashboard, error: null, message: "Dashboard created." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/dashboards error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to create dashboard." },
      { status: 500 }
    );
  }
}
