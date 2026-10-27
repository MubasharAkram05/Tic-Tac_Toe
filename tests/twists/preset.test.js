import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, withSnapshots } from './helpers.js';
import { getLevel, TOTAL_LEVELS } from '../../js/config/levels.js';
import { PRESET_COUNTS, BOSS_OVERRIDES } from '../../js/config/level-twists.js';
import { createBoard } from '../../js/core/board.js';
import { validatePreset, isPuzzleSolvable, puzzleLength, winningCells } from '../../js/core/layout-validator.js';

const puzzles = Array.from({ length: TOTAL_LEVELS }, (_, i) => getLevel(i + 1)).filter(l => l.layout && l.layout.preset.length);

test('preset marks are part of the start state and undo never removes them', () => {
  const lv = puzzles[0], s = createState(lv.size, lv.layout);
  lv.layout.preset.forEach(p => assert.equal(s.board[p.i], p.m));
  const free = s.board.findIndex(v => v === null);
  const snaps = withSnapshots(s, [free]);
  lv.layout.preset.forEach(p => assert.equal(snaps[0].board[p.i], p.m));
  assert.equal(s.moves, 1, 'presets are not moves');
});

test('puzzles: fair marks, no win at the start, solvable in exactly N (2-4)', () => {
  assert.ok(puzzles.length >= 10);
  const lengths = new Set();
  puzzles.forEach(l => {
    const board = createBoard(l.size, l.layout), N = l.layout.puzzleMoves;
    const [lo, hi] = PRESET_COUNTS[l.size];
    if (!BOSS_OVERRIDES[l.id]) assert.ok(l.layout.preset.length >= lo && l.layout.preset.length <= hi, `level ${l.id} marks`);
    assert.equal(validatePreset(board, l.size, l.winLength), '', `level ${l.id}`);
    assert.ok(isPuzzleSolvable(board, l.size, l.winLength, N), `level ${l.id} solvable in ${N}`);
    assert.equal(winningCells(board, l.size, l.winLength, 'O').length, 0, `level ${l.id}: no instant loss`);
    assert.equal(l.firstMove, 'player');
    assert.equal(l.moveLimit, N);
    lengths.add(N);
  });
  assert.ok(lengths.has(2) && lengths.has(3), 'puzzle lengths vary');
});

test('puzzles only mix with blocked cells and coin cells', () => {
  puzzles.forEach(l => assert.ok(l.twists.every(id => ['puzzle', 'blocked', 'coins'].includes(id)), `level ${l.id}: ${l.twists}`));
});

test('an open three is a win in 2, never in 1', () => {
  const three = createBoard(9, { blocked: [], preset: [39, 40, 41].map(i => ({ i, m: 'X' })).concat([{ i: 0, m: 'O' }, { i: 8, m: 'O' }, { i: 80, m: 'O' }]) });
  assert.equal(puzzleLength(three, 9, 5), 2);
  const s = createState(9, { preset: [39, 40, 41].map(i => ({ i, m: 'X' })).concat([{ i: 0, m: 'O' }, { i: 8, m: 'O' }, { i: 80, m: 'O' }]) });
  assert.equal(applyMove(s, 42, 'X').line, null);
});
