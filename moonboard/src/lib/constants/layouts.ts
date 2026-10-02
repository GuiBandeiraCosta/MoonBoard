/**
 * MoonBoard layouts, keyed by the Boardsesh layout id used in the public
 * snapshots. Angles and grids come from Moon's product specs.
 */
export interface Layout {
  id: number;
  name: string;
  short: string;
  year: number;
  rows: number;
  cols: number;
  angles: number[];
  mini: boolean;
  /** Moon's own website setup id, for logbook import. */
  moonSetupId: number | null;
}

export const COLS = 'ABCDEFGHIJK';

export const LAYOUTS: Layout[] = [
  { id: 2, name: 'MoonBoard 2016', short: '2016', year: 2016, rows: 18, cols: 11, angles: [40], mini: false, moonSetupId: 1 },
  { id: 4, name: 'MoonBoard Masters 2017', short: 'Masters 2017', year: 2017, rows: 18, cols: 11, angles: [25, 40], mini: false, moonSetupId: 15 },
  { id: 5, name: 'MoonBoard Masters 2019', short: 'Masters 2019', year: 2019, rows: 18, cols: 11, angles: [25, 40], mini: false, moonSetupId: 17 },
  { id: 3, name: 'MoonBoard 2024', short: '2024', year: 2024, rows: 18, cols: 11, angles: [25, 40], mini: false, moonSetupId: 21 },
  { id: 6, name: 'Mini MoonBoard 2020', short: 'Mini 2020', year: 2020, rows: 12, cols: 11, angles: [40], mini: true, moonSetupId: 19 },
  { id: 7, name: 'Mini MoonBoard 2025', short: 'Mini 2025', year: 2025, rows: 12, cols: 11, angles: [40], mini: true, moonSetupId: null },
  { id: 1, name: 'MoonBoard 2010', short: '2010', year: 2010, rows: 18, cols: 11, angles: [40], mini: false, moonSetupId: null },
];

export function getLayout(id: number | null | undefined): Layout | undefined {
  return LAYOUTS.find((l) => l.id === id);
}

/** "E6" style hold name from 0-based column and 1-based row. */
export function holdName(col: number, row: number): string {
  return `${COLS[col] ?? '?'}${row}`;
}
