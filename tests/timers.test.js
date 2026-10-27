import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_TIMES, MIN_SECONDS, getMoveTime, getLevelMoveTime, levelMultiplier, baseTime } from '../js/config/timers.js';
import { BOARD_SIZES } from '../js/config/constants.js';
import { getLevel, CHAPTERS } from '../js/config/levels.js';

test('base (Medium) time for every board size', () => {
  assert.deepEqual(BASE_TIMES, { 3: 10, 4: 12, 5: 14, 6: 16, 7: 18, 8: 20, 9: 22, 10: 24, 11: 27, 12: 30 });
  BOARD_SIZES.forEach(n => assert.equal(getMoveTime(n, 'medium'), BASE_TIMES[n]));
});

test('difficulty multiplier: Easy x1.5, Medium x1, Hard x0.7 (min 7s)', () => {
  assert.equal(getMoveTime(3, 'easy'), 15);
  assert.equal(getMoveTime(3, 'medium'), 10);
  assert.equal(getMoveTime(3, 'hard'), 7);
  assert.equal(getMoveTime(12, 'easy'), 45);
  assert.equal(getMoveTime(12, 'medium'), 30);
  assert.equal(getMoveTime(12, 'hard'), 21);
  assert.equal(getMoveTime(11, 'easy'), Math.round(27 * 1.5)); // 40.5 -> 41
  BOARD_SIZES.forEach(n => {
    assert.ok(getMoveTime(n, 'easy') > getMoveTime(n, 'medium'));
    assert.ok(getMoveTime(n, 'medium') > getMoveTime(n, 'hard'));
    assert.ok(getMoveTime(n, 'hard') >= MIN_SECONDS);
    assert.ok(Number.isInteger(getMoveTime(n, 'easy')));
  });
});

test('vs Player uses the Medium time; unknown values fall back safely', () => {
  assert.equal(getMoveTime(7), 18);
  assert.equal(getMoveTime(7, 'nope'), 18);
  assert.equal(baseTime(13), 30);
});

test('level multiplier goes x1.5 -> x0.8, bosses x0.7', () => {
  assert.equal(levelMultiplier(0, false), 1.5);
  assert.equal(levelMultiplier(1, false), 0.8);
  assert.equal(levelMultiplier(0.5, false), 1.15);
  assert.equal(levelMultiplier(0, true), 0.7);
});

test('level times: first level x1.5, last normal level x0.8, bosses x0.7', () => {
  CHAPTERS.forEach(c => {
    const base = BASE_TIMES[c.size];
    const first = getLevel(c.normal[0]), last = getLevel(c.normal[c.normal.length - 1]);
    assert.equal(first.timeLimit, Math.round(base * 1.5), `chapter ${c.index + 1} first`);
    assert.equal(last.timeLimit, Math.max(MIN_SECONDS, Math.round(base * 0.8)), `chapter ${c.index + 1} last`);
    for (let n = c.from; n <= c.to; n++) {
      const lv = getLevel(n);
      assert.equal(lv.timeLimit, getLevelMoveTime(lv));
      if (lv.boss) assert.equal(lv.timeLimit, Math.max(MIN_SECONDS, Math.round(base * 0.7)), `boss ${n}`);
    }
  });
  // examples from the spec: 3x3 chapter 15s -> 8s, bosses 7s
  assert.equal(getLevel(1).timeLimit, 15);
  assert.equal(getLevel(19).timeLimit, 8);
  assert.equal(getLevel(10).timeLimit, 7);
  assert.equal(getLevel(500).timeLimit, 21);
});

test('later levels in a chapter never get more time; bigger grids get more time', () => {
  CHAPTERS.forEach(c => {
    for (let i = 1; i < c.normal.length; i++) {
      assert.ok(getLevel(c.normal[i]).timeLimit <= getLevel(c.normal[i - 1]).timeLimit, `level ${c.normal[i]}`);
    }
  });
  for (let i = 1; i < CHAPTERS.length; i++) {
    assert.ok(getLevel(CHAPTERS[i].from).timeLimit > getLevel(CHAPTERS[i - 1].from).timeLimit);
  }
});
