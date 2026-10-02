import { useSyncExternalStore } from 'react';
import type { SortKey } from './db';

/**
 * Current list filters. Kept in memory (not persisted) except the benchmark
 * toggle which lives in settings. Shared between the list screen and the
 * filter modal.
 */
export interface Filters {
  search: string;
  minDifficulty: number | null;
  maxDifficulty: number | null;
  benchmarksOnly: boolean;
  minAscents: number;
  sort: SortKey;
  /** Grid positions that must all be in the problem. */
  holds: { col: number; row: number }[];
}

const defaults: Filters = {
  search: '',
  minDifficulty: null,
  maxDifficulty: null,
  benchmarksOnly: false,
  minAscents: 0,
  sort: 'popular',
  holds: [],
};

let state: Filters = defaults;
const listeners = new Set<() => void>();

export function getFilters() {
  return state;
}

export function setFilters(patch: Partial<Filters>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function resetFilters() {
  state = { ...defaults, benchmarksOnly: state.benchmarksOnly, sort: state.sort };
  listeners.forEach((l) => l());
}

export function useFilters(): Filters {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.minDifficulty != null || f.maxDifficulty != null) n++;
  if (f.minAscents > 0) n++;
  if (f.holds.length > 0) n++;
  return n;
}
