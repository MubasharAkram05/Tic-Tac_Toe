import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, legalMoves, isDraw, seed, playOut, withSnapshots } from './helpers.js';
import { BLOCKED } from '../../js/core/board.js';

test('blocked cells: not playable and they break lines', () => {
  const s = createState(5, { blocked: [2] }); // 5x5, 4 in a row
  assert.equal(s.board[2], BLOCKED);
  assert.equal(applyMove(s, 2, 'X'), null);
  assert.ok(!legalMoves(s).includes(2));
  for (const c of [0, 1, 3]) applyMove(s, c, 'X');
  assert.equal(applyMove(s, 4, 'X').line, null, 'X X # X X is no line');
});

test('blocked cells: a board where nobody can make a line is a draw', () => {
  const s = createState(4, { blocked: [0] });
  ['XXOO', 'OOXX', 'XXOO', 'OOX.'].forEach((row, r) => [...row].forEach((m, c) => { if (m !== '.' && r * 4 + c) s.board[r * 4 + c] = m; }));
  assert.equal(isDraw(s), true);
});

test('blocked cells: undo restores the board', () => {
  const s = createState(6, { blocked: [7, 28] });
  const snaps = withSnapshots(s, [14, 15, 20]);
  assert.deepEqual(snaps[0].board.filter(Boolean), [BLOCKED, BLOCKED]);
});

test('blocked cells: the AI never plays a blocked cell', () => {
  seed(3);
  for (const level of ['easy', 'medium', 'hard', 0.6]) playOut(7, { blocked: [8, 16, 30, 40] }, [level, 'hard']);
});
