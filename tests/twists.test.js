import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, TOTAL_LEVELS, CHAPTERS, isBoss } from '../js/config/levels.js';
import { BLOCKED_COUNTS, PRESET_COUNTS, BOSS_OVERRIDES, overrideLayout } from '../js/config/level-twists.js';
import { TWIST_TABLE } from '../js/config/twist-table.js';
import { buildLayout, generateLayout } from '../js/core/layout-generator.js';
import { validateLayout, validateBlocked, validatePreset, isPuzzleSolvable, puzzleLength, winningCells } from '../js/core/layout-validator.js';
import { createBoard, BLOCKED } from '../js/core/board.js';
import { winFrom, isDeadBoard, canStillWin } from '../js/core/rules.js';
import { chooseMove } from '../js/core/ai.js';
import { mulberry32 } from '../js/utils/seeded-random.js';
import { tableEntries, baseLevel } from '../tools/twist-plan.js';

const all = Array.from({ length: TOTAL_LEVELS }, (_, i) => getLevel(i + 1));

test('mulberry32: same seed = same numbers, different seed = different numbers', () => {
  const a = mulberry32(37), b = mulberry32(37), c = mulberry32(38);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  sa.forEach(x => assert.ok(x >= 0 && x < 1));
});

test('twist table is up to date (run `npm run twists` after changing levels or twists)', () => {
  const { table } = tableEntries();
  assert.deepEqual(table, Object.fromEntries(Object.entries(TWIST_TABLE).map(([n, e]) => [n, e])));
});

test('every level with a twist has a valid layout', () => {
  all.forEach(l => {
    if (l.twist === 'none') { assert.equal(l.layout, null, `level ${l.id}`); return; }
    assert.equal(validateLayout(l.layout, l), '', `level ${l.id} (${l.twist})`);
  });
});

test('same level = same layout, every time', () => {
  for (const n of [55, 137, 222, 313, 444, 499]) {
    const lv = baseLevel(n);
    const a = generateLayout(n, lv), b = generateLayout(n, lv);
    assert.deepEqual(a, b);
    assert.deepEqual(buildLayout(n, lv, 'mixed', 3), buildLayout(n, lv, 'mixed', 3));
  }
});

test('distribution: none in chapters 1-2, ~30% blocked in 3-5, a mix in 6-10, bosses always twisted', () => {
  CHAPTERS.forEach(c => {
    const normal = c.normal.map(getLevel), share = t => normal.filter(l => l.twist === t).length / normal.length;
    if (c.index < 2) { assert.ok(normal.every(l => l.twist === 'none')); return; }
    if (c.index < 5) {
      assert.ok(share('blocked') >= 0.15 && share('blocked') <= 0.45, `ch ${c.index + 1} blocked ${share('blocked')}`);
      assert.equal(share('puzzle') + share('mixed'), 0);
    } else {
      assert.ok(share('blocked') >= 0.15 && share('blocked') <= 0.45, `ch ${c.index + 1} blocked ${share('blocked')}`);
      assert.ok(share('puzzle') >= 0.08 && share('puzzle') <= 0.32, `ch ${c.index + 1} puzzle ${share('puzzle')}`);
      assert.ok(share('mixed') >= 0.02 && share('mixed') <= 0.2, `ch ${c.index + 1} mixed ${share('mixed')}`);
    }
  });
  all.filter(l => l.boss && l.chapter >= 2).forEach(l => assert.notEqual(l.twist, 'none', `boss ${l.id}`));
  all.filter(l => l.chapter < 2).forEach(l => assert.equal(l.twist, 'none'));
});

test('the same twist is not back to back all the time', () => {
  let same = 0, pairs = 0;
  for (let n = 2; n <= TOTAL_LEVELS; n++) {
    const a = getLevel(n - 1).twist, b = getLevel(n).twist;
    if (a !== 'none' && b !== 'none') { pairs++; if (a === b) same++; }
  }
  assert.ok(same < 50, `${same} repeats`);
  assert.ok(pairs > 0);
});

test('blocked cell counts follow the grid table', () => {
  all.filter(l => l.layout && !BOSS_OVERRIDES[l.id]).forEach(l => {
    const [lo, hi] = BLOCKED_COUNTS[l.size] || [0, 0], n = l.layout.blocked.length;
    if (l.twist === 'blocked') assert.ok(n >= lo && n <= hi, `level ${l.id}: ${n}`);
    if (l.twist === 'mixed') assert.ok(n >= lo && n <= hi, `level ${l.id}: ${n}`);
    if (l.twist === 'puzzle') assert.equal(n, 0);
  });
});

test('puzzles: fair marks, no win at the start, solvable in exactly N (2-4)', () => {
  const lengths = new Set();
  all.filter(l => l.layout && l.layout.preset.length).forEach(l => {
    const board = createBoard(l.size, l.layout), N = l.layout.puzzleMoves;
    const [lo, hi] = PRESET_COUNTS[l.size];
    if (!BOSS_OVERRIDES[l.id]) assert.ok(l.layout.preset.length >= lo && l.layout.preset.length <= hi, `level ${l.id} marks`);
    assert.equal(validatePreset(board, l.size, l.winLength), '', `level ${l.id}`);
    assert.ok(N >= 2 && N <= 4);
    assert.ok(isPuzzleSolvable(board, l.size, l.winLength, N), `level ${l.id} solvable in ${N}`);
    assert.equal(winningCells(board, l.size, l.winLength, 'O').length, 0, `level ${l.id}: no instant loss`);
    assert.equal(l.firstMove, 'player');
    assert.equal(l.moveLimit, N);
    lengths.add(N);
  });
  assert.ok(lengths.has(2) && lengths.has(3), 'puzzle lengths vary');
});

test('no level starts with a win', () => {
  all.filter(l => l.layout).forEach(l => {
    const board = createBoard(l.size, l.layout);
    board.forEach((v, i) => { if (v === 'X' || v === 'O') assert.equal(winFrom(board, l.size, i), null, `level ${l.id}`); });
  });
});

test('hand-crafted boss overrides win over generated layouts', () => {
  for (const n of Object.keys(BOSS_OVERRIDES).map(Number)) {
    const o = overrideLayout(n), l = getLevel(n);
    assert.equal(o.size, l.size, `override ${n} size`);
    assert.deepEqual(l.layout.blocked, o.blocked);
    assert.deepEqual(l.layout.preset, o.preset);
    assert.equal(validateLayout(l.layout, l), '', `override ${n}`);
  }
});

test('engine: blocked cells break lines and are never chosen by the AI', () => {
  // 5x5, 4 in a row: X X # X X on row 0 is not a win
  const b = createBoard(5, { blocked: [2], preset: [] });
  [0, 1, 3, 4].forEach(i => { b[i] = 'X'; });
  [0, 1, 3, 4].forEach(i => assert.equal(winFrom(b, 5, i), null));
  assert.equal(winFrom(b, 5, 2), null);
  // AI never plays a blocked cell, even when everything else is full
  const lv = getLevel(all.find(l => l.twist === 'blocked').id);
  for (const level of ['easy', 'medium', 'hard', 0.5]) {
    const board = createBoard(lv.size, lv.layout);
    for (let t = 0; t < 6; t++) {
      const m = chooseMove(board, lv.size, t % 2 ? 'X' : 'O', level);
      assert.ok(board[m] === null, `${level}: picked ${board[m]}`);
      board[m] = t % 2 ? 'X' : 'O';
    }
  }
  // centre blocked on an empty board: the AI picks a free cell next to it
  const c = createBoard(5, { blocked: [12], preset: [] });
  assert.equal(c[chooseMove(c, 5, 'O', 'hard')], null);
});

test('engine: a board where nobody can make a line is a draw', () => {
  const size = 4, b = createBoard(size);
  assert.equal(isDeadBoard(b, size), false);
  // every row, column and diagonal holds both marks: nobody can make 4 any more
  ['XXOO', 'OOXX', 'XXOO', 'OOXX'].forEach((row, r) => [...row].forEach((m, c) => { b[r * size + c] = m; }));
  b[0] = null; // one empty cell left, still dead
  assert.equal(canStillWin(b, size, 'X') || canStillWin(b, size, 'O'), false);
  assert.equal(isDeadBoard(b, size), true);
  const full = createBoard(3, { blocked: [0, 1, 2, 3, 4, 5, 6, 7, 8], preset: [] });
  assert.equal(isDeadBoard(full, 3), true);
  assert.equal(full.includes(BLOCKED), true);
});

test('validators reject bad layouts', () => {
  const lv = baseLevel(301); // 9x9, 5 in a row
  // too many blocked cells
  const wall = { blocked: [...Array(9).keys()].map(c => 4 * 9 + c).concat([...Array(9).keys()].map(r => r * 9 + 4)).filter((v, i, a) => a.indexOf(v) === i && v !== 40), preset: [], puzzleMoves: null };
  assert.notEqual(validateLayout(wall, lv), '');
  // centre area blocked
  assert.notEqual(validateBlocked(createBoard(9, { blocked: [30, 40, 50], preset: [] }), 9, 5), '');
  // starts with a win / unfair counts / machine wins at once
  const win = createBoard(9, { blocked: [], preset: [0, 1, 2, 3, 4].map(i => ({ i, m: 'X' })) });
  assert.notEqual(validatePreset(win, 9, 5), '');
  const unfair = createBoard(9, { blocked: [], preset: [{ i: 0, m: 'X' }, { i: 1, m: 'X' }, { i: 20, m: 'O' }] });
  assert.match(validatePreset(unfair, 9, 5), /unfair/);
  const loss = createBoard(9, { blocked: [], preset: [10, 11, 12, 13].map(i => ({ i, m: 'O' })).concat([60, 62, 64, 66].map(i => ({ i, m: 'X' }))) });
  assert.match(validatePreset(loss, 9, 5), /machine/);
  // an open three is a win in 2, never in 1
  const three = createBoard(9, { blocked: [], preset: [39, 40, 41].map(i => ({ i, m: 'X' })).concat([{ i: 0, m: 'O' }, { i: 8, m: 'O' }, { i: 80, m: 'O' }]) });
  assert.equal(puzzleLength(three, 9, 5), 2);
});
