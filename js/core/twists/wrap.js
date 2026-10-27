/**
 * Wrap-around edges: rows and diagonals continue from the right edge to
 * the left edge (columns wrap, rows don't: nothing wraps top to bottom).
 * Only on 8x8 and up.
 */
export const id = 'wrap';

export function setup(s) {
  s.wrap = true;
}

/** One step along (dr, dc); the column wraps around, the row stops at the edge. */
export function step(s, i, dr, dc) {
  const n = s.size, r = ((i / n) | 0) + dr;
  if (r < 0 || r >= n) return -1;
  return r * n + ((((i % n) + dc) % n) + n) % n;
}

export function getLineCells(s, start, dir, api) {
  return api.walk(s, start, dir, step);
}

/** True if a line of cells crosses the left / right edge (the UI draws no straight win line for it). */
export function crossesEdge(cells, size) {
  for (let j = 1; j < cells.length; j++) if (Math.abs((cells[j] % size) - (cells[j - 1] % size)) > 1) return true;
  return false;
}
