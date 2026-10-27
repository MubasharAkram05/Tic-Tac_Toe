/**
 * Campaign levels: 200 levels generated from a small chapter table.
 * Pure data + functions (no DOM).
 */
import { winLength, REWARDS } from './constants.js';

// [first level, last level, board size, win length, chapter name]
const TABLE = [
  [1, 15, 3, 3, 'Warm Up'],
  [16, 35, 4, 4, 'First Steps'],
  [36, 60, 5, 4, 'Wide Open'],
  [61, 85, 6, 4, 'Six Sense'],
  [86, 105, 7, 5, 'High Five'],
  [106, 125, 8, 5, 'Eight Lanes'],
  [126, 145, 9, 5, 'Nine Lives'],
  [146, 165, 10, 5, 'Big Ten'],
  [166, 185, 11, 5, 'Eleventh Hour'],
  [186, 200, 12, 5, 'Grand Master'],
];

export const TOTAL_LEVELS = 200;

export const CHAPTERS = TABLE.map(([from, to, size, win, name], index) => ({
  index, from, to, size, win, name, count: to - from + 1,
}));

export const chapterOf = n => CHAPTERS.find(c => n >= c.from && n <= c.to);
export const isBoss = n => n % 10 === 0;

const cache = [];

/**
 * Builds level n. Inside a chapter, t goes 0 -> 1 and difficulty rises with it:
 * - AI skill 40% -> 90% (chance it plays its best move; never 100%)
 * - the AI starts first in the later part of a chapter
 * - a move timer appears in the second half of a chapter (off in early levels)
 * - some levels have a hard move limit
 * Boss levels (every 10th): top skill for the chapter, AI first, move timer.
 * Levels never show these numbers to the player; they live in config only.
 */
export function getLevel(n) {
  if (cache[n]) return cache[n];
  const ch = chapterOf(n);
  if (!ch) return null;
  const i = n - ch.from, t = ch.count > 1 ? i / (ch.count - 1) : 0;
  const boss = isBoss(n);
  const par = ch.win + Math.floor(ch.size / 3); // your moves allowed for 2 and 3 stars
  const level = {
    id: n,
    chapter: ch.index,
    size: ch.size,
    winLength: ch.win,
    boss,
    par,
    aiSkill: boss ? 0.9 : Math.round((0.4 + 0.5 * t) * 100) / 100,
    firstMove: boss || t >= 0.6 ? 'ai' : 'player',
    timeLimit: boss ? 15 : t >= 0.5 ? Math.round(25 - 15 * t) : 0, // seconds per move, 0 = off
    moveLimit: !boss && i % 5 === 2 ? par : 0,                      // run out of moves = fail
    reward: (REWARDS.firstClearBase + Math.floor(n / REWARDS.firstClearDivisor)) * (boss ? REWARDS.bossMultiplier : 1),
  };
  return (cache[n] = level);
}

/** Sanity check used by tests: the table must match the engine's win rule. */
export const tableMatchesRules = () => CHAPTERS.every(c => winLength(c.size) === c.win);
