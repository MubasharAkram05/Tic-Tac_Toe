import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove } from '../js/core/ai.js';
import { winFrom } from '../js/core/rules.js';
import { createBoard, emptyCells } from '../js/core/board.js';
import { BOARD_SIZES } from '../js/config/constants.js';

/** Plays one full game. Each side is 'random' or an AI level. Returns 'X' | 'O' | 'draw'. */
function playGame(size, xLevel, oLevel, onMove) {
  const b = createBoard(size);
  let turn = 'X';
  for (let n = 0; n < b.length; n++) {
    const level = turn === 'X' ? xLevel : oLevel;
    const free = emptyCells(b);
    const t0 = performance.now();
    const m = level === 'random' ? free[(Math.random() * free.length) | 0] : chooseMove(b, size, turn, level);
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
