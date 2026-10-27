/**
 * Win rules. Pure functions, no DOM.
 */
import { winLength } from '../config/constants.js';
import { BLOCKED } from './board.js';

export { winLength };

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // horizontal, vertical, two diagonals

/**
 * Win check from the last placed cell only. Walks at most k-1 steps each
 * way in the 4 directions, counting the same mark in a row. A blocked cell
 * is never "your mark", so it stops the walk (it breaks lines).
 * Time O(k), space O(k). Returns the ordered winning cells, or null.
 */
export function winFrom(board, size, i) {
  const v = board[i];
  if (!v || v === BLOCKED) return null;
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

const windowCache = {};

/**
 * Every winning line of length k on the board ("windows"), as cell lists.
 * About 4 * n windows; cached per size. Used by the twist rules and the
 * layout validator.
 */
export function lineWindows(size, k = winLength(size)) {
  const key = size + ':' + k;
  if (windowCache[key]) return windowCache[key];
  const out = [];
  for (const [dr, dc] of DIRS) {
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const er = r + dr * (k - 1), ec = c + dc * (k - 1);
      if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
      const w = [];
      for (let s = 0; s < k; s++) w.push((r + dr * s) * size + (c + dc * s));
      out.push(w);
    }
  }
  return (windowCache[key] = out);
}

/** True if `mark` still has at least one line with no opponent mark and no blocked cell. O(windows * k). */
export function canStillWin(board, size, mark) {
  const opp = other(mark);
  return lineWindows(size).some(w => w.every(i => board[i] !== opp && board[i] !== BLOCKED));
}

/**
 * Draw on twist boards: no empty cell left, or nobody can make a line any
 * more (blocked cells and the other side's marks cut every line).
 */
export function isDeadBoard(board, size) {
  if (board.every(Boolean)) return true;
  return !canStillWin(board, size, 'X') && !canStillWin(board, size, 'O');
}
