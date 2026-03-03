/**
 * Client-safe feature toggle utilities (no server-only imports).
 * For server-only helpers (DB queries), use @/lib/features instead.
 */

/**
 * Feature dependencies: if a key's dependency is disabled, the key must also be disabled.
 * e.g. sprints depends on backlog — you can't plan sprints without a backlog.
 */
export const FEATURE_DEPENDENCIES: Record<string, string> = {
  sprints: "backlog",
};

/**
 * Maps URL route segments to their feature toggle key.
 * Used by page-level guards to block access to disabled features.
 */
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  board: "kanban",
  backlog: "backlog",
  sprints: "sprints",
  timeline: "timeline",
  reports: "reports",
  data: "excel",
};

export function isFeatureEnabled(
  features: Record<string, boolean>,
  key: string
): boolean {
  return features[key] ?? false;
}
