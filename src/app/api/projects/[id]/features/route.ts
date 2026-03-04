import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { z } from "zod";
import { getSessionAndMembership } from "@/lib/api-utils";

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const updateFeaturesSchema = z.array(
  z.object({
    featureKey: z.string().min(1),
    enabled: z.boolean(),
  })
);

/* -------------------------------------------------------------------------- */
/*  GET /api/projects/[id]/features — list feature toggles                    */
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

    const toggles = await prisma.featureToggle.findMany({
      where: { projectId: id },
      orderBy: { featureKey: "asc" },
    });

    const data = toggles.map((t) => ({
      id: t.id,
      featureKey: t.featureKey,
      enabled: t.enabled,
      description: t.description,
    }));

    return NextResponse.json({ data, error: null, message: "OK" });
  } catch (error) {
    console.error("GET /api/projects/[id]/features error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to fetch features." },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  PATCH /api/projects/[id]/features — update feature toggles                */
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

    if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) {
      return NextResponse.json(
        {
          data: null,
          error: "Forbidden",
          message: "Only Admin and Manager roles can update feature toggles.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateFeaturesSchema.safeParse(body);

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

    // Upsert each feature toggle
    const results = await Promise.all(
      parsed.data.map((toggle) =>
        prisma.featureToggle.upsert({
          where: {
            featureKey_projectId: {
              featureKey: toggle.featureKey,
              projectId: id,
            },
          },
          update: { enabled: toggle.enabled },
          create: {
            featureKey: toggle.featureKey,
            enabled: toggle.enabled,
            projectId: id,
          },
        })
      )
    );

    const data = results.map((t) => ({
      id: t.id,
      featureKey: t.featureKey,
      enabled: t.enabled,
      description: t.description,
    }));

    return NextResponse.json({
      data,
      error: null,
      message: "Feature toggles updated successfully.",
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/features error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error", message: "Failed to update features." },
      { status: 500 }
    );
  }
}
