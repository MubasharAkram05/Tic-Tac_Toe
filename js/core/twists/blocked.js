/**
 * Blocked cells: stone tiles nobody can play on. They hold BLOCKED ('#'),
 * which is never a player's mark, so they also break lines.
 *   layout.blocked = [cellIndex, ...]
 */
import { BLOCKED } from '../board.js';

export const id = 'blocked';

export function setup(s, layout) {
  (layout.blocked || []).forEach(i => { s.board[i] = BLOCKED; });
}
