import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { WidgetType } from "@/generated/prisma/enums";
import { getSessionAndMembership } from "@/lib/api-utils";

const VALID_WIDGET_TYPES: WidgetType[] = ["BAR", "LINE", "PIE", "TABLE", "KPI"];

/* -------------------------------------------------------------------------- */
/*  POST /api/projects/[id]/dashboards/widgets — save a new widget            */
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
    const { type, config, title, size } = body;

    // Validate widget type
    if (!type || !VALID_WIDGET_TYPES.includes(type)) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: `Invalid widget type. Must be one of: ${VALID_WIDGET_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!config) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "Widget config is required." },
        { status: 400 }
      );
    }

    // Get or create default dashboard
    let dashboard = await prisma.dashboard.findFirst({
      where: { projectId: id },
    });

    if (!dashboard) {
      dashboard = await prisma.dashboard.create({
        data: {
          name: "Default Dashboard",
          projectId: id,
        },
      });
    }

    // Get next position
    const lastWidget = await prisma.dashboardWidget.findFirst({
      where: { dashboardId: dashboard.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = (lastWidget?.position ?? -1) + 1;

    // Merge title into config if provided
    const widgetConfig = title ? { ...config, title } : config;

    const widget = await prisma.dashboardWidget.create({
      data: {
        type: type as WidgetType,
        config: widgetConfig as Prisma.InputJsonValue,
        position: nextPosition,
        size: size || "medium",
        dashboardId: dashboard.id,
      },
    });

    return NextResponse.json(
      { data: widget, error: null, message: "Widget saved." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/dashboards/widgets error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to save widget." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  PATCH /api/projects/[id]/dashboards/widgets — update a widget             */
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

    const body = await request.json();
    const { widgetId, type, config, position, size } = body;

    if (!widgetId) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "widgetId is required." },
        { status: 400 }
      );
    }

    // Verify widget belongs to this project's dashboard
    const existing = await prisma.dashboardWidget.findUnique({
      where: { id: widgetId },
      include: { dashboard: true },
    });

    if (!existing || existing.dashboard.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Widget not found." },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (type && VALID_WIDGET_TYPES.includes(type)) updateData.type = type;
    if (config) updateData.config = config as Prisma.InputJsonValue;
    if (position != null) updateData.position = position;
    if (size) updateData.size = size;

    const widget = await prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: updateData,
    });

    return NextResponse.json({ data: widget, error: null, message: "Widget updated." });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/dashboards/widgets error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update widget." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  DELETE /api/projects/[id]/dashboards/widgets — delete a widget            */
/* -------------------------------------------------------------------------- */

export async function DELETE(
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
    const widgetId = searchParams.get("widgetId");

    if (!widgetId) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "widgetId query parameter is required." },
        { status: 400 }
      );
    }

    // Verify widget belongs to this project's dashboard
    const existing = await prisma.dashboardWidget.findUnique({
      where: { id: widgetId },
      include: { dashboard: true },
    });

    if (!existing || existing.dashboard.projectId !== id) {
      return NextResponse.json(
        { data: null, error: "Not found", message: "Widget not found." },
        { status: 404 }
      );
    }

    await prisma.dashboardWidget.delete({ where: { id: widgetId } });

    return NextResponse.json({
      data: null,
      error: null,
      message: "Widget deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/dashboards/widgets error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to delete widget." },
      { status: 500 }
    );
  }
}
