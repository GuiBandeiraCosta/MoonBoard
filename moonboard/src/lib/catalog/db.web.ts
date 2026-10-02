import sample from './sample-problems.json';
import { decodeFrames, fontGrade } from './decode';
import type { CatalogStats, Problem, ProblemQuery, ProblemSummary, SortKey } from './db';

export type { CatalogStats, Problem, ProblemQuery, ProblemSummary, SortKey } from './db';

/**
 * Web preview catalog. The browser has no SQLite snapshot, so we ship a few
 * hundred real problems (top benchmarks and most-climbed) per layout and
 * filter them in memory. Native builds use db.ts instead.
 */
interface SampleRow {
  uuid: string;
  name: string;
  setter: string | null;
  description: string;
  difficulty: number | null;
  benchmark: number | null;
  ascents: number;
  quality: number | null;
  frames: string;
  createdAt: string | null;
  fa: string | null;
}

const rows = sample as Record<string, SampleRow[]>;

export const SAMPLE_LAYOUTS = Object.keys(rows).map(Number);

function summary(r: SampleRow): ProblemSummary {
  const difficulty = r.difficulty ?? r.benchmark;
  return {
    uuid: r.uuid,
    name: r.name,
    setter: r.setter,
    angle: 40,
    difficulty,
    grade: fontGrade(difficulty),
    benchmarkDifficulty: r.benchmark,
    isBenchmark: r.benchmark != null && r.benchmark > 0,
    ascents: r.ascents,
    quality: r.quality,
    frames: r.frames,
    createdAt: r.createdAt,
  };
}

function matches(q: ProblemQuery) {
  const search = q.search?.trim().toLowerCase();
  return (r: SampleRow) => {
    if (q.angle !== 40) return false;
    if (search && !r.name.toLowerCase().includes(search) && !(r.setter ?? '').toLowerCase().includes(search)) return false;
    const d = r.difficulty ?? r.benchmark ?? 0;
    if (q.minDifficulty != null && d < q.minDifficulty - 0.5) return false;
    if (q.maxDifficulty != null && d > q.maxDifficulty + 0.5) return false;
    if (q.benchmarksOnly && !(r.benchmark != null && r.benchmark > 0)) return false;
    if (q.minAscents != null && r.ascents < q.minAscents) return false;
    for (const pid of q.placementIds ?? []) if (!r.frames.includes(`p${pid}r`)) return false;
    return true;
  };
}

const sorters: Record<SortKey, (a: SampleRow, b: SampleRow) => number> = {
  popular: (a, b) => b.ascents - a.ascents,
  newest: (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  hardest: (a, b) => (b.difficulty ?? 0) - (a.difficulty ?? 0) || b.ascents - a.ascents,
  easiest: (a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0) || b.ascents - a.ascents,
  quality: (a, b) => (b.quality ?? 0) - (a.quality ?? 0) || b.ascents - a.ascents,
};

function filtered(q: ProblemQuery): SampleRow[] {
  return (rows[String(q.layoutId)] ?? []).filter(matches(q)).sort(sorters[q.sort ?? 'popular']);
}

export function closeCatalog(_layoutId: number) {}

export async function queryProblems(q: ProblemQuery): Promise<ProblemSummary[]> {
  const offset = q.offset ?? 0;
  return filtered(q)
    .slice(offset, offset + (q.limit ?? 50))
    .map(summary);
}

export async function countProblems(q: ProblemQuery): Promise<number> {
  return filtered(q).length;
}

export async function getProblem(layoutId: number, uuid: string, angle: number): Promise<Problem | null> {
  if (angle !== 40) return null;
  const r = (rows[String(layoutId)] ?? []).find((x) => x.uuid === uuid);
  if (!r) return null;
  return { ...summary(r), layoutId, description: r.description, holds: decodeFrames(r.frames, layoutId), faUsername: r.fa, faAt: null };
}

export async function catalogStats(layoutId: number, angle: number): Promise<CatalogStats> {
  const all = angle === 40 ? (rows[String(layoutId)] ?? []) : [];
  return { total: all.length, benchmarks: all.filter((r) => r.benchmark != null && r.benchmark > 0).length };
}
