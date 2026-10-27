import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, legalMoves, seed, playOut, withSnapshots, playAll } from './helpers.js';
import { meltsIn } from '../../js/core/twists/ice-cells.js';

const layout = { twists: ['ice'], ice: [{ i: 12, melt: 4 }, { i: 13, melt: 6 }] };

test('ice: frozen cells can not be played until N moves in total', () => {
  const s = createState(5, layout);
  assert.equal(applyMove(s, 12, 'X'), null);
  assert.equal(meltsIn(s, 12), 4);
  playAll(s, [0, 1, 2]);
  assert.equal(meltsIn(s, 12), 1);
  assert.ok(!legalMoves(s).includes(12));
  const r = applyMove(s, 5, 'O'); // 4th move: cell 12 melts
  assert.deepEqual(r.events, [{ type: 'melt', cell: 12 }]);
  assert.ok(legalMoves(s).includes(12));
  assert.ok(!legalMoves(s).includes(13), 'the other one melts after 6');
  playAll(s, [20, 21]);
  assert.ok(legalMoves(s).includes(13));
});

test('ice: a frozen cell breaks a line until it melts', () => {
  const s = createState(5, { twists: ['ice'], ice: [{ i: 2, melt: 8 }] });
  playAll(s, [0, 10, 1, 11, 3, 15]);
  assert.equal(applyMove(s, 4, 'X').line, null);
});

test('ice: undo re-freezes a melted cell', () => {
  const s = createState(5, layout);
  const snaps = withSnapshots(s, [0, 1, 2, 3]);
  assert.equal(meltsIn(s, 12), 0);
  assert.equal(meltsIn(snaps[3], 12), 1);
});

test('ice: the AI never plays a frozen cell (with and without gravity)', () => {
  seed(5);
  playOut(6, { twists: ['ice'], ice: [{ i: 14, melt: 8 }, { i: 15, melt: 5 }, { i: 21, melt: 7 }] }, ['hard', 'easy']);
  playOut(6, { twists: ['ice', 'gravity'], gravity: true, ice: [{ i: 32, melt: 6 }, { i: 26, melt: 8 }] }, ['medium', 'hard']);
});

test('ice + gravity: ice is a floor until it melts', () => {
  const s = createState(6, { twists: ['ice', 'gravity'], gravity: true, ice: [{ i: 33, melt: 4 }] }); // bottom of column 3
  assert.equal(applyMove(s, 3, 'X').cell, 27, 'lands on the ice');
});
