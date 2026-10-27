import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, CHAPTERS, TOTAL_LEVELS, chapterOf, isBoss, tableMatchesRules } from '../js/config/levels.js';
import { REWARDS } from '../js/config/constants.js';

const all = Array.from({ length: TOTAL_LEVELS }, (_, i) => getLevel(i + 1));

test('200 levels in 10 chapters with no gaps', () => {
  assert.equal(all.length, 200);
  assert.equal(CHAPTERS.length, 10);
  assert.equal(CHAPTERS[0].from, 1);
  assert.equal(CHAPTERS[9].to, 200);
  for (let i = 1; i < CHAPTERS.length; i++) assert.equal(CHAPTERS[i].from, CHAPTERS[i - 1].to + 1);
});

test('chapter table matches the win rules', () => {
  assert.ok(tableMatchesRules());
  assert.equal(chapterOf(1).size, 3);
  assert.equal(chapterOf(37).size, 5);
  assert.equal(chapterOf(200).size, 12);
});

test('AI skill rises from 40% to 90% and never reaches 100%', () => {
  all.forEach(l => assert.ok(l.aiSkill >= 0.4 && l.aiSkill <= 0.9, `level ${l.id}: ${l.aiSkill}`));
  CHAPTERS.forEach(c => assert.equal(getLevel(c.from).aiSkill, 0.4));
});

test('every 10th level is a boss with top skill, AI first and a timer', () => {
  const bosses = all.filter(l => l.boss);
  assert.equal(bosses.length, 20);
  bosses.forEach(l => {
    assert.ok(isBoss(l.id));
    assert.equal(l.aiSkill, 0.9);
    assert.equal(l.firstMove, 'ai');
    assert.ok(l.timeLimit > 0);
  });
});

test('timers are off in the early levels of every chapter', () => {
  CHAPTERS.forEach(c => {
    for (let n = c.from; n < c.from + 3 && n <= c.to; n++) if (!isBoss(n)) assert.equal(getLevel(n).timeLimit, 0, `level ${n}`);
  });
  all.forEach(l => assert.ok(l.timeLimit === 0 || (l.timeLimit >= 10 && l.timeLimit <= 20), `level ${l.id}: ${l.timeLimit}s`));
});

test('the player starts early levels, the AI later ones', () => {
  CHAPTERS.forEach(c => assert.equal(getLevel(c.from).firstMove, 'player'));
  assert.equal(getLevel(15).firstMove, 'ai');
});

test('first clear reward = 10 + floor(n / 5), x3 for bosses', () => {
  assert.equal(getLevel(1).reward, 10);
  assert.equal(getLevel(37).reward, 10 + 7);
  assert.equal(getLevel(10).reward, (10 + 2) * REWARDS.bossMultiplier);
  assert.equal(getLevel(200).reward, (10 + 40) * 3);
});
