import { prisma } from "@/lib/prisma";

// Re-export client-safe utilities so server components can import everything from one place
export {
  FEATURE_DEPENDENCIES,
  ROUTE_FEATURE_MAP,
  isFeatureEnabled,
} from "@/lib/feature-utils";

export async function getProjectFeatures(
  projectId: string
): Promise<Record<string, boolean>> {
  const toggles = await prisma.featureToggle.findMany({
    where: { projectId },
  });
  return Object.fromEntries(toggles.map((t) => [t.featureKey, t.enabled]));
}
