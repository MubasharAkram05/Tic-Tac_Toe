/**
 * Board helpers. A board is an array of 'X' | 'O' | null,
 * indexed row * size + col. Pure functions, no DOM.
 */

export const createBoard = size => Array(size * size).fill(null);

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
