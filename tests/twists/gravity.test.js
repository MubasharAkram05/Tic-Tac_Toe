import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, legalMoves, seed, playOut, withSnapshots, playAll } from './helpers.js';
import { BLOCKED } from '../../js/core/board.js';
import { floatingMarks } from '../../js/core/layout-validator.js';

const G = (extra = {}) => ({ twists: ['gravity'], gravity: true, ...extra });

test('gravity: a tap anywhere in a column drops to the lowest free cell', () => {
  const s = createState(6, G());
  assert.equal(applyMove(s, 2, 'X').cell, 32);     // top row tap -> bottom
  assert.equal(applyMove(s, 14, 'O').cell, 26);    // middle tap -> on top of X
  assert.equal(s.board[32], 'X');
  assert.equal(s.board[26], 'O');
});

test('gravity: blocked cells are the floor; a full column can not be played', () => {
  const s = createState(5, G({ blocked: [21] })); // column 1, bottom row blocked
  assert.equal(applyMove(s, 1, 'X').cell, 16);
  playAll(s, [1, 1, 1], 'O');
  assert.equal(applyMove(s, 1, 'X'), null, 'column is full');
  assert.equal(s.board[21], BLOCKED);
  assert.equal(legalMoves(s).length, 4, 'one landing cell per open column');
});

test('gravity: four stacked in a column win', () => {
  const s = createState(6, G());
  playAll(s, [0, 1, 0, 1, 0, 1]);
  assert.ok(applyMove(s, 0, 'X').line);
});

test('gravity: undo removes the dropped mark', () => {
  const s = createState(6, G());
  const snaps = withSnapshots(s, [3, 3]);
  assert.equal(snaps[1].board[33], 'X');
  assert.equal(snaps[1].board[27], null);
});

test('gravity: the AI only picks landing cells (columns), never floating ones', () => {
  seed(7);
  for (const levels of [['hard', 'medium'], ['easy', 'hard'], [0.5, 0.9]]) {
    const { state } = playOut(7, G({ blocked: [44, 47] }), levels);
    assert.deepEqual(floatingMarks(state.board, 7), []);
  }
});

test('gravity + puzzle: the validator finds floating preset marks', () => {
  const board = Array(25).fill(null);
  board[12] = 'X'; // middle cell, nothing under it
  assert.deepEqual(floatingMarks(board, 5), [12]);
  board[17] = 'O'; board[22] = 'X';
  assert.deepEqual(floatingMarks(board, 5), []);
});
