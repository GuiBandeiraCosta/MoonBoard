/**
 * MoonBoard LED protocol.
 *
 * Every LED box generation (official v1 RedBearLab, v2+ Nordic UART, V4/V5
 * multi-user, and all DIY clones) accepts the same ASCII grammar:
 *
 *   l#S5,P9,P13,E18#        light start 5, mid 9 & 13, finish 18
 *   l##                     clear
 *   ~D*l#...#               flag prefix: D = also light the LED above the hold
 *   ~M*l#...#               flag prefix: M = Mini MoonBoard (12 rows)
 *
 * LED index is 0-based, column-major serpentine: column A runs bottom-to-top
 * (A1 = 0 ... A18 = 17), column B runs top-to-bottom, and so on.
 */

export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_WRITE = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_NOTIFY = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** First-generation (2016) official box built on a RedBearLab module. */
export const RBL_SERVICE = '713d0000-503e-4c75-ba94-3148f18d941e';
export const RBL_WRITE = '713d0003-503e-4c75-ba94-3148f18d941e';

/** Firmware RX buffers are 20 bytes; larger writes are silently truncated. */
export const CHUNK_SIZE = 20;
export const CHUNK_DELAY_MS = 15;

export type HoldRole = 'start' | 'middle' | 'finish' | 'foot';

export interface LitHold {
  /** 0-based column index, A = 0. */
  col: number;
  /** 1-based row, bottom row = 1. */
  row: number;
  role: HoldRole;
}

const ROLE_LETTER: Record<HoldRole, string> = {
  start: 'S',
  middle: 'P',
  finish: 'E',
  // Boxes only know S/P/E. Feet are shown as progress holds.
  foot: 'P',
};

/**
 * Convert a grid position into the LED strip index.
 * @param flipped true when the strip starts at the top of column A instead of the bottom.
 */
export function ledIndex(col: number, row: number, rows: number, flipped = false): number {
  const up = flipped ? col % 2 === 1 : col % 2 === 0;
  return up ? col * rows + (row - 1) : col * rows + (rows - row);
}

export interface EncodeOptions {
  rows: number;
  /** Light the LED above each hold too ("both lights" in the official app). */
  bothLights?: boolean;
  mini?: boolean;
  flipped?: boolean;
}

export function encodeFrame(holds: LitHold[], opts: EncodeOptions): string {
  const tokens = holds.map((h) => `${ROLE_LETTER[h.role]}${ledIndex(h.col, h.row, opts.rows, opts.flipped)}`);
  let flags = '';
  if (opts.bothLights) flags += 'D';
  if (opts.mini) flags += 'M';
  const prefix = flags ? `~${flags}*` : '';
  return `${prefix}l#${tokens.join(',')}#`;
}

export const CLEAR_FRAME = 'l##';

export function chunk(frame: string, size = CHUNK_SIZE): string[] {
  const out: string[] = [];
  for (let i = 0; i < frame.length; i += size) out.push(frame.slice(i, i + size));
  return out;
}
