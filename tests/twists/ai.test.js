import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, playOut } from './helpers.js';
import { comboAllowed, MIN_SIZE } from '../../js/config/level-twists.js';
import { getLevel, TOTAL_LEVELS } from '../../js/config/levels.js';
import { needsTwistAI } from '../../js/core/twist-ai.js';
import { createState } from '../../js/core/twists/index.js';

/** A small layout for each twist (enough to switch it on). */
const PART = {
  coins: () => ({ coins: [{ i: 1, kind: 'coin', amount: 5 }, { i: 9, kind: 'coin', amount: 5 }] }),
  vanish: () => ({}),
  blocked: n => ({ blocked: [n * n - 1, n * n - n] }),
  ice: n => ({ ice: [{ i: n + 1, melt: 5 }, { i: 2 * n + 2, melt: 7 }] }),
  lines: () => ({ rule: 'straight' }),
  gravity: () => ({ gravity: true }),
  wrap: () => ({ wrap: true }),
  shrink: () => ({ shrink: { every: 8, warn: 2, rings: 1 } }),
};

function layoutFor(ids, size) {
  const l = { twists: ids, blocked: [], preset: [], coins: [], ice: [] };
  ids.forEach(id => Object.assign(l, PART[id](size)));
  return l;
}

test('AI never makes an illegal move under any twist', () => {
  seed(11);
  for (const id of Object.keys(PART)) {
    const size = Math.max(MIN_SIZE[id], 6);
    playOut(size, layoutFor([id], size), ['hard', 'medium']);
    playOut(size, layoutFor([id], size), ['easy', 0.7]);
  }
});

test('AI never makes an illegal move under every allowed pair of twists', () => {
  seed(12);
  const ids = Object.keys(PART);
  let pairs = 0;
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const pair = [ids[a], ids[b]];
    if (!comboAllowed(pair)) continue;
    const size = Math.max(MIN_SIZE[pair[0]], MIN_SIZE[pair[1]], 6);
    playOut(size, layoutFor(pair, size), ['medium', 'hard']);
    pairs++;
  }
  assert.ok(pairs >= 20, `${pairs} pairs`);
});

test('AI plays legal moves on real twist levels (a sample of 40)', () => {
  seed(13);
  const levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => getLevel(i + 1)).filter(l => l.layout && !l.layout.preset.length);
  for (let j = 0; j < levels.length; j += Math.ceil(levels.length / 40)) {
    const l = levels[j];
    // big boards: medium on both sides keeps the test fast (hard runs a 200ms search per move)
    playOut(l.size, l.layout, l.size >= 9 ? ['medium', 'medium'] : [l.aiSkill, 'hard'], 80);
  }
});

test('the classic AI keeps the levels whose rules are classic', () => {
  assert.equal(needsTwistAI(createState(6, { blocked: [1] })), false);
  assert.equal(needsTwistAI(createState(6, layoutFor(['coins'], 6))), false);
  assert.equal(needsTwistAI(createState(6, layoutFor(['gravity'], 6))), true);
  assert.equal(needsTwistAI(createState(6, null)), false);
});

test('same seed = same twist game', () => {
  const l = layoutFor(['gravity', 'ice'], 7);
  seed(5); const a = playOut(7, l, [0.6, 0.6]);
  seed(5); const b = playOut(7, l, [0.6, 0.6]);
  assert.deepEqual(a.state.board, b.state.board);
  assert.equal(a.result, b.result);
});
