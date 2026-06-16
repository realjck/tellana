import { useSyncExternalStore } from "react";

// Global cache-bust version. Bumped when an asset file is overwritten in place
// (same url): forces `resolveAsset` to append `?v=N` so every preview reloads
// the new bytes instead of the stale browser-cached image.
let version = 0;
const listeners = new Set<() => void>();

/** Bump the global asset cache-bust version so replaced files reload everywhere. */
export function bustAssetCache(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function getAssetBustVersion(): number {
  return version;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Re-render the calling component whenever an asset is replaced. */
export function useAssetBust(): number {
  return useSyncExternalStore(subscribe, getAssetBustVersion, getAssetBustVersion);
}
