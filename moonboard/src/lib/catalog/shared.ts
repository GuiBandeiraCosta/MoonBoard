/** Helpers shared by the native and web catalog implementations. */
export const MANIFEST_URL = 'https://boardsesh-board-snapshots.t3.tigrisfiles.io/board-snapshots/v1/manifest.json';

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(0)} MB`;
}
