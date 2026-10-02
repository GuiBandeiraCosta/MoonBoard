import type { CatalogMeta, ManifestEntry } from './snapshot';
import sample from './sample-problems.json';

export type { CatalogMeta, ManifestEntry } from './snapshot';
export { MANIFEST_URL, formatBytes } from './shared';

/**
 * Web preview: there is no file system, so "downloaded" simply means the
 * layout is in the bundled sample set. Downloads animate and finish instantly.
 */
const sampleLayouts = Object.keys(sample as Record<string, unknown[]>).map(Number);
const counts = Object.fromEntries(Object.entries(sample as Record<string, unknown[]>).map(([k, v]) => [k, v.length]));

const KEY = 'moonlight.web.catalogs';

function stored(): Record<string, CatalogMeta> {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function persist(m: Record<string, CatalogMeta>) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

export async function fetchMoonboardManifest(): Promise<ManifestEntry[]> {
  // The snapshot bucket does not send CORS headers for browsers, so describe the sample set instead.
  return sampleLayouts.map((layoutId) => ({
    boardType: 'moonboard',
    layoutId,
    url: '',
    bytes: 0,
    builtAt: new Date().toISOString(),
    schemaVersion: 0,
    tables: { board_climbs: { rowCount: counts[String(layoutId)] ?? 0 } },
  }));
}

export function readCatalogMeta(layoutId: number): CatalogMeta | null {
  return stored()[String(layoutId)] ?? null;
}

export function hasCatalog(layoutId: number): boolean {
  return readCatalogMeta(layoutId) !== null;
}

export function deleteCatalog(layoutId: number): void {
  const m = stored();
  delete m[String(layoutId)];
  persist(m);
}

export async function downloadCatalog(entry: ManifestEntry, onProgress?: (fraction: number) => void): Promise<CatalogMeta> {
  if (!sampleLayouts.includes(entry.layoutId)) throw new Error('Only the 2016 and Mini 2025 samples are available in the web preview.');
  for (let i = 1; i <= 10; i++) {
    await new Promise((r) => setTimeout(r, 60));
    onProgress?.(i / 10);
  }
  const meta: CatalogMeta = {
    layoutId: entry.layoutId,
    builtAt: entry.builtAt,
    bytes: 0,
    climbs: counts[String(entry.layoutId)] ?? 0,
    downloadedAt: new Date().toISOString(),
  };
  const m = stored();
  m[String(entry.layoutId)] = meta;
  persist(m);
  return meta;
}
