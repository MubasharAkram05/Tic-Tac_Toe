import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, seed, playOut, playAll } from './helpers.js';
import { lineWindows } from '../../js/core/twists/index.js';
import { crossesEdge } from '../../js/core/twists/wrap.js';

const W = { twists: ['wrap'], wrap: true };

test('wrap: a row continues from the right edge to the left edge', () => {
  const s = createState(8, W);
  playAll(s, [22, 40, 23, 41, 16, 42, 17, 50]); // X at row 2: cols 6, 7, 0, 1
  const r = applyMove(s, 18, 'X');               // ... and col 2
  assert.deepEqual(r.line, [22, 23, 16, 17, 18]);
  assert.equal(crossesEdge(r.line, 8), true);
});

test('wrap: diagonals wrap too, columns do not wrap top to bottom', () => {
  const s = createState(8, W);
  // diagonal down-right from (0,6): (0,6) (1,7) (2,0) (3,1) (4,2)
  playAll(s, [6, 60, 15, 61, 16, 62, 25, 52]);
  assert.ok(applyMove(s, 34, 'X').line, 'wrapped diagonal wins');
  const t = createState(8, W);
  playAll(t, [48, 1, 56, 2, 0, 3, 8, 4]);     // column 0: rows 6, 7, 0, 1
  assert.equal(applyMove(t, 63, 'X').line, null);
  assert.equal(applyMove(t, 16, 'O').line, null, 'rows 6 7 0 1 2 is not a line');
});

test('wrap: more winning lines than the classic board', () => {
  const classic = lineWindows(createState(8, null)).length, wrapped = lineWindows(createState(8, W)).length;
  assert.equal(classic, 8 * 4 + 8 * 4 + 2 * 4 * 4);   // rows, columns, two diagonals
  assert.equal(wrapped, 8 * 8 + 8 * 4 + 2 * 4 * 8);   // rows start at every column; columns don't wrap
});

test('wrap: the AI plays legal moves and sees wrapped lines', () => {
  seed(10);
  playOut(8, W);
  // O must block X's wrapped four (cols 6, 7, 0, 1 on row 3): the gap is col 2 or col 5
  const s = createState(8, W);
  playAll(s, [30, 55, 31, 57, 24, 59, 25, 61]);
  return import('../../js/core/twist-ai.js').then(({ chooseStateMove }) => assert.ok([26, 29].includes(chooseStateMove(s, 'O', 'hard'))));
});
