import type { Ascent, GradeCount, NewAscent } from './db';

export type { Ascent, GradeCount, NewAscent } from './db';

/** Browser logbook, persisted in localStorage. Same API as the SQLite version. */
const KEY = 'moonlight.web.logbook';

interface State {
  nextId: number;
  ascents: Ascent[];
  projects: { climbUuid: string; layoutId: number }[];
}

function load(): State {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // fall through
  }
  return { nextId: 1, ascents: [], projects: [] };
}

function save(s: State) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export async function addAscent(a: NewAscent): Promise<number> {
  const s = load();
  const id = s.nextId++;
  s.ascents.unshift({ ...a, id });
  save(s);
  return id;
}

export async function deleteAscent(id: number): Promise<void> {
  const s = load();
  s.ascents = s.ascents.filter((a) => a.id !== id);
  save(s);
}

export async function listAscents(layoutId?: number, angle?: number): Promise<Ascent[]> {
  return load()
    .ascents.filter((a) => (layoutId == null || a.layoutId === layoutId) && (angle == null || a.angle === angle))
    .sort((a, b) => b.climbedAt.localeCompare(a.climbedAt) || b.id - a.id);
}

export async function ascentsFor(climbUuid: string): Promise<Ascent[]> {
  return load().ascents.filter((a) => a.climbUuid === climbUuid);
}

export async function sentSet(layoutId: number): Promise<Set<string>> {
  return new Set(load().ascents.filter((a) => a.layoutId === layoutId).map((a) => a.climbUuid));
}

export async function isProject(climbUuid: string): Promise<boolean> {
  return load().projects.some((p) => p.climbUuid === climbUuid);
}

export async function toggleProject(climbUuid: string, layoutId: number): Promise<boolean> {
  const s = load();
  const exists = s.projects.some((p) => p.climbUuid === climbUuid);
  s.projects = exists ? s.projects.filter((p) => p.climbUuid !== climbUuid) : [...s.projects, { climbUuid, layoutId }];
  save(s);
  return !exists;
}

export async function projectSet(layoutId: number): Promise<Set<string>> {
  return new Set(load().projects.filter((p) => p.layoutId === layoutId).map((p) => p.climbUuid));
}

export async function gradePyramid(layoutId: number, angle: number): Promise<GradeCount[]> {
  const by = new Map<string, Set<string>>();
  for (const a of await listAscents(layoutId, angle)) {
    if (!by.has(a.grade)) by.set(a.grade, new Set());
    by.get(a.grade)!.add(a.climbUuid);
  }
  return [...by.entries()].map(([grade, set]) => ({ grade, count: set.size }));
}
