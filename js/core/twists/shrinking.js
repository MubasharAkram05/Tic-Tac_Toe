/**
 * Shrinking board: every `every` moves (8) the empty cells of the outer
 * ring become blocked. Marks already in the ring stay and still count.
 * It stops while the playable area is still at least win length + 2 wide,
 * so only boards of 9x9 and up shrink. The UI warns `warn` (2) moves before.
 *   layout.shrink = { every: 8, warn: 2, rings: maxRings }
 */
import { BLOCKED } from '../board.js';

export const id = 'shrink';
export const EVERY = 8;
export const WARN = 2;

/** Rings that can close on a board: the area left after r rings is size - 2r and must stay >= k + 2. */
export const maxRings = (size, k) => Math.max(0, Math.floor((size - (k + 2)) / 2));

/** Cells of ring r (0 = the outer edge). */
export function ringCells(size, r) {
  const out = [];
  for (let row = r; row < size - r; row++) for (let c = r; c < size - r; c++) {
    if (row === r || row === size - 1 - r || c === r || c === size - 1 - r) out.push(row * size + c);
  }
  return out;
}

export function setup(s, layout) {
  const o = layout.shrink || {};
  s.shrink = { every: o.every || EVERY, warn: o.warn || WARN, rings: 0, max: Math.min(o.rings ?? 99, maxRings(s.size, s.k)), closed: [] };
}

export function afterMove(s, move, events) {
  const sh = s.shrink;
  if (sh.rings >= sh.max || s.moves % sh.every !== 0) return;
  const cells = ringCells(s.size, sh.rings).filter(i => s.board[i] === null);
  cells.forEach(i => {
    s.board[i] = BLOCKED;
    sh.closed.push(i);
    if (s.coins) delete s.coins[i];
    if (s.ice) delete s.ice[i];
  });
  sh.rings++;
  events.push({ type: 'shrink', cells, ring: sh.rings - 1 });
}

/** Moves until the next ring closes (Infinity when it won't shrink any more). */
export const shrinksIn = s => (s.shrink.rings >= s.shrink.max ? Infinity : s.shrink.every - (s.moves % s.shrink.every));
/** Ring that closes next (for the red warning blink), or -1. */
export const nextRing = s => (s.shrink.rings >= s.shrink.max ? -1 : s.shrink.rings);
