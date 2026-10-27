/**
 * Win rules. Pure functions, no DOM.
 */
import { winLength } from '../config/constants.js';

export { winLength };

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // horizontal, vertical, two diagonals

/**
 * Win check from the last placed cell only. Walks at most k-1 steps each
 * way in the 4 directions, counting the same mark in a row.
 * Time O(k), space O(k). Returns the ordered winning cells, or null.
 */
export function winFrom(board, size, i) {
  const v = board[i];
  if (!v) return null;
  const k = winLength(size), r0 = (i / size) | 0, c0 = i % size;
  for (const [dr, dc] of DIRS) {
    const cells = [i];
    let r = r0 - dr, c = c0 - dc, steps = 0;
    while (steps < k - 1 && r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === v) {
      cells.unshift(r * size + c); r -= dr; c -= dc; steps++;
    }
    r = r0 + dr; c = c0 + dc; steps = 0;
    while (steps < k - 1 && r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === v) {
      cells.push(r * size + c); r += dr; c += dc; steps++;
    }
    if (cells.length >= k) return cells;
  }
  return null;
}

export const other = mark => (mark === 'X' ? 'O' : 'X');
