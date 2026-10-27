/**
 * Campaign levels: 500 levels generated from a small chapter table.
 * Pure data + functions (no DOM).
 */
import { winLength, REWARDS } from './constants.js';
import { getLevelMoveTime } from './timers.js';
import { generateLayout } from '../core/layout-generator.js';

// [first level, last level, board size, win length, chapter name]
const TABLE = [
  [1, 20, 3, 3, 'Warm Up'],
  [21, 50, 4, 4, 'First Steps'],
  [51, 90, 5, 4, 'Getting Smart'],
  [91, 140, 6, 4, 'Tactician'],
  [141, 195, 7, 5, 'Big League'],
  [196, 250, 8, 5, 'Strategist'],
  [251, 305, 9, 5, 'Mastermind'],
  [306, 360, 10, 5, 'Grandmaster'],
  [361, 430, 11, 5, 'Legend'],
  [431, 500, 12, 5, 'Ultimate'],
];

export const TOTAL_LEVELS = 500;

/** AI skill = chance it plays its best move. Never 1 (never perfect). */
export const SKILL = { min: 0.4, max: 0.9, max3x3: 0.85 };

export const isBoss = n => n % 10 === 0;

export const CHAPTERS = TABLE.map(([from, to, size, win, name], index) => {
  const normal = [];
  for (let n = from; n <= to; n++) if (!isBoss(n)) normal.push(n);
  return {
    index, from, to, size, win, name, count: to - from + 1,
    normal,                                        // non-boss levels, in order (used for the timer steps)
    maxSkill: size === 3 ? SKILL.max3x3 : SKILL.max,
  };
});

export const chapterOf = n => CHAPTERS.find(c => n >= c.from && n <= c.to);

const cache = [];
const round2 = x => Math.round(x * 100) / 100;

/**
 * Builds level n. Inside a chapter, t goes 0 -> 1 and difficulty rises with it:
 * - AI skill 40% -> 90% (85% on 3x3)
 * - the player starts the early levels; later the AI starts every other level
 * - move time goes down step by step: x1.5 on the first level -> x0.8 on the
 *   last normal level (see config/timers.js)
 * - some levels have a hard move limit
 * Boss levels (every 10th): the chapter's top skill, AI first, x0.7 time.
 * Twists (chapter 3+, see config/level-twists.js): `twist` is 'none' |
 * 'blocked' | 'puzzle' | 'mixed' and `layout` the cells it starts with.
 * Puzzle levels: the player starts and must win within `puzzleMoves`.
 * Levels never show these numbers to the player; they live in config only.
 */
export function getLevel(n) {
  if (cache[n]) return cache[n];
  const ch = chapterOf(n);
  if (!ch) return null;
  const i = n - ch.from, t = ch.count > 1 ? i / (ch.count - 1) : 0;
  const boss = isBoss(n);
  const step = ch.normal.indexOf(n);                        // -1 for bosses
  const progress = boss ? 1 : ch.normal.length > 1 ? step / (ch.normal.length - 1) : 0;
  const par = ch.win + Math.floor(ch.size / 3);             // your moves allowed for 2 and 3 stars
  const level = {
    id: n,
    chapter: ch.index,
    size: ch.size,
    winLength: ch.win,
    boss,
    par,
    progress,
    aiSkill: boss ? ch.maxSkill : round2(SKILL.min + (ch.maxSkill - SKILL.min) * t),
    firstMove: boss || (t >= 0.4 && n % 2 === 1) ? 'ai' : 'player',
    moveLimit: !boss && i % 5 === 2 ? par : 0,             // run out of moves = fail
    reward: (REWARDS.firstClearBase + Math.floor(n / REWARDS.firstClearDivisor)) * (boss ? REWARDS.bossMultiplier : 1),
  };
  level.timeLimit = getLevelMoveTime(level);               // seconds per move (when the timer is on)
  const { type, layout } = generateLayout(n, level);
  level.twist = type;
  level.layout = layout;                                   // null for a normal level
  if (layout && layout.puzzleMoves) {
    level.firstMove = 'player';                            // puzzles: you move first...
    level.moveLimit = layout.puzzleMoves;                  // ...and must win within N of your moves
  }
  return (cache[n] = level);
}

/** Sanity check used by tests: the table must match the engine's win rule. */
export const tableMatchesRules = () => CHAPTERS.every(c => winLength(c.size) === c.win);
