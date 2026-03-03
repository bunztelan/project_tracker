"use client";

import { useEffect } from "react";
import { featureStore } from "@/lib/feature-store";

/**
 * Placed inside ProjectProvider to sync feature toggles to the global store.
 * The AppSidebar (outside ProjectProvider) reads from this store.
 */
export function SyncFeatures({ features }: { features: Record<string, boolean> }) {
  useEffect(() => {
    featureStore.set(features);
    return () => featureStore.set(null);
  }, [features]);

  return null;
}
