/**
 * Pre-placed marks (puzzle levels): X and O marks already on the board.
 * They are part of the starting state, never of the move history, so undo
 * can't remove them. The goal ("win in N") is layout.puzzleMoves.
 *   layout.preset = [{ i: cellIndex, m: 'X' | 'O' }]
 */
export const id = 'puzzle';

export function setup(s, layout) {
  s.preset = [];
  (layout.preset || []).forEach(p => {
    s.board[p.i] = p.m;
    s.order[p.m].push(p.i);
    s.preset.push(p.i);
  });
  s.puzzleMoves = layout.puzzleMoves || null;
}
