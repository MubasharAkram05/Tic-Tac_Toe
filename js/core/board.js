/**
 * Board helpers. A board is an array of 'X' | 'O' | BLOCKED | null,
 * indexed row * size + col. Pure functions, no DOM.
 *
 * BLOCKED cells (level twists) hold no mark: nobody can play there and
 * they break lines in the win check.
 */

/** Value of a blocked cell. Truthy, so it counts as "not empty" everywhere. */
export const BLOCKED = '#';

/**
 * New board. An optional level layout places blocked cells and preset marks:
 *   { blocked: [i, ...], preset: [{ i, m: 'X' | 'O' }], puzzleMoves }
 */
export function createBoard(size, layout = null) {
  const board = Array(size * size).fill(null);
  if (layout) {
    (layout.blocked || []).forEach(i => { board[i] = BLOCKED; });
    (layout.preset || []).forEach(p => { board[p.i] = p.m; });
  }
  return board;
}

/** No empty (playable) cell left. Blocked cells count as filled. */
export const isFull = board => board.every(Boolean);

export const emptyCells = board => {
  const out = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) out.push(i);
  return out;
};

export const rowOf = (i, size) => Math.floor(i / size);
export const colOf = (i, size) => i % size;

/** Mark that plays move number n (0-based) when `first` starts. */
export const markForMove = (n, first) => (n % 2 === 0 ? first : first === 'X' ? 'O' : 'X');
