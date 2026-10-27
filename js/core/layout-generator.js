/**
 * Builds a level's twist layout from its level number. Pure logic, no DOM.
 *
 * The same level always gets the same layout on every device: every random
 * choice comes from mulberry32(level + SEED_STEP * attempt).
 *
 * Layout format:
 *   {
 *     twists: ['blocked', 'coins', ...],          active twist ids (core/twists)
 *     blocked: [cell, ...],                        blocked cells
 *     preset: [{ i, m: 'X' | 'O' }],               puzzle marks
 *     puzzleMoves: N | null,                       puzzle goal (win in N)
 *     coins: [{ i, kind: 'coin' | 'diamond', amount }],
 *     ice: [{ i, melt }],                          frozen until `melt` moves were played
 *     rule: 'straight' | 'diagonal' | null,        line rule
 *     shrink: { every, warn, rings } | null,       shrinking board
 *     vanish: { limit, cap } | null,               vanishing marks
 *     gravity: true | undefined, wrap: true | undefined
 *   }
 *
 * At runtime nothing is validated (to keep the phone fast): the twists,
 * the attempt that passed validation and the puzzle length come from
 * config/twist-table.js, which tools/gen-twist-table.js writes and the
 * tests in tests/twists/ check for all 500 levels.
 */
import { mulberry32, randInt, pick, shuffle } from '../utils/seeded-random.js';
import {
  BLOCKED_COUNTS, PRESET_COUNTS, ICE_COUNTS, ICE_MELT, COIN_CELLS, COIN_VALUE, DIAMOND_VALUE, SHRINK,
  DIAGONAL_MIN_SIZE, SEED_STEP, TWIST_IDS, introOf, overrideLayout,
} from '../config/level-twists.js';
import { TWIST_TABLE, TWIST_CODES } from '../config/twist-table.js';
import { maxRings } from './twists/shrinking.js';
import { limitFor, MOVE_CAP } from './twists/vanishing.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Cells of the centre area: 3x3 on odd boards, 2x2 on even boards. */
export function centreArea(size) {
  const mid = (size - 1) / 2, out = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1) out.push(r * size + c);
  }
  return out;
}

/**
 * Blocked cells: spread out (no two touching), never in the centre area.
 * With gravity they only go in the bottom three rows (a raised floor), so
 * no column is cut off high up.
 */
function placeBlocked(rnd, size, count, gravity = false) {
  const centre = new Set(centreArea(size)), taken = new Set(), out = [];
  const touches = i => out.some(j => Math.abs(((i / size) | 0) - ((j / size) | 0)) <= 1 && Math.abs((i % size) - (j % size)) <= 1);
  for (const i of shuffle(rnd, [...Array(size * size).keys()])) {
    if (out.length >= count) break;
    if (centre.has(i) || taken.has(i) || touches(i) || (gravity && ((i / size) | 0) < size - 3)) continue;
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

/** Free cells (not blocked, preset, ice or coin yet), optionally inside the area left after `ring` rings close. */
function freeCells(size, used, ring = 0) {
  const out = [];
  for (let i = 0; i < size * size; i++) {
    const r = (i / size) | 0, c = i % size;
    if (!used.has(i) && r >= ring && c >= ring && r < size - ring && c < size - ring) out.push(i);
  }
  return out;
}

/**
 * Raw layout for one attempt (no validation). `level` needs
 * { size, winLength, boss }; `twists` the planned ids. Intro levels (the
 * first level of a twist) get the gentlest version of it. Returns null
 * when something doesn't fit.
 */
export function buildLayout(n, level, twists, attempt = 0) {
  if (!twists.length) return null;
  const rnd = mulberry32(n + SEED_STEP * attempt);
  const { size, winLength: k, boss } = level, intro = !!introOf(n);
  const has = id => twists.includes(id);
  const board = Array(size * size).fill(null), used = new Set();
  const layout = { twists: TWIST_IDS.filter(has), blocked: [], preset: [], puzzleMoves: null, coins: [], ice: [], rule: null, shrink: null, vanish: null };

  if (has('blocked')) {
    let [lo, hi] = BLOCKED_COUNTS[size];
    if (has('puzzle')) hi = Math.ceil((lo + hi) / 2); // leave room for the marks
    layout.blocked = placeBlocked(rnd, size, intro ? lo : boss ? hi : randInt(rnd, lo, hi), has('gravity'));
    layout.blocked.forEach(i => { board[i] = '#'; used.add(i); });
  }
  if (has('puzzle')) {
    const [lo, hi] = PRESET_COUNTS[size];
    const total = boss ? hi : lo + 2 * randInt(rnd, 0, (hi - lo) / 2);
    layout.preset = placePreset(rnd, size, k, total, board);
    if (!layout.preset) return null;
    layout.preset.forEach(p => { board[p.i] = p.m; used.add(p.i); });
  }
  if (has('shrink')) {
    layout.shrink = { every: SHRINK.every, warn: SHRINK.warn, rings: boss ? maxRings(size, k) : 1 };
  }
  const safeRing = layout.shrink ? layout.shrink.rings : 0; // coins / ice stay inside the final area
  if (has('ice')) {
    const [lo, hi] = ICE_COUNTS[size], count = intro ? 2 : randInt(rnd, lo, hi);
    const cells = shuffle(rnd, freeCells(size, used, safeRing)).slice(0, count);
    if (cells.length < count) return null;
    layout.ice = cells.sort((a, b) => a - b).map(i => ({ i, melt: intro ? 6 : randInt(rnd, ICE_MELT[0], ICE_MELT[1]) })); // intro: long enough to notice
    cells.forEach(i => used.add(i));
  }
  if (has('coins')) {
    const count = intro ? 2 : randInt(rnd, COIN_CELLS[0], COIN_CELLS[1]);
    const cells = shuffle(rnd, freeCells(size, used, safeRing)).slice(0, count + (boss ? 1 : 0));
    if (cells.length < count) return null;
    layout.coins = cells.map((i, j) => (boss && j === 0 ? { i, kind: 'diamond', amount: DIAMOND_VALUE } : { i, kind: 'coin', amount: COIN_VALUE }))
      .sort((a, b) => a.i - b.i);
    cells.forEach(i => used.add(i));
  }
  if (has('lines')) layout.rule = !intro && size >= DIAGONAL_MIN_SIZE && rnd() < 0.35 ? 'diagonal' : 'straight';
  if (has('vanish')) layout.vanish = { limit: limitFor(size, k), cap: MOVE_CAP };
  if (has('gravity')) layout.gravity = true;
  if (has('wrap')) layout.wrap = true;
  return layout;
}

/**
 * The layout a level plays with: a hand-crafted boss override, else the
 * attempt saved in the twist table. Returns { twists, layout } (layout
 * null for a normal level).
 */
export function generateLayout(n, level) {
  const o = overrideLayout(n);
  if (o && o.size === level.size) {
    const { size, ...layout } = o;
    return { twists: layout.twists, layout };
  }
  const entry = TWIST_TABLE[n];
  if (!entry) return { twists: [], layout: null };
  const [codes, attempt, moves = null] = entry;
  const twists = [...codes].map(c => TWIST_CODES[c]);
  const layout = buildLayout(n, level, twists, attempt);
  if (!layout) return { twists: [], layout: null }; // table out of date: play it as a normal level
  layout.puzzleMoves = layout.preset.length ? moves : null;
  return { twists: layout.twists, layout };
}
