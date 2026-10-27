import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove, setRandom } from '../js/core/ai.js';
import { mulberry32 } from '../js/utils/seeded-random.js';
import { getLevel } from '../js/config/levels.js';
import { winFrom } from '../js/core/rules.js';
import { createBoard, emptyCells } from '../js/core/board.js';
import { BOARD_SIZES } from '../js/config/constants.js';

/*
 * Every test runs on seeded random numbers (the AI's and the 'random'
 * player's), so results are the same on every run.
 */
let rnd = mulberry32(1);
beforeEach(() => { rnd = mulberry32(1); setRandom(mulberry32(2)); });

/** Plays one full game. Each side is 'random' or an AI level. Returns 'X' | 'O' | 'draw'. */
function playGame(size, xLevel, oLevel, onMove) {
  const b = createBoard(size);
  let turn = 'X';
  for (let n = 0; n < b.length; n++) {
    const level = turn === 'X' ? xLevel : oLevel;
    const free = emptyCells(b);
    const t0 = performance.now();
    const m = level === 'random' ? free[(rnd() * free.length) | 0] : chooseMove(b, size, turn, level);
    if (onMove && level !== 'random') onMove(performance.now() - t0);
    assert.ok(Number.isInteger(m) && b[m] === null, `illegal move ${m}`);
    b[m] = turn;
    if (winFrom(b, size, m)) return turn;
    turn = turn === 'X' ? 'O' : 'X';
  }
  return 'draw';
}

test('takes a winning move', () => {
  const b = createBoard(3);
  b[0] = 'O'; b[1] = 'O'; b[3] = 'X'; b[4] = 'X';
  assert.equal(chooseMove(b, 3, 'O', 'medium'), 2);
  assert.equal(chooseMove(b, 3, 'O', 'hard'), 2);
});

test('blocks an immediate loss', () => {
  const b = createBoard(3);
  b[0] = 'X'; b[1] = 'X'; b[4] = 'O';
  assert.equal(chooseMove(b, 3, 'O', 'medium'), 2);
  assert.equal(chooseMove(b, 3, 'O', 'hard'), 2);
});

test('hard 3x3 never loses (200 games vs random, both sides)', () => {
  let losses = 0;
  for (let g = 0; g < 200; g++) {
    const aiIsX = g % 2 === 0;
    const r = playGame(3, aiIsX ? 'hard' : 'random', aiIsX ? 'random' : 'hard');
    if (r !== 'draw' && r !== (aiIsX ? 'X' : 'O')) losses++;
  }
  assert.equal(losses, 0);
});

test('every size: legal moves, and hard stays well under 300ms', () => {
  for (const size of BOARD_SIZES) {
    let worst = 0;
    playGame(size, 'hard', 'medium', ms => { worst = Math.max(worst, ms); });
    assert.ok(worst < 300, `${size}x${size} worst move took ${worst.toFixed(0)}ms`);
  }
});

test('numeric AI skill works (campaign levels)', () => {
  for (const skill of [0, 0.4, 0.9]) {
    const r = playGame(5, skill, 'random');
    assert.ok(['X', 'O', 'draw'].includes(r));
  }
});

/** Level 10 (3x3 boss, AI first, 85% skill) against a perfect player; returns the moves and result. */
function playLevel10(seed) {
  const lv = getLevel(10), b = createBoard(lv.size), moves = [];
  setRandom(mulberry32(seed));
  let turn = 'O'; // the machine (O) starts boss levels; the player is X
  for (let n = 0; n < b.length; n++) {
    const m = chooseMove(b, lv.size, turn, turn === 'O' ? lv.aiSkill : 'hard');
    b[m] = turn;
    moves.push(m);
    if (winFrom(b, lv.size, m)) return { moves, result: turn };
    turn = turn === 'X' ? 'O' : 'X';
  }
  return { moves, result: 'draw' };
}

test('level 10 is deterministic with a seeded AI (same seed = same game)', () => {
  const lv = getLevel(10);
  assert.equal(lv.boss, true);
  assert.equal(lv.firstMove, 'ai');
  const seeds = [1, 7, 15, 21, 42];
  for (const seed of seeds) {
    const a = playLevel10(seed), b = playLevel10(seed);
    assert.deepEqual(a, b, `seed ${seed}`);
    assert.notEqual(a.result, 'O', `seed ${seed}: a perfect player never loses`);
  }
  // known results for fixed seeds: these must never change between runs
  assert.deepEqual(seeds.map(s => playLevel10(s).result), ['draw', 'draw', 'X', 'X', 'draw']);
});
