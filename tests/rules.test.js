import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winFrom, winLength, other } from '../js/core/rules.js';
import { createBoard, markForMove } from '../js/core/board.js';

const put = (size, cells, mark = 'X') => {
  const b = createBoard(size);
  cells.forEach(i => { b[i] = mark; });
  return b;
};

test('win lengths follow the board size rules', () => {
  assert.equal(winLength(3), 3);
  [4, 5, 6].forEach(n => assert.equal(winLength(n), 4));
  [7, 8, 9, 10, 11, 12].forEach(n => assert.equal(winLength(n), 5));
});

test('3x3: row, column and both diagonals win', () => {
  assert.deepEqual(winFrom(put(3, [0, 1, 2]), 3, 1), [0, 1, 2]);
  assert.deepEqual(winFrom(put(3, [1, 4, 7]), 3, 7), [1, 4, 7]);
  assert.deepEqual(winFrom(put(3, [0, 4, 8]), 3, 4), [0, 4, 8]);
  assert.deepEqual(winFrom(put(3, [2, 4, 6]), 3, 2), [2, 4, 6]);
});

test('no win for two in a row or mixed marks', () => {
  assert.equal(winFrom(put(3, [0, 1]), 3, 1), null);
  const b = put(3, [0, 1]);
  b[2] = 'O';
  assert.equal(winFrom(b, 3, 2), null);
  assert.equal(winFrom(createBoard(3), 3, 0), null);
});

test('checks only from the last move: 4 in a row on 6x6, 5 on 12x12', () => {
  // 6x6 needs 4: cells 7, 8, 9, 10 in row 1
  assert.deepEqual(winFrom(put(6, [7, 8, 9, 10]), 6, 9), [7, 8, 9, 10]);
  assert.equal(winFrom(put(6, [7, 8, 9]), 6, 8), null);
  // 12x12 needs 5 on a diagonal
  const diag = [0, 13, 26, 39, 52];
  assert.deepEqual(winFrom(put(12, diag), 12, 26), diag);
  assert.equal(winFrom(put(12, diag.slice(0, 4)), 12, 26), null);
});

test('a row does not wrap around the board edge', () => {
  // 4x4: cells 2, 3 (end of row 0) and 4, 5 (start of row 1) are not a line
  assert.equal(winFrom(put(4, [2, 3, 4, 5]), 4, 3), null);
});

test('helpers', () => {
  assert.equal(other('X'), 'O');
  assert.equal(other('O'), 'X');
  assert.equal(markForMove(0, 'O'), 'O');
  assert.equal(markForMove(1, 'O'), 'X');
});
