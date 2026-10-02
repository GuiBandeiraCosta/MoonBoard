import { Directory, File, Paths } from 'expo-file-system';

/**
 * Problem catalogs come from Boardsesh's public nightly SQLite snapshots.
 * One file per layout. See CLAUDE.md for the schema.
 */
import { MANIFEST_URL } from './shared';

export { MANIFEST_URL, formatBytes } from './shared';

export interface ManifestEntry {
  boardType: string;
  layoutId: number;
  url: string;
  bytes: number;
  builtAt: string;
  schemaVersion: number;
  tables: Record<string, { rowCount: number }>;
}

interface Manifest {
  formatVersion: number;
  generatedAt: string;
  entries: ManifestEntry[];
}

export async function fetchMoonboardManifest(): Promise<ManifestEntry[]> {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`Manifest request failed (${res.status})`);
  const json = (await res.json()) as Manifest;
  return json.entries.filter((e) => e.boardType === 'moonboard');
}

export const catalogDir = new Directory(Paths.document, 'catalogs');

export function catalogFileName(layoutId: number): string {
  return `moonboard-${layoutId}.db`;
}

export function catalogFile(layoutId: number): File {
  return new File(catalogDir, catalogFileName(layoutId));
}

export interface CatalogMeta {
  layoutId: number;
  builtAt: string;
  bytes: number;
  climbs: number;
  downloadedAt: string;
}

function metaFile(layoutId: number): File {
  return new File(catalogDir, `moonboard-${layoutId}.json`);
}

export function readCatalogMeta(layoutId: number): CatalogMeta | null {
  const f = metaFile(layoutId);
  if (!f.exists || !catalogFile(layoutId).exists) return null;
  try {
    return JSON.parse(f.textSync()) as CatalogMeta;
  } catch {
    return null;
  }
}

export function hasCatalog(layoutId: number): boolean {
  return readCatalogMeta(layoutId) !== null;
}

export function deleteCatalog(layoutId: number): void {
  for (const f of [catalogFile(layoutId), metaFile(layoutId)]) {
    if (f.exists) f.delete();
  }
}

export async function downloadCatalog(entry: ManifestEntry, onProgress?: (fraction: number) => void): Promise<CatalogMeta> {
  if (!catalogDir.exists) catalogDir.create({ intermediates: true });
  const target = catalogFile(entry.layoutId);
  const tmp = new File(catalogDir, `${catalogFileName(entry.layoutId)}.part`);
  if (tmp.exists) tmp.delete();

  const task = File.createDownloadTask(entry.url, tmp, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : entry.bytes;
      if (total > 0) onProgress?.(Math.min(1, bytesWritten / total));
    },
  });
  await task.downloadAsync();

  if (target.exists) target.delete();
  tmp.move(target);

  const meta: CatalogMeta = {
    layoutId: entry.layoutId,
    builtAt: entry.builtAt,
    bytes: entry.bytes,
    climbs: entry.tables.board_climbs?.rowCount ?? 0,
    downloadedAt: new Date().toISOString(),
  };
  const mf = metaFile(entry.layoutId);
  if (mf.exists) mf.delete();
  mf.create();
  mf.write(JSON.stringify(meta));
  return meta;
}

