/**
 * Validation for level twist layouts. Pure logic, no DOM.
 *
 * Used by the tests (tests/twists/) and tools/gen-twist-table.js, never at
 * runtime on the phone (the game reads the results from config/twist-table.js).
 *
 *   validateBlocked(board, size, k)       -> '' or the reason it fails
 *   validatePreset(board, size, k)        -> '' or the reason it fails
 *   isPuzzleSolvable(board, size, k, N)   -> true if X can force a win within N moves
 *   puzzleLength(board, size, k)          -> smallest such N (1..4), or 0
 *   validateLayout(layout, level)         -> '' or the reason it fails (every twist)
 *   findLayout(n, level, twists)          -> { attempt, layout } or null
 */
import { BLOCKED, createBoard } from './board.js';
import { winFrom, lineWindows, other } from './rules.js';
import { buildLayout, centreArea } from './layout-generator.js';
import {
  MAX_ATTEMPTS, PUZZLE_MOVES, MIN_SIZE, DIAGONAL_MIN_SIZE, ICE_COUNTS, ICE_MELT, COIN_CELLS, comboAllowed, maxTwists,
} from '../config/level-twists.js';
import { createState, lineWindows as ruleWindows } from './twists/index.js';
import { maxRings } from './twists/shrinking.js';
import { mulberry32 } from '../utils/seeded-random.js';

/** Share of normal winning lines that must stay open after blocking. */
export const MIN_OPEN_LINES = 0.6;
/** Each side must keep at least this share of all lines (no blocked cell, no opponent mark). */
export const MIN_PLAYER_LINES = 0.25;

/* ---------- Blocked cells ---------- */

/**
 * - at least 60% of the winning lines (length k) contain no blocked cell
 * - the centre area is not blocked (at most 1 blocked cell in it)
 * - neither side is cut off: each keeps >= 25% of all lines open for itself
 */
export function validateBlocked(board, size, k) {
  const wins = lineWindows(size, k);
  const open = wins.filter(w => w.every(i => board[i] !== BLOCKED)).length;
  if (open < MIN_OPEN_LINES * wins.length) return `only ${open}/${wins.length} lines open`;
  const centre = centreArea(size).filter(i => board[i] === BLOCKED).length;
  if (centre > 1) return 'centre area blocked';
  for (const me of ['X', 'O']) {
    const opp = other(me);
    const mine = wins.filter(w => w.every(i => board[i] !== BLOCKED && board[i] !== opp)).length;
    if (mine < MIN_PLAYER_LINES * wins.length) return `${me} is cut off (${mine} lines)`;
  }
  return '';
}

/* ---------- Pre-placed marks ---------- */

const cellWindowCache = {};
/** For each cell, the line windows that pass through it (cached per size). */
function windowsByCell(size, k) {
  const key = size + ':' + k;
  if (cellWindowCache[key]) return cellWindowCache[key];
  const by = Array.from({ length: size * size }, () => []);
  lineWindows(size, k).forEach(w => w.forEach(i => by[i].push(w)));
  return (cellWindowCache[key] = by);
}

/** Windows that hold at least one `mark` (only those can turn into threats). */
function windowsOf(board, size, k, mark) {
  const by = windowsByCell(size, k), seen = new Set(), out = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== mark) continue;
    for (const w of by[i]) if (!seen.has(w)) { seen.add(w); out.push(w); }
  }
  return out;
}

/** Empty cells where `mark` wins at once. O(windows near the marks * k). */
export function winningCells(board, size, k, mark) {
  const out = new Set();
  for (const w of windowsOf(board, size, k, mark)) {
    let mine = 0, gap = -1, bad = false;
    for (const i of w) {
      if (board[i] === mark) mine++;
      else if (board[i] === null && gap < 0) gap = i;
      else { bad = true; break; }
    }
    if (!bad && mine === k - 1 && gap >= 0) out.add(gap);
  }
  return [...out];
}

/** Empty cells that give `mark` a winning threat (a "four"): lines with k - 2 marks and 2 gaps. */
function threatMoves(board, size, k, mark) {
  const out = new Set();
  for (const w of windowsOf(board, size, k, mark)) {
    let mine = 0;
    const gaps = [];
    for (const i of w) {
      if (board[i] === mark) mine++;
      else if (board[i] === null) gaps.push(i);
      else { mine = -1; break; }
    }
    if (mine === k - 2 && gaps.length === 2) gaps.forEach(i => out.add(i));
  }
  return [...out];
}

/**
 * - no line is already won
 * - fair counts: X moves first, so X = O
 * - the machine (O) has no immediate win on its first turn
 * - the player (X) can't win with the very first move (it would not be a puzzle)
 */
export function validatePreset(board, size, k) {
  for (let i = 0; i < board.length; i++) {
    if ((board[i] === 'X' || board[i] === 'O') && winFrom(board, size, i)) return 'starts with a win';
  }
  const x = board.filter(v => v === 'X').length, o = board.filter(v => v === 'O').length;
  if (x !== o) return `unfair counts X${x} O${o}`;
  if (winningCells(board, size, k, 'O').length) return 'machine can win at once';
  if (winningCells(board, size, k, 'X').length) return 'player can win in 1';
  return '';
}

/** Empty cells where `mark` gets two or more winning cells at once (an unstoppable double threat). */
function doubleThreatMoves(board, size, k, mark) {
  const out = [];
  for (const t of threatMoves(board, size, k, mark)) {
    board[t] = mark;
    if (winningCells(board, size, k, mark).length >= 2) out.push(t);
    board[t] = null;
  }
  return out;
}

/** Empty cells next to `mark`'s marks (radius 2): the only places a new threat can come from. */
function nearMarks(board, size, mark) {
  const out = new Set();
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== mark) continue;
    const r0 = (i / size) | 0, c0 = i % size;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const r = r0 + dr, c = c0 + dc, j = r * size + c;
      if (r >= 0 && r < size && c >= 0 && c < size && board[j] === null) out.add(j);
    }
  }
  return [...out];
}

/**
 * Every defender reply that could matter against a set of double-threat
 * cells T: the cells of T and every empty cell on a line that one of
 * them would complete. A reply anywhere else leaves a double threat in
 * place, so the player still wins in 2.
 */
function defenceCells(board, size, k, mark, T) {
  const out = new Set(T);
  for (const w of lineWindows(size, k)) {
    if (!w.some(i => T.includes(i))) continue;
    if (w.some(i => board[i] !== null && board[i] !== mark)) continue;
    w.forEach(i => { if (board[i] === null) out.add(i); });
  }
  return [...out];
}

/**
 * Forced-win search for the player `me` with `d` of its moves left.
 *
 * An AND-OR proof search over threats (like alpha-beta, but it only has to
 * prove "win" or "no proof"):
 *  - a "four" (win next move) forces the defender to block that one cell
 *  - an "open three" (a double threat next move) gives the defender a few
 *    replies that matter; the player must win against every one of them
 *  - the defender may also win first or answer with its own four
 * Candidate moves are cells near the player's marks. A `budget` of search
 * nodes keeps it fast; running out counts as "no proof", so a "true" is
 * always a real forced win against the best defence.
 */
function forcedWin(board, size, k, me, d, budget, root = false) {
  if (d <= 0 || --budget.left < 0) return false;
  const now = winningCells(board, size, k, me);
  if (now.length) { if (root) budget.move = now[0]; return true; } // win now
  if (d === 1) return false;
  const opp = other(me), oppWins = winningCells(board, size, k, opp);
  if (oppWins.length >= 2) return false;                          // can't block both
  const moves = oppWins.length === 1 ? oppWins
    : [...new Set([...threatMoves(board, size, k, me), ...(d >= 3 ? nearMarks(board, size, me) : [])])];
  for (const m of moves) {
    board[m] = me;
    let ok = false;
    const mine = winningCells(board, size, k, me);
    if (winningCells(board, size, k, opp).length) ok = false;       // the defender wins first
    else if (mine.length >= 2) ok = d >= 2;                          // two threats: one stays open
    else if (mine.length === 1) {                                    // a four: forced block
      board[mine[0]] = opp;
      ok = forcedWin(board, size, k, me, d - 1, budget);
      board[mine[0]] = null;
    } else if (d >= 3) {                                             // maybe an open three
      const T = doubleThreatMoves(board, size, k, me);
      if (T.length) {
        const replies = [...new Set([...defenceCells(board, size, k, me, T), ...threatMoves(board, size, k, opp)])];
        ok = true;
        for (const r of replies) {
          board[r] = opp;
          const win = forcedWin(board, size, k, me, d - 1, budget);
          board[r] = null;
          if (!win) { ok = false; break; }
        }
      }
    }
    board[m] = null;
    if (ok) { if (root) budget.move = m; return true; }
    if (budget.left < 0) return false;
  }
  return false;
}

/** Search nodes allowed per check (deterministic, so results are the same everywhere). */
export const SEARCH_BUDGET = 6000;

/** True if X (moving first) can force a win within N of its moves against the best defence. */
export function isPuzzleSolvable(board, size, k, N, me = 'X') {
  return forcedWin(board.slice(), size, k, me, N, { left: SEARCH_BUDGET });
}

/** A first move of a forced win within N moves (used by tests to play puzzles), or -1. */
export function solvingMove(board, size, k, N, me = 'X') {
  const budget = { left: SEARCH_BUDGET, move: -1 };
  return forcedWin(board.slice(), size, k, me, N, budget, true) ? budget.move : -1;
}

/** Smallest N (1..max) the puzzle can be forced in, or 0 if none. */
export function puzzleLength(board, size, k, max = PUZZLE_MOVES.max, me = 'X') {
  for (let N = 1; N <= max; N++) if (isPuzzleSolvable(board, size, k, N, me)) return N;
  return 0;
}

/* ---------- Whole layouts ---------- */

/** Cells a falling mark can reach in each column (above the first blocked cell). Ice melts later, so it counts as open. */
export function reachable(board, size) {
  const out = new Set();
  for (let c = 0; c < size; c++) for (let r = 0; r < size; r++) {
    const i = r * size + c;
    if (board[i] === BLOCKED) break;
    out.add(i);
  }
  return out;
}

/** Preset marks with an empty cell under them (not allowed with gravity). */
export function floatingMarks(board, size) {
  const out = [];
  for (let i = 0; i < board.length - size; i++) if ((board[i] === 'X' || board[i] === 'O') && board[i + size] === null) out.push(i);
  return out;
}

/**
 * "Winnable": lines (under the level's rules: direction, wrap) that the
 * player can still fill - no blocked cell, no machine mark and, with
 * gravity, only reachable cells. Shrinking is judged on the final area.
 */
export function openLinesFor(layout, level, mark = 'X') {
  const s = createState(level.size, layout), opp = mark === 'X' ? 'O' : 'X';
  const reach = s.gravity ? reachable(s.board, s.size) : null;
  const ring = s.shrink ? s.shrink.max : 0, n = s.size;
  const inside = i => { const r = (i / n) | 0, c = i % n; return r >= ring && c >= ring && r < n - ring && c < n - ring; };
  const all = ruleWindows(s);
  const open = all.filter(w => w.every(i => s.board[i] !== BLOCKED && s.board[i] !== opp && (!reach || reach.has(i)) && inside(i)));
  return { open: open.length, all: all.length };
}

/**
 * '' if a layout is valid for a level ({ id, size, winLength, boss }), else the reason.
 *  - allowed combination and number of twists, board big enough for each
 *  - cells inside the board, never two things on one cell (coins / ice never on blocked cells)
 *  - blocked cells: 60% of lines open, centre free, nobody cut off
 *  - winnable under the active rules (enough open lines for the player)
 *  - ice: 2-6 cells melting after 4-8 moves; coins: 1-3 coin cells (+1 diamond on bosses)
 *  - shrinking never leaves less than win length + 2
 *  - gravity puzzles have no floating marks
 *  - puzzles: fair, no instant win / loss, forced in exactly `puzzleMoves`
 * { solved: true } skips the puzzle solver when the caller just measured N.
 */
export function validateLayout(layout, level, { solved = false } = {}) {
  const { size, winLength: k } = level;
  if (!layout) return 'no layout';
  const twists = layout.twists || [];
  if (!comboAllowed(twists)) return `forbidden combo ${twists.join('+')}`;
  if (level.id && twists.length > maxTwists(level.id, level.boss) && !(layout.preset.length && twists.length <= 3)) return `too many twists ${twists.length}`;
  const small = twists.find(id => size < MIN_SIZE[id]);
  if (small) return `${small} needs ${MIN_SIZE[small]}x${MIN_SIZE[small]}`;
  if (layout.rule === 'diagonal' && size < DIAGONAL_MIN_SIZE) return 'diagonal rule on a small board';
  const ice = layout.ice || [], coins = layout.coins || [];
  const cells = [...layout.blocked, ...layout.preset.map(p => p.i), ...ice.map(c => c.i), ...coins.map(c => c.i)];
  if (new Set(cells).size !== cells.length || cells.some(i => i < 0 || i >= size * size)) return 'bad cells (overlap or outside)';
  if (twists.includes('blocked') !== layout.blocked.length > 0) return 'blocked list does not match';
  if (twists.includes('ice')) {
    const [lo, hi] = ICE_COUNTS[size];
    if (ice.length < Math.min(2, lo) || ice.length > hi) return `ice count ${ice.length}`;
    if (ice.some(c => c.melt < ICE_MELT[0] || c.melt > ICE_MELT[1])) return 'ice melt time';
  }
  if (twists.includes('coins')) {
    const plain = coins.filter(c => c.kind === 'coin').length, gems = coins.filter(c => c.kind === 'diamond').length;
    if (plain < COIN_CELLS[0] - (gems ? 1 : 0) || plain > COIN_CELLS[1] || gems > (level.boss ? 1 : 0)) return `coin cells ${plain}+${gems}`;
  }
  if (layout.shrink && layout.shrink.rings > maxRings(size, k)) return 'shrinks below win length + 2';
  if (layout.shrink && size - 2 * layout.shrink.rings < k + 2) return 'shrinks below win length + 2';
  const board = createBoard(size, layout);
  if (layout.gravity && floatingMarks(board, size).length) return 'floating marks with gravity';
  const why = validateBlocked(board, size, k);
  if (why) return why;
  const { open, all } = openLinesFor(layout, level);
  if (open < Math.max(4, 0.25 * all)) return `not winnable: ${open}/${all} lines open`;
  if (!layout.preset.length) return layout.puzzleMoves ? 'moves without marks' : '';
  const p = validatePreset(board, size, k);
  if (p) return p;
  const N = layout.puzzleMoves;
  if (!(N >= PUZZLE_MOVES.min && N <= PUZZLE_MOVES.max)) return `puzzle moves ${N}`;
  if (solved) return '';
  if (!isPuzzleSolvable(board, size, k, N)) return `not solvable in ${N}`;
  if (isPuzzleSolvable(board, size, k, N - 1)) return `also solvable in ${N - 1}`;
  return '';
}

/**
 * Puzzle length the level aims for (deterministic). 5-in-a-row boards with
 * at most 4 player marks mostly give 2-3 move puzzles; bosses aim for 3+.
 */
export function targetMoves(n, level) {
  const r = mulberry32(n * 31 + 7)();
  if (level.boss) return level.winLength === 4 && r < 0.5 ? 4 : PUZZLE_MOVES.bossMin;
  const odds = level.winLength === 4 ? [0.35, 0.75] : [0.5, 0.9]; // cumulative for N = 2, 3 (rest 4)
  return r < odds[0] ? 2 : r < odds[1] ? 3 : 4;
}

/** Attempts that must hit the target length exactly before any length 2-4 is fine. */
export const TARGET_ATTEMPTS = 35;

/**
 * Layout search used to build the twist table: tries attempts 0..49
 * (seed = level + 1000 x attempt) and keeps the first valid one. For
 * puzzles, N is the shortest forced win; early attempts must match the
 * level's target length. Returns { attempt, layout } or null (= play the
 * level without a twist).
 */
export function findLayout(n, level, twists) {
  const target = targetMoves(n, level);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const layout = buildLayout(n, level, twists, attempt);
    if (!layout) continue;
    if (layout.preset.length) {
      const board = createBoard(level.size, layout);
      if (validatePreset(board, level.size, level.winLength)) continue;
      const { size, winLength: k } = level;
      // early attempts: exactly the target length (2 searches); later: the shortest length 2-4
      const N = attempt < TARGET_ATTEMPTS
        ? (isPuzzleSolvable(board, size, k, target) && !isPuzzleSolvable(board, size, k, target - 1) ? target : 0)
        : puzzleLength(board, size, k);
      if (N < PUZZLE_MOVES.min) continue;
      layout.puzzleMoves = N;
    }
    if (!validateLayout(layout, level, { solved: true })) return { attempt, layout };
  }
  return null;
}
