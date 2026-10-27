import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMove, seed, playOut, withSnapshots } from './helpers.js';
import { collectedBy } from '../../js/core/twists/coin-cells.js';
import { coinCellReward, finishLevel } from '../../js/services/progress.js';
import { save } from '../../js/services/storage.js';
import { getLevel } from '../../js/config/levels.js';

const layout = { twists: ['coins'], coins: [{ i: 5, kind: 'coin', amount: 5 }, { i: 10, kind: 'coin', amount: 5 }, { i: 12, kind: 'diamond', amount: 1 }] };

test('coin cells: playing there collects it (an event for the UI), for whoever plays', () => {
  const s = createState(5, layout);
  const r = applyMove(s, 5, 'X');
  assert.deepEqual(r.events, [{ type: 'coin', cell: 5, mark: 'X', kind: 'coin', amount: 5 }]);
  applyMove(s, 10, 'O');
  applyMove(s, 12, 'X');
  assert.deepEqual(collectedBy(s, 'X'), { coins: 5, diamonds: 1 });
  assert.deepEqual(collectedBy(s, 'O'), { coins: 5, diamonds: 0 });
  assert.equal(s.coins[5], undefined);
});

test('coin cells: undo gives the coin back', () => {
  const s = createState(5, layout);
  const snaps = withSnapshots(s, [5, 0]);
  assert.ok(snaps[0].coins[5]);
  assert.equal(snaps[0].collected.length, 0);
  assert.equal(s.collected.length, 1);
});

test('coin cells: paid only on a win and only on the first clear', () => {
  const bonus = { coins: 10, diamonds: 1 };
  assert.deepEqual(coinCellReward(bonus, true, true), { coins: 10, diamonds: 1 });
  assert.deepEqual(coinCellReward(bonus, true, false), { coins: 0, diamonds: 0 }, 'replay');
  assert.deepEqual(coinCellReward(bonus, false, true), { coins: 0, diamonds: 0 }, 'loss');
  assert.deepEqual(coinCellReward(null, true, true), { coins: 0, diamonds: 0 });
});

test('coin cells: finishLevel pays them on the first win, never on a replay or a loss', () => {
  save.reset();
  const lv = getLevel(25), bonus = { coins: 10, diamonds: 0 };
  const lost = finishLevel(lv, { outcome: 'lose', playerMoves: 3, bonus });
  assert.equal(lost.won, false);
  const c0 = save.data.coins;
  const first = finishLevel(lv, { outcome: 'win', playerMoves: 3, usedHelp: false, bonus });
  assert.equal(first.cellCoins, 10);
  assert.ok(save.data.coins - c0 >= first.base + first.starCoins + 10, 'coin cells were paid (achievements may add more)');
  const replay = finishLevel(lv, { outcome: 'win', playerMoves: 3, usedHelp: false, bonus });
  assert.equal(replay.cellCoins, 0);
  save.reset();
});

test('coin cells: the AI plays legal moves and never goes for a coin over a block', () => {
  seed(4);
  playOut(6, layout);
  // O must block X's three in a row even though a coin waits elsewhere
  const s = createState(5, { twists: ['coins'], coins: [{ i: 24, kind: 'coin', amount: 5 }] });
  [0, 1, 2].forEach(c => { s.board[c] = 'X'; s.order.X.push(c); });
  s.board[10] = 'O'; s.order.O.push(10);
  // classic AI handles coin levels
  return import('../../js/core/twist-ai.js').then(({ chooseStateMove }) => assert.equal(chooseStateMove(s, 'O', 'hard'), 3));
});
