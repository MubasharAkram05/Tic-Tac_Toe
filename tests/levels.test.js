import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, CHAPTERS, TOTAL_LEVELS, chapterOf, isBoss, tableMatchesRules } from '../js/config/levels.js';
import { REWARDS } from '../js/config/constants.js';

const all = Array.from({ length: TOTAL_LEVELS }, (_, i) => getLevel(i + 1));

test('500 levels in 10 chapters with no gaps', () => {
  assert.equal(TOTAL_LEVELS, 500);
  assert.equal(all.length, 500);
  assert.ok(all.every((l, i) => l && l.id === i + 1));
  assert.equal(getLevel(501), null);
  assert.equal(CHAPTERS.length, 10);
  assert.equal(CHAPTERS[0].from, 1);
  assert.equal(CHAPTERS[9].to, 500);
  for (let i = 1; i < CHAPTERS.length; i++) assert.equal(CHAPTERS[i].from, CHAPTERS[i - 1].to + 1);
});

test('chapter table: ranges, grids, win rules and names', () => {
  const expected = [
    [1, 20, 3, 3, 'Warm Up'], [21, 50, 4, 4, 'First Steps'], [51, 90, 5, 4, 'Getting Smart'],
    [91, 140, 6, 4, 'Tactician'], [141, 195, 7, 5, 'Big League'], [196, 250, 8, 5, 'Strategist'],
    [251, 305, 9, 5, 'Mastermind'], [306, 360, 10, 5, 'Grandmaster'], [361, 430, 11, 5, 'Legend'],
    [431, 500, 12, 5, 'Ultimate'],
  ];
  assert.deepEqual(CHAPTERS.map(c => [c.from, c.to, c.size, c.win, c.name]), expected);
  assert.ok(tableMatchesRules());
  assert.equal(chapterOf(37).size, 4);
  assert.equal(chapterOf(200).size, 8);
  assert.equal(chapterOf(500).size, 12);
  all.forEach(l => assert.equal(l.size, chapterOf(l.id).size));
});

test('AI skill rises from 40% to 90% (85% on 3x3) and is never perfect', () => {
  all.forEach(l => {
    const max = l.size === 3 ? 0.85 : 0.9;
    assert.ok(l.aiSkill >= 0.4 && l.aiSkill <= max && l.aiSkill < 1, `level ${l.id}: ${l.aiSkill}`);
  });
  CHAPTERS.forEach(c => {
    assert.equal(getLevel(c.from).aiSkill, 0.4);
    for (let n = c.from + 1; n <= c.to; n++) if (!isBoss(n) && !isBoss(n - 1)) assert.ok(getLevel(n).aiSkill >= getLevel(n - 1).aiSkill);
  });
});

test('every 10th level is a boss: top skill for its chapter, AI first (puzzle bosses: you first)', () => {
  const bosses = all.filter(l => l.boss);
  assert.equal(bosses.length, 50);
  assert.ok(all.every(l => l.boss === (l.id % 10 === 0)));
  bosses.forEach(l => {
    assert.ok(isBoss(l.id));
    assert.equal(l.aiSkill, l.size === 3 ? 0.85 : 0.9);
    const puzzle = !!(l.layout && l.layout.puzzleMoves);
    assert.equal(l.firstMove, puzzle ? 'player' : 'ai');
    assert.equal(l.moveLimit, puzzle ? l.layout.puzzleMoves : 0);
  });
});

test('the player starts early levels; the AI starts some later ones', () => {
  CHAPTERS.forEach(c => {
    for (let n = c.from; n < c.from + 3; n++) if (!isBoss(n)) assert.equal(getLevel(n).firstMove, 'player', `level ${n}`);
    const late = c.normal.slice(-8).map(getLevel).filter(l => !l.layout || !l.layout.puzzleMoves);
    assert.ok(late.some(l => l.firstMove === 'ai') && late.some(l => l.firstMove === 'player'), `chapter ${c.index + 1}`);
  });
});

test('coins: first clear = 10 + floor(n / 10), x3 for bosses', () => {
  assert.equal(REWARDS.replay, 2);
  assert.equal(REWARDS.perNewStar, 5);
  assert.equal(getLevel(1).reward, 10);
  assert.equal(getLevel(37).reward, 10 + 3);
  assert.equal(getLevel(10).reward, (10 + 1) * 3);
  assert.equal(getLevel(500).reward, (10 + 50) * 3);
  all.forEach(l => assert.equal(l.reward, (10 + Math.floor(l.id / 10)) * (l.boss ? 3 : 1)));
});
