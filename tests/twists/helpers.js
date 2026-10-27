/**
 * Shared helpers for the twist tests (not a test file itself).
 */
import { createState, applyMove, cloneState, legalMoves, isDraw } from '../../js/core/twists/index.js';
import { chooseStateMove } from '../../js/core/twist-ai.js';
import { setRandom } from '../../js/core/random.js';
import { mulberry32 } from '../../js/utils/seeded-random.js';

export { createState, applyMove, cloneState, legalMoves, isDraw };

/** Every AI choice in the tests comes from a seeded generator (same result every run). */
export const seed = (n = 1) => setRandom(mulberry32(n));

/** Board as rows of text ('.' empty, '#' blocked) - handy in assertion messages. */
export const show = s => s.board.map(v => v || '.').join('').match(new RegExp(`.{${s.size}}`, 'g')).join('/');

/**
 * Plays a whole game with the AI on both sides (through the hooks) and
 * checks every move is legal. Returns { result, moves, state }.
 */
export function playOut(size, layout, levels = ['hard', 'medium'], max = 200) {
  const s = createState(size, layout);
  let mark = 'X';
  for (let n = 0; n < max; n++) {
    if (isDraw(s)) return { result: 'draw', moves: n, state: s };
    const legal = legalMoves(s);
    const m = chooseStateMove(s, mark, mark === 'X' ? levels[0] : levels[1]);
    if (!legal.includes(m)) throw new Error(`illegal move ${m} for ${mark} (legal: ${legal.join(',')}) on ${show(s)}`);
    const r = applyMove(s, m, mark);
    if (r.line) return { result: mark, moves: n + 1, state: s };
    mark = mark === 'X' ? 'O' : 'X';
  }
  return { result: 'cap', moves: max, state: s };
}

/** Plays cells in order, X first (or `first`). Returns the last applyMove result. */
export function playAll(s, cells, first = 'X') {
  let mark = first, r = null;
  for (const c of cells) {
    r = applyMove(s, c, mark);
    if (!r) throw new Error(`move ${c} not allowed`);
    mark = mark === 'X' ? 'O' : 'X';
  }
  return r;
}

/** Undo the way the game does it: keep a snapshot before each move, restore it. */
export function withSnapshots(s, cells, first = 'X') {
  const snaps = [];
  let mark = first;
  for (const c of cells) {
    snaps.push(cloneState(s));
    applyMove(s, c, mark);
    mark = mark === 'X' ? 'O' : 'X';
  }
  return snaps;
}
