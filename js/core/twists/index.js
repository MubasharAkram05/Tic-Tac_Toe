/**
 * Level twist engine (rule modifiers). Pure logic, no DOM, so it runs in
 * the page, in the AI worker and in Node tests.
 *
 * A game is a plain, cloneable `state`. Each twist is a small module in
 * this folder that can hook into the rules:
 *
 *   setup(state, layout)               add its data to a new state
 *   isPlayable(state, cell)            false = nobody can play this cell right now
 *   resolveMove(state, cell, api)      the cell a tap really lands on (gravity)
 *   afterMove(state, move, events)     effects after a move (vanish, melt, shrink, coins)
 *   getLineCells(state, start, dir, api)  the run of marks through `start` (wrap, line rule)
 *   allowsDir(state, dir)              false = lines in this direction never win (line rule)
 *   isDraw(state)                      true = the game is a draw (vanishing move cap)
 *
 * With no twists every hook falls back to the classic rules, so normal
 * games and twist-free levels play exactly as before.
 */
import { winLength } from '../../config/constants.js';
import { BLOCKED } from '../board.js';
import * as blocked from './blocked.js';
import * as preset from './preset.js';
import * as coins from './coin-cells.js';
import * as ice from './ice-cells.js';
import * as lines from './line-rule.js';
import * as wrap from './wrap.js';
import * as gravity from './gravity.js';
import * as vanish from './vanishing.js';
import * as shrink from './shrinking.js';

/** Hook order matters: line rule before wrap (a banned direction never wraps), gravity before the rest. */
export const MODULES = { blocked, puzzle: preset, ice, coins, lines, wrap, gravity, vanish, shrink };
export const ORDER = ['blocked', 'puzzle', 'ice', 'coins', 'lines', 'wrap', 'gravity', 'vanish', 'shrink'];
export const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // horizontal, vertical, two diagonals

const mods = s => s.twists.map(id => MODULES[id]);

/** Which twists a layout turns on (blocked / puzzle come from their cell lists). */
export function twistsOf(layout) {
  if (!layout) return [];
  const on = new Set(layout.twists || []);
  if (layout.blocked && layout.blocked.length) on.add('blocked');
  if (layout.preset && layout.preset.length) on.add('puzzle');
  return ORDER.filter(id => on.has(id));
}

/** New game state for a board size and an optional level layout. */
export function createState(size, layout = null) {
  const s = {
    size, k: winLength(size),
    board: Array(size * size).fill(null),
    twists: twistsOf(layout),
    moves: 0,               // moves played (preset marks don't count)
    last: -1,
    order: { X: [], O: [] }, // each side's marks, oldest first (vanishing marks)
  };
  mods(s).forEach(m => m.setup && m.setup(s, layout));
  return s;
}

/** Deep copy of a state (plain arrays / objects only). Used for undo snapshots and AI search. */
export function cloneState(v) {
  if (Array.isArray(v)) return v.map(cloneState);
  if (v && typeof v === 'object') {
    const out = {};
    for (const key in v) out[key] = cloneState(v[key]);
    return out;
  }
  return v;
}

/* ---------- Cells and moves ---------- */

/** Empty, and no twist forbids it (blocked, frozen...). */
export function isPlayable(s, i) {
  if (i < 0 || i >= s.board.length || s.board[i] !== null) return false;
  for (const m of mods(s)) if (m.isPlayable && m.isPlayable(s, i) === false) return false;
  return true;
}

/** Steps one cell along `dir` (classic: stop at the edge). Wrap replaces it. */
export function plainStep(s, i, dr, dc) {
  const r = ((i / s.size) | 0) + dr, c = (i % s.size) + dc;
  return r < 0 || r >= s.size || c < 0 || c >= s.size ? -1 : r * s.size + c;
}

/** Cells in a row of the same mark through `start` along `dir`, using `step` to move. */
export function walkRun(s, start, [dr, dc], step = plainStep) {
  const v = s.board[start];
  if (v !== 'X' && v !== 'O') return [];
  const cells = [start], seen = new Set(cells);
  for (let p = step(s, start, dr, dc); p >= 0 && s.board[p] === v && !seen.has(p) && cells.length < s.size; p = step(s, p, dr, dc)) { cells.push(p); seen.add(p); }
  for (let p = step(s, start, -dr, -dc); p >= 0 && s.board[p] === v && !seen.has(p) && cells.length < s.size; p = step(s, p, -dr, -dc)) { cells.unshift(p); seen.add(p); }
  return cells;
}

/** Helpers handed to hooks (so modules don't import each other). */
export const API = {
  walk: walkRun,
  /** Playable, ignoring gravity (gravity uses it to find where a mark lands). */
  isOpen: (s, i) => {
    if (i < 0 || i >= s.board.length || s.board[i] !== null) return false;
    for (const m of mods(s)) if (m !== gravity && m.isPlayable && m.isPlayable(s, i) === false) return false;
    return true;
  },
};

/** The run of marks through `start` along `dir`, after the twists (line rule, wrap) have their say. */
export function getLineCells(s, start, dir) {
  for (const m of mods(s)) {
    if (!m.getLineCells) continue;
    const cells = m.getLineCells(s, start, dir, API);
    if (cells) return cells;
  }
  return walkRun(s, start, dir);
}

/** Directions that can win (line rule). */
export const directions = s => DIRS.filter(d => mods(s).every(m => !m.allowsDir || m.allowsDir(s, d)));

/** Win check from the last move only. Returns the winning cells in order, or null. O(k) per direction. */
export function winFrom(s, i) {
  for (const d of directions(s)) {
    const cells = getLineCells(s, i, d);
    if (cells.length >= s.k) return cells;
  }
  return null;
}

/** The cell a tap at `tapped` really lands on, or -1 if it can't be played. */
export function resolveMove(s, tapped) {
  let c = tapped;
  for (const m of mods(s)) {
    if (!m.resolveMove) continue;
    c = m.resolveMove(s, c, API);
    if (c < 0) return -1;
  }
  return isPlayable(s, c) ? c : -1;
}

/** Every distinct cell a move can land on right now (with gravity: one per column). */
export function legalMoves(s) {
  const out = [];
  if (s.gravity) {
    for (let c = 0; c < s.size; c++) { const m = resolveMove(s, c); if (m >= 0) out.push(m); }
    return out;
  }
  for (let i = 0; i < s.board.length; i++) if (isPlayable(s, i)) out.push(i);
  return out;
}

/**
 * Plays `mark` at `tapped` (mutates the state). Runs every afterMove hook,
 * then checks for a win from the landing cell.
 * Returns { cell, line, events } or null if the move is not allowed.
 * events: [{ type: 'coin' | 'vanish' | 'melt' | 'shrink', ... }] for the UI.
 */
export function applyMove(s, tapped, mark) {
  const cell = resolveMove(s, tapped);
  if (cell < 0) return null;
  s.board[cell] = mark;
  s.order[mark].push(cell);
  s.moves++;
  s.last = cell;
  const events = [];
  for (const m of mods(s)) if (m.afterMove) m.afterMove(s, { cell, mark }, events);
  return { cell, line: s.board[cell] === mark ? winFrom(s, cell) : null, events };
}

/* ---------- Lines and draws ---------- */

const windowCache = {};

/**
 * Every winning line of length k under the level's rules (allowed
 * directions, wrap). Cached per rule set. About 4n windows.
 */
export function lineWindows(s) {
  const dirs = directions(s), step = s.wrap ? wrap.step : plainStep;
  const key = `${s.size}:${s.k}:${dirs.map(d => d.join('')).join('|')}:${!!s.wrap}`;
  if (windowCache[key]) return windowCache[key];
  const out = [], seen = new Set();
  for (const [dr, dc] of dirs) {
    for (let i = 0; i < s.size * s.size; i++) {
      const w = [i];
      for (let p = i; w.length < s.k;) { p = step(s, p, dr, dc); if (p < 0 || w.includes(p)) break; w.push(p); }
      if (w.length < s.k) continue;
      const id = [...w].sort((a, b) => a - b).join(',') + ':' + dr + dc;
      if (!seen.has(id)) { seen.add(id); out.push(w); }
    }
  }
  return (windowCache[key] = out);
}

/** True if `mark` still has a line with no opponent mark and no blocked cell (frozen cells count as open). */
export function canStillWin(s, mark) {
  const opp = mark === 'X' ? 'O' : 'X';
  return lineWindows(s).some(w => w.every(i => s.board[i] !== opp && s.board[i] !== BLOCKED));
}

/**
 * Draw: a twist says so (vanishing move cap), no move is left, or - on
 * twist boards without vanishing - nobody can make a line any more.
 * With no twists this is exactly "the board is full".
 */
export function isDraw(s) {
  for (const m of mods(s)) if (m.isDraw && m.isDraw(s)) return true;
  if (!legalMoves(s).length && !Object.keys(s.ice || {}).length) return true;
  if (!s.twists.length || s.vanish) return false;
  return !canStillWin(s, 'X') && !canStillWin(s, 'O');
}

/** Who has to move (X starts unless told otherwise) is up to the caller; this is the other mark. */
export const other = mark => (mark === 'X' ? 'O' : 'X');
