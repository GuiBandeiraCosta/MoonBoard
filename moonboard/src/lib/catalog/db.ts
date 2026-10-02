import * as SQLite from 'expo-sqlite';
import { catalogDir, catalogFileName, hasCatalog } from './snapshot';
import { decodeFrames, fontGrade, type Hold } from './decode';

/**
 * Read access to a downloaded Boardsesh snapshot. One connection per layout,
 * opened lazily. The snapshot is treated as read-only.
 */
const connections = new Map<number, Promise<SQLite.SQLiteDatabase>>();

export function closeCatalog(layoutId: number) {
  const c = connections.get(layoutId);
  connections.delete(layoutId);
  c?.then((db) => db.closeAsync()).catch(() => undefined);
}

export function catalogDb(layoutId: number): Promise<SQLite.SQLiteDatabase> {
  let c = connections.get(layoutId);
  if (!c) {
    if (!hasCatalog(layoutId)) {
      return Promise.reject(new Error('Catalog not downloaded'));
    }
    const dir = catalogDir.uri.replace(/^file:\/\//, '').replace(/\/$/, '');
    c = SQLite.openDatabaseAsync(catalogFileName(layoutId), { useNewConnection: true }, dir).then(async (db) => {
      await db.execAsync('PRAGMA query_only = 1;');
      return db;
    });
    connections.set(layoutId, c);
  }
  return c;
}

export interface ProblemSummary {
  uuid: string;
  name: string;
  setter: string | null;
  angle: number;
  difficulty: number | null;
  grade: string;
  benchmarkDifficulty: number | null;
  isBenchmark: boolean;
  ascents: number;
  quality: number | null;
  frames: string;
  createdAt: string | null;
}

export interface Problem extends ProblemSummary {
  layoutId: number;
  description: string;
  holds: Hold[];
  faUsername: string | null;
  faAt: string | null;
}

export type SortKey = 'popular' | 'newest' | 'hardest' | 'easiest' | 'quality';

export interface ProblemQuery {
  layoutId: number;
  angle: number;
  search?: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  benchmarksOnly?: boolean;
  /** Placement ids that must all appear in the problem. */
  placementIds?: string[];
  minAscents?: number;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

interface Row {
  uuid: string;
  name: string;
  setter_username: string | null;
  angle: number;
  display_difficulty: number | null;
  benchmark_difficulty: number | null;
  ascensionist_count: number | null;
  quality_average: number | null;
  frames: string;
  created_at: string | null;
}

function summary(r: Row): ProblemSummary {
  const difficulty = r.display_difficulty ?? r.benchmark_difficulty;
  return {
    uuid: r.uuid,
    name: r.name,
    setter: r.setter_username,
    angle: r.angle,
    difficulty,
    grade: fontGrade(difficulty),
    benchmarkDifficulty: r.benchmark_difficulty,
    isBenchmark: r.benchmark_difficulty != null && r.benchmark_difficulty > 0,
    ascents: r.ascensionist_count ?? 0,
    quality: r.quality_average,
    frames: r.frames,
    createdAt: r.created_at,
  };
}

const ORDER: Record<SortKey, string> = {
  popular: 's.ascensionist_count DESC, c.created_at DESC',
  newest: 'c.created_at DESC',
  hardest: 's.display_difficulty DESC, s.ascensionist_count DESC',
  easiest: 's.display_difficulty ASC, s.ascensionist_count DESC',
  quality: 's.quality_average DESC, s.ascensionist_count DESC',
};

function buildWhere(q: ProblemQuery): { where: string; params: SQLite.SQLiteBindValue[] } {
  const clauses = ['c.layout_id = ?', 'c.is_listed = 1', 'c.is_draft = 0', 's.angle = ?'];
  const params: SQLite.SQLiteBindValue[] = [q.layoutId, q.angle];
  if (q.search?.trim()) {
    clauses.push('(c.name LIKE ? OR c.setter_username LIKE ?)');
    const like = `%${q.search.trim()}%`;
    params.push(like, like);
  }
  if (q.minDifficulty != null) {
    clauses.push('s.display_difficulty >= ?');
    params.push(q.minDifficulty - 0.5);
  }
  if (q.maxDifficulty != null) {
    clauses.push('s.display_difficulty <= ?');
    params.push(q.maxDifficulty + 0.5);
  }
  if (q.benchmarksOnly) clauses.push('s.benchmark_difficulty IS NOT NULL AND s.benchmark_difficulty > 0');
  if (q.minAscents != null) {
    clauses.push('s.ascensionist_count >= ?');
    params.push(q.minAscents);
  }
  for (const pid of q.placementIds ?? []) {
    clauses.push('c.frames LIKE ?');
    params.push(`%p${pid}r%`);
  }
  return { where: clauses.join(' AND '), params };
}

const BASE = `
  FROM board_climbs c
  JOIN board_climb_stats s ON s.climb_uuid = c.uuid AND s.board_type = c.board_type
`;

export async function queryProblems(q: ProblemQuery): Promise<ProblemSummary[]> {
  const db = await catalogDb(q.layoutId);
  const { where, params } = buildWhere(q);
  const rows = await db.getAllAsync<Row>(
    `SELECT c.uuid, c.name, c.setter_username, s.angle, s.display_difficulty, s.benchmark_difficulty,
            s.ascensionist_count, s.quality_average, c.frames, c.created_at
     ${BASE}
     WHERE ${where}
     ORDER BY ${ORDER[q.sort ?? 'popular']}
     LIMIT ? OFFSET ?`,
    ...params,
    q.limit ?? 50,
    q.offset ?? 0,
  );
  return rows.map(summary);
}

export async function countProblems(q: ProblemQuery): Promise<number> {
  const db = await catalogDb(q.layoutId);
  const { where, params } = buildWhere(q);
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) as n ${BASE} WHERE ${where}`, ...params);
  return row?.n ?? 0;
}

export async function getProblem(layoutId: number, uuid: string, angle: number): Promise<Problem | null> {
  const db = await catalogDb(layoutId);
  const r = await db.getFirstAsync<Row & { description: string; fa_username: string | null; fa_at: string | null }>(
    `SELECT c.uuid, c.name, c.setter_username, c.description, s.angle, s.display_difficulty, s.benchmark_difficulty,
            s.ascensionist_count, s.quality_average, c.frames, c.created_at, s.fa_username, s.fa_at
     ${BASE}
     WHERE c.uuid = ? AND s.angle = ?`,
    uuid,
    angle,
  );
  if (!r) return null;
  return {
    ...summary(r),
    layoutId,
    description: r.description ?? '',
    holds: decodeFrames(r.frames, layoutId),
    faUsername: r.fa_username,
    faAt: r.fa_at,
  };
}

export interface CatalogStats {
  total: number;
  benchmarks: number;
}

export async function catalogStats(layoutId: number, angle: number): Promise<CatalogStats> {
  const db = await catalogDb(layoutId);
  const row = await db.getFirstAsync<{ total: number; benchmarks: number }>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN s.benchmark_difficulty IS NOT NULL AND s.benchmark_difficulty > 0 THEN 1 ELSE 0 END) as benchmarks
     ${BASE} WHERE c.layout_id = ? AND c.is_listed = 1 AND s.angle = ?`,
    layoutId,
    angle,
  );
  return { total: row?.total ?? 0, benchmarks: row?.benchmarks ?? 0 };
}
