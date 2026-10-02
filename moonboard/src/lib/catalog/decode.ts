import cellsJson from '@/lib/constants/data/moonboard-cells.json';
import gradesJson from '@/lib/constants/data/difficulty-grades.json';
import type { HoldRole } from '@/lib/ble/protocol';
import { COLS } from '@/lib/constants/layouts';

/**
 * Boardsesh encodes a MoonBoard problem as `p<cell>r<role>p<cell>r<role>...`.
 *
 * The cell id is a formula over the 11-column grid, identical for every layout:
 *   cell = (row - 1) * 11 + col + 1        (col 0-based A..K, row 1-based from the bottom)
 * so p191 is D18. Roles: 42 start, 43 hand, 44 finish. Feet are stored as hands.
 */
const GRID_COLS = 11;

const ROLES: Record<string, HoldRole> = { '42': 'start', '43': 'middle', '44': 'finish', '45': 'foot' };

/** Cells that physically have a hold, per layout (older boards use sparse sets). */
const cellsWithHolds = cellsJson as Record<string, number[]>;

interface GradeEntry {
  difficulty: number;
  font: string;
  v: string;
}
const grades = (gradesJson as GradeEntry[]).slice().sort((a, b) => a.difficulty - b.difficulty);

export interface Hold {
  col: number;
  row: number;
  role: HoldRole;
  name: string;
}

export function cellId(col: number, row: number): number {
  return (row - 1) * GRID_COLS + col + 1;
}

export function cellToGrid(cell: number): { col: number; row: number } {
  return { col: (cell - 1) % GRID_COLS, row: Math.floor((cell - 1) / GRID_COLS) + 1 };
}

const FRAME_RE = /p(\d+)r(\d+)/g;

export function decodeFrames(frames: string, _layoutId?: number): Hold[] {
  const out: Hold[] = [];
  for (const m of frames.matchAll(FRAME_RE)) {
    const role = ROLES[m[2]];
    if (!role) continue;
    const { col, row } = cellToGrid(Number(m[1]));
    if (col < 0 || col >= GRID_COLS || row < 1) continue;
    out.push({ col, row, role, name: `${COLS[col]}${row}` });
  }
  return out;
}

/** Cell id for a grid position, used to build hold filters as SQL LIKE patterns. */
export function placementIdAt(_layoutId: number, col: number, row: number): string {
  return String(cellId(col, row));
}

/** All hold positions that exist on a layout. Empty means "unknown, draw all". */
export function layoutHolds(layoutId: number): { col: number; row: number }[] {
  return (cellsWithHolds[String(layoutId)] ?? []).map(cellToGrid);
}

function nearest(difficulty: number): GradeEntry | undefined {
  const d = Math.round(difficulty);
  return grades.find((g) => g.difficulty === d) ?? (d < grades[0].difficulty ? grades[0] : grades[grades.length - 1]);
}

/** Boardsesh numeric difficulty -> Font grade ("6B+"). Same scale as Aurora boards: 18 = 6B. */
export function fontGrade(difficulty: number | null | undefined): string {
  if (difficulty == null || Number.isNaN(difficulty)) return '?';
  return nearest(difficulty)?.font ?? '?';
}

export function vGrade(difficulty: number | null | undefined): string {
  if (difficulty == null || Number.isNaN(difficulty)) return '?';
  return nearest(difficulty)?.v ?? '?';
}

/** Grades the MoonBoard catalog actually uses: 5+ (13) up to 8C+ (33). */
export const FONT_GRADES: GradeEntry[] = grades.filter((g) => g.difficulty >= 13 && g.difficulty <= 33);

export function difficultyFor(font: string): number | undefined {
  return grades.find((g) => g.font === font.toUpperCase())?.difficulty;
}
