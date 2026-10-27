import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, seed, playOut, playAll, lineCount } from './line-helpers.js';

test('straight only: rows and columns win, diagonals do not', () => {
  const s = createState(6, { twists: ['lines'], rule: 'straight' });
  playAll(s, [0, 5, 7, 11, 14, 17]);
  assert.equal(applyMove(s, 21, 'X').line, null, 'a diagonal of 4 is no win');
  const t = createState(6, { twists: ['lines'], rule: 'straight' });
  playAll(t, [0, 30, 1, 31, 2, 32]);
  assert.deepEqual(applyMove(t, 3, 'X').line, [0, 1, 2, 3]);
});

test('diagonal only: diagonals win, rows and columns do not', () => {
  const s = createState(6, { twists: ['lines'], rule: 'diagonal' });
  playAll(s, [0, 30, 1, 31, 2, 32]);
  assert.equal(applyMove(s, 3, 'X').line, null);
  const t = createState(6, { twists: ['lines'], rule: 'diagonal' });
  playAll(t, [0, 5, 7, 11, 14, 17]);
  assert.deepEqual(applyMove(t, 21, 'X').line, [0, 7, 14, 21]);
});

test('line rule: only lines in the allowed directions are counted', () => {
  assert.equal(lineCount(6, 'straight'), 36);  // 6 rows x 3 + 6 columns x 3
  assert.equal(lineCount(6, 'diagonal'), 18);  // 9 + 9
});

test('line rule: the AI plays legal moves and knows the rule', () => {
  seed(6);
  playOut(6, { twists: ['lines'], rule: 'straight' });
  playOut(7, { twists: ['lines'], rule: 'diagonal' }, ['medium', 'hard']);
});
