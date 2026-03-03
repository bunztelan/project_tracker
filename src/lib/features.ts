import { prisma } from "@/lib/prisma";

export async function getProjectFeatures(
  projectId: string
): Promise<Record<string, boolean>> {
  const toggles = await prisma.featureToggle.findMany({
    where: { projectId },
  });
  return Object.fromEntries(toggles.map((t) => [t.featureKey, t.enabled]));
}

export function isFeatureEnabled(
  features: Record<string, boolean>,
  key: string
): boolean {
  return features[key] ?? false;
}
