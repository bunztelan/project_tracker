/**
 * Tiny client-side store that bridges feature toggles from ProjectProvider
 * (nested in the project layout) to AppSidebar (rendered in the parent layout).
 *
 * ProjectLayout → <SyncFeatures /> writes toggles here
 * AppSidebar → useFeatureStore() subscribes to changes
 */

type Listener = () => void;

let current: Record<string, boolean> | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn());
}

export const featureStore = {
  get(): Record<string, boolean> | null {
    return current;
  },

  set(features: Record<string, boolean> | null) {
    current = features;
    emit();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
