/**
 * Vanishing marks: each side keeps only `limit` marks. Placing one more
 * makes that side's oldest mark disappear (before the win check).
 *   limit: 3x3 = 3, 4x4 = 4, 5x5 and up = win length + 2
 * No win within `cap` moves (60) = draw.
 */
export const id = 'vanish';
export const MOVE_CAP = 60;

export const limitFor = (size, k) => (size <= 4 ? size : k + 2);

export function setup(s, layout) {
  const v = layout.vanish || {};
  s.vanish = { limit: v.limit || limitFor(s.size, s.k), cap: v.cap || MOVE_CAP };
}

export function afterMove(s, { mark }, events) {
  const q = s.order[mark];
  while (q.length > s.vanish.limit) {
    const old = q.shift();
    s.board[old] = null;
    events.push({ type: 'vanish', cell: old, mark });
  }
}

export function isDraw(s) {
  return s.moves >= s.vanish.cap;
}

/** Cells that vanish on their owner's next move (shown faded). */
export function nextToVanish(s) {
  return ['X', 'O'].filter(m => s.order[m].length >= s.vanish.limit).map(m => s.order[m][0]);
}
