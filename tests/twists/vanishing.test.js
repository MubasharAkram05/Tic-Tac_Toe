import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, isDraw, seed, playOut, withSnapshots, playAll } from './helpers.js';
import { nextToVanish, limitFor, MOVE_CAP } from '../../js/core/twists/vanishing.js';

const V = { twists: ['vanish'] };

test('vanishing: limits are 3x3 = 3, 4x4 = 4, then win length + 2', () => {
  assert.equal(limitFor(3, 3), 3);
  assert.equal(limitFor(4, 4), 4);
  assert.equal(limitFor(5, 4), 6);
  assert.equal(limitFor(9, 5), 7);
});

test('vanishing: placing over the limit removes your oldest mark, in order', () => {
  const s = createState(4, V); // limit 4
  playAll(s, [0, 15, 5, 14, 10, 13, 3, 12]); // X: 0,5,10,3  O: 15,14,13,12
  assert.deepEqual(nextToVanish(s), [0, 15]);
  const r = applyMove(s, 6, 'X');
  assert.deepEqual(r.events, [{ type: 'vanish', cell: 0, mark: 'X' }]);
  assert.equal(s.board[0], null);
  assert.deepEqual(s.order.X, [5, 10, 3, 6]);
  applyMove(s, 9, 'O');
  assert.equal(s.board[15], null, "O's oldest goes next");
});

test('vanishing: the vanished mark does not count for the line', () => {
  const s = createState(4, V);
  // X: 0,1,2 then 4,8 (5 marks, limit 4): when X plays 3, mark 0 vanishes first
  playAll(s, [0, 12, 1, 13, 2, 7, 4, 11]);
  const r = applyMove(s, 3, 'X');
  assert.equal(r.events[0].cell, 0);
  assert.equal(r.line, null, '1 2 3 is only 3');
});

test('vanishing: 60 moves without a winner is a draw', () => {
  const s = createState(5, V);
  s.moves = MOVE_CAP - 1;
  assert.equal(isDraw(s), false);
  applyMove(s, 0, 'X');
  assert.equal(isDraw(s), true);
});

test('vanishing: undo brings the vanished mark back', () => {
  const s = createState(4, V);
  const snaps = withSnapshots(s, [0, 15, 5, 14, 10, 13, 3, 12, 6]);
  assert.equal(s.board[0], null);
  const before = snaps[8];
  assert.equal(before.board[0], 'X');
  assert.deepEqual(before.order.X, [0, 5, 10, 3]);
});

test('vanishing: the AI plays legal moves and the game always ends', () => {
  seed(8);
  for (const size of [4, 5, 6]) {
    const { result, moves } = playOut(size, V, ['hard', 'medium']);
    assert.ok(['X', 'O', 'draw'].includes(result));
    assert.ok(moves <= MOVE_CAP);
  }
});
