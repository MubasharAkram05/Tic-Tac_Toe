/**
 * Builds a level's twist layout from its level number. Pure logic, no DOM.
 *
 * The same level always gets the same layout on every device: every random
 * choice comes from mulberry32(level + SEED_STEP * attempt).
 *
 * Layout format:
 *   { blocked: [cellIndex, ...], preset: [{ i: cellIndex, m: 'X' | 'O' }], puzzleMoves: N | null }
 *
 * At runtime nothing is validated (to keep the phone fast): the twist type,
 * the attempt that passed validation and the puzzle length come from
 * config/twist-table.js, which tools/gen-twist-table.js writes and
 * tests/twists.test.js checks for all 500 levels.
 */
import { mulberry32, randInt, pick, shuffle } from '../utils/seeded-random.js';
import { BLOCKED_COUNTS, PRESET_COUNTS, SEED_STEP, overrideLayout } from '../config/level-twists.js';
import { TWIST_TABLE, TYPE_CODES } from '../config/twist-table.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Cells of the centre area: 3x3 on odd boards, 2x2 on even boards. */
export function centreArea(size) {
  const mid = (size - 1) / 2, out = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1) out.push(r * size + c);
  }
  return out;
}

/** Blocked cells: spread out (no two touching), never in the centre area. */
function placeBlocked(rnd, size, count) {
  const centre = new Set(centreArea(size)), taken = new Set(), out = [];
  const touches = i => out.some(j => Math.abs(((i / size) | 0) - ((j / size) | 0)) <= 1 && Math.abs((i % size) - (j % size)) <= 1);
  for (const i of shuffle(rnd, [...Array(size * size).keys()])) {
    if (out.length >= count) break;
    if (centre.has(i) || taken.has(i) || touches(i)) continue;
    out.push(i);
    taken.add(i);
  }
  return out.sort((a, b) => a - b);
}

/** k cells in a row from (r, c) along (dr, dc), or null if it leaves the board. */
function windowFrom(size, k, r, c, dr, dc) {
  const out = [];
  for (let s = 0; s < k; s++) {
    const rr = r + dr * s, cc = c + dc * s;
    if (rr < 0 || rr >= size || cc < 0 || cc >= size) return null;
    out.push(rr * size + cc);
  }
  return out;
}

const inside = (size, r, c) => r >= 0 && r < size && c >= 0 && c < size;

/**
 * Player marks for a puzzle, in one of two shapes (picked by the seed):
 *  - "line": k - 2 marks on one line (a four is one move away) plus the
 *    rest on a crossing line. Usually a short puzzle (win in 2).
 *  - "fork": two crossing lines through an empty pivot, 2 marks each
 *    (k - 3 on 4-in-a-row boards). Playing the pivot makes two threats at
 *    once, so these are the longer puzzles (win in 3+).
 * Returns { marks: Map(cell -> 'X'), anchor, ends } or null.
 */
function playerShape(rnd, size, k, half, free) {
  const r0 = randInt(rnd, 2, size - 3), c0 = randInt(rnd, 2, size - 3);
  const marks = new Map(), ends = [];
  const fork = half >= 2 * Math.max(1, k - 3) && rnd() < 0.55;
  if (fork) {
    const pivot = r0 * size + c0;
    if (!free(pivot)) return null;
    const dirs = shuffle(rnd, DIRS).slice(0, 2), each = Math.max(1, k - 3);
    for (const [dr, dc] of dirs) {
      const cells = [-2, -1, 1, 2].map(s => [r0 + dr * s, c0 + dc * s]).filter(([r, c]) => inside(size, r, c) && free(r * size + c));
      if (cells.length < each) return null;
      shuffle(rnd, cells).slice(0, each).forEach(([r, c]) => marks.set(r * size + c, 'X'));
      [[r0 - dr * 3, c0 - dc * 3], [r0 + dr * 3, c0 + dc * 3]].forEach(([r, c]) => { if (inside(size, r, c)) ends.push(r * size + c); });
    }
  } else {
    const [dr, dc] = pick(rnd, DIRS), off = randInt(rnd, 0, k - 1);
    const w1 = windowFrom(size, k, r0 - dr * off, c0 - dc * off, dr, dc);
    if (!w1 || !w1.every(free)) return null;
    shuffle(rnd, w1).slice(0, k - 2).forEach(i => marks.set(i, 'X'));
    const sr = (w1[0] / size) | 0, sc = w1[0] % size;
    [[sr - dr, sc - dc], [sr + dr * k, sc + dc * k]].forEach(([r, c]) => { if (inside(size, r, c)) ends.push(r * size + c); });
    // extra player marks on a crossing line through one of the line's cells
    const cross = pick(rnd, w1), [er, ec] = pick(rnd, DIRS.filter(d => d[0] !== dr || d[1] !== dc));
    const cr = (cross / size) | 0, cc = cross % size, w2 = [];
    for (let s = -2; s <= 2; s++) {
      const r = cr + er * s, c = cc + ec * s, i = r * size + c;
      if (s && inside(size, r, c) && free(i) && !marks.has(i)) w2.push(i);
    }
    for (const i of shuffle(rnd, w2)) { if (marks.size >= half) break; marks.set(i, 'X'); }
  }
  if (marks.size > half) return null;
  return { marks, anchor: [r0, c0], ends };
}

/**
 * Puzzle marks: the player's shape (see above) plus the same number of
 * machine marks, some of them closing line ends so longer puzzles appear,
 * the rest nearby. Returns the preset list, or null if there is no room.
 */
function placePreset(rnd, size, k, total, board) {
  const free = i => board[i] === null;
  const half = total / 2;
  for (let tryNo = 0; tryNo < 12; tryNo++) {
    const shape = playerShape(rnd, size, k, half, free);
    if (!shape) continue;
    const { marks, anchor: [r0, c0] } = shape;
    // fill up the player's marks near the anchor if the shape used fewer
    const near = r => {
      const out = [];
      for (let rr = r0 - r; rr <= r0 + r; rr++) for (let cc = c0 - r; cc <= c0 + r; cc++) {
        const i = rr * size + cc;
        if (inside(size, rr, cc) && free(i) && !marks.has(i)) out.push(i);
      }
      return out;
    };
    for (const i of shuffle(rnd, near(3))) { if (marks.size >= half) break; marks.set(i, 'X'); }
    let o = 0;
    const ends = shape.ends.filter(i => free(i) && !marks.has(i));
    if (ends.length && rnd() < 0.6) { marks.set(pick(rnd, ends), 'O'); o++; }
    for (const i of shuffle(rnd, near(3))) { if (o >= half) break; marks.set(i, 'O'); o++; }
    if (o < half || marks.size !== total) continue;
    return [...marks].map(([i, m]) => ({ i, m })).sort((a, b) => a.i - b.i);
  }
  return null;
}

/**
 * Raw layout for one attempt (no validation). `level` needs
 * { size, winLength, boss }. Returns null when the marks don't fit.
 */
export function buildLayout(n, level, type, attempt = 0) {
  if (type === 'none') return null;
  const rnd = mulberry32(n + SEED_STEP * attempt);
  const { size, winLength: k, boss } = level;
  const board = Array(size * size).fill(null);
  let blocked = [];
  if (type === 'blocked' || type === 'mixed') {
    let [lo, hi] = BLOCKED_COUNTS[size];
    if (type === 'mixed') hi = Math.ceil((lo + hi) / 2); // leave room for the marks
    blocked = placeBlocked(rnd, size, boss ? hi : randInt(rnd, lo, hi));
    blocked.forEach(i => { board[i] = '#'; });
  }
  let preset = [];
  if (type === 'puzzle' || type === 'mixed') {
    const [lo, hi] = PRESET_COUNTS[size];
    const total = boss ? hi : lo + 2 * randInt(rnd, 0, (hi - lo) / 2);
    preset = placePreset(rnd, size, k, total, board);
    if (!preset) return null;
  }
  return { blocked, preset, puzzleMoves: null };
}

/**
 * The layout a level plays with: a hand-crafted boss override, else the
 * attempt saved in the twist table. Returns { type, layout } (layout null
 * for a normal level).
 */
export function generateLayout(n, level) {
  const o = overrideLayout(n);
  if (o && o.size === level.size) {
    const layout = { blocked: o.blocked, preset: o.preset, puzzleMoves: o.puzzleMoves };
    return { type: typeOfLayout(layout), layout };
  }
  const entry = TWIST_TABLE[n];
  if (!entry) return { type: 'none', layout: null };
  const [code, attempt, moves = null] = entry;
  const type = TYPE_CODES[code];
  const layout = buildLayout(n, level, type, attempt);
  if (!layout) return { type: 'none', layout: null }; // table out of date: play it as a normal level
  layout.puzzleMoves = layout.preset.length ? moves : null;
  return { type, layout };
}

/** Twist type of a layout. */
export const typeOfLayout = l => (!l ? 'none' : l.preset.length && l.blocked.length ? 'mixed' : l.preset.length ? 'puzzle' : l.blocked.length ? 'blocked' : 'none');
