import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const health: {
    status: "ok" | "degraded" | "error";
    timestamp: string;
    checks: Record<string, { status: string; latencyMs?: number; error?: string }>;
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check database connectivity
  try {
    const start = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    health.checks.database = {
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    health.status = "error";
    health.checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const statusCode = health.status === "ok" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
