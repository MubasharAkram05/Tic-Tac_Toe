import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, legalMoves, seed, playOut, withSnapshots, playAll } from './helpers.js';
import { maxRings, ringCells, shrinksIn } from '../../js/core/twists/shrinking.js';
import { BLOCKED } from '../../js/core/board.js';

const S = (rings = 2) => ({ twists: ['shrink'], shrink: { every: 8, warn: 2, rings } });
const centre8 = size => { const m = size >> 1; return [-1, 0, 1, 2].flatMap(d => [(m + d) * size + m - 1, (m + d) * size + m]); };

test('shrinking: never below win length + 2 (so 9x9 and up only)', () => {
  assert.equal(maxRings(7, 5), 0);
  assert.equal(maxRings(8, 5), 0);
  assert.equal(maxRings(9, 5), 1);
  assert.equal(maxRings(11, 5), 2);
  assert.equal(maxRings(12, 5), 2);
  const s = createState(9, S(5));
  assert.equal(s.shrink.max, 1, 'asking for more rings is capped');
});

test('shrinking: every 8 moves the empty outer ring is blocked; marks stay', () => {
  const s = createState(11, S(2));
  applyMove(s, 0, 'X');                   // a mark in the outer ring
  assert.equal(shrinksIn(s), 7);
  const moves = centre8(11).slice(0, 7);
  let r;
  moves.forEach((c, j) => { r = applyMove(s, c, j % 2 ? 'X' : 'O'); });
  assert.equal(s.moves, 8);
  assert.equal(r.events[0].type, 'shrink');
  const ring = ringCells(11, 0);
  assert.equal(s.board[0], 'X', 'the mark stays');
  assert.ok(ring.filter(i => i !== 0).every(i => s.board[i] === BLOCKED));
  assert.ok(!legalMoves(s).some(i => ring.includes(i)));
  assert.equal(shrinksIn(s), 8);
});

test('shrinking: warns 2 moves before and stops at the last ring', () => {
  const s = createState(9, S(1));
  playAll(s, [30, 31, 32, 39, 40, 41]);
  assert.equal(shrinksIn(s), 2);
  playAll(s, [48, 49]);
  assert.equal(s.shrink.rings, 1);
  assert.equal(shrinksIn(s), Infinity, 'no more rings on 9x9');
});

test('shrinking: undo re-opens the ring', () => {
  const s = createState(9, S(1));
  const snaps = withSnapshots(s, [30, 31, 32, 39, 40, 41, 48, 49]);
  assert.equal(s.shrink.rings, 1);
  assert.equal(snaps[7].shrink.rings, 0);
  assert.equal(snaps[7].board[0], null);
});

test('shrinking: the AI plays legal moves and prefers the centre', () => {
  seed(9);
  playOut(11, S(2), ['hard', 'medium']);
  playOut(9, S(1), ['medium', 'hard']);
});
