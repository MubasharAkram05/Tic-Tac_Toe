/**
 * Level twists (campaign only): blocked cells and pre-placed "puzzle" marks.
 * Pure data + functions (no DOM). The layout itself is built by
 * core/layout-generator.js; this file only decides *what* each level gets.
 *
 * Twist types:
 *   'none'    normal level
 *   'blocked' some cells are blocked (nobody can play there, lines break)
 *   'puzzle'  X and O marks are already on the board, "win in N moves"
 *   'mixed'   blocked cells + puzzle marks
 *
 * Distribution:
 *   chapters 1-2   (3x3, 4x4)       no twists (learning phase)
 *   chapters 3-5   (5x5 to 7x7)     ~30% blocked
 *   chapters 6-10  (8x8 to 12x12)   ~30% blocked, ~20% puzzle, ~10% mixed, rest normal
 *   bosses from chapter 3           always a twist, with the hardest layouts
 */
import { mulberry32 } from '../utils/seeded-random.js';

export const TWISTS = ['none', 'blocked', 'puzzle', 'mixed'];

/** First chapter (0-based index) with twists: chapter 3. */
export const TWIST_FROM_CHAPTER = 2;
/** Chapters (0-based) from here on also get puzzle and mixed levels: chapter 6. */
export const PUZZLES_FROM_CHAPTER = 5;

/** Chance of each twist for normal (non-boss) levels. The rest are normal levels. */
export const TWIST_ODDS = {
  early: { blocked: 0.34 },                                // chapters 3-5
  late: { blocked: 0.33, puzzle: 0.22, mixed: 0.11 },      // chapters 6-10
};
/** Bosses: always a twist. */
export const BOSS_ODDS = {
  early: { blocked: 0.5, puzzle: 0.3, mixed: 0.2 },
  late: { blocked: 0.3, puzzle: 0.35, mixed: 0.35 },
};
/** If the level before had the same twist, this is the chance it becomes a normal level instead. */
export const REPEAT_BREAK = 0.6;

/** Blocked cells by grid (about 5-8% of the cells): [min, max]. Bosses use max. */
export const BLOCKED_COUNTS = {
  5: [1, 2], 6: [2, 3], 7: [3, 4], 8: [3, 5], 9: [4, 6], 10: [5, 7], 11: [6, 9], 12: [7, 10],
};

/**
 * Pre-placed marks by grid (X + O together, always even so X = O and the
 * player moves first): [min, max]. A puzzle needs at least k - 2 player
 * marks on one line to start a forcing sequence, so 4 on the 4-in-a-row
 * boards and 6 on the 5-in-a-row boards.
 */
export const PRESET_COUNTS = {
  5: [4, 4], 6: [4, 6], 7: [6, 6], 8: [6, 8], 9: [6, 8], 10: [6, 8], 11: [6, 8], 12: [6, 8],
};

/** Puzzle goal: win within N of your own moves. Bosses want at least `bossMin`. */
export const PUZZLE_MOVES = { min: 2, max: 4, bossMin: 3 };

/** Layout search: attempt a uses seed (level + SEED_STEP * a); give up after MAX_ATTEMPTS. */
export const SEED_STEP = 1000;
export const MAX_ATTEMPTS = 50;

/** Seed for the twist choice (a separate stream from the layout seed). */
const typeSeed = n => n * 7919 + 13;

function roll(odds, r) {
  let acc = 0;
  for (const [type, p] of Object.entries(odds)) { acc += p; if (r < acc) return type; }
  return 'none';
}

/** Twist before the "no repeat" rule. */
function rawTwist(n, chapter, boss) {
  if (chapter < TWIST_FROM_CHAPTER) return 'none';
  const late = chapter >= PUZZLES_FROM_CHAPTER;
  const r = mulberry32(typeSeed(n))();
  return roll(boss ? (late ? BOSS_ODDS.late : BOSS_ODDS.early) : (late ? TWIST_ODDS.late : TWIST_ODDS.early), r);
}

/**
 * Planned twist of level n (before the layout search). Deterministic.
 * Avoids the same twist back to back too often: a repeat becomes a
 * normal level with chance REPEAT_BREAK. Bosses always keep their twist.
 *   prev = { chapter, boss } of level n - 1
 */
export function planTwist(n, chapter, boss, prev) {
  const t = rawTwist(n, chapter, boss);
  if (boss || t === 'none' || !prev || prev.boss || prev.chapter !== chapter) return t;
  if (rawTwist(n - 1, prev.chapter, prev.boss) !== t) return t;
  return mulberry32(typeSeed(n) + 1)() < REPEAT_BREAK ? 'none' : t;
}

/**
 * Hand-crafted boss layouts. They win over generated layouts and pass the
 * same validation (see tests/twists.test.js). Grid rows use:
 *   '.' empty   '#' blocked   'x' player mark   'o' machine mark
 */
export const BOSS_OVERRIDES = {
  // Chapter 4 boss, 6x6: four pillars
  100: {
    grid: [
      '......',
      '.#..#.',
      '......',
      '......',
      '.#..#.',
      '......',
    ],
  },
  // Chapter 6 boss, 8x8: a broken ring
  250: {
    grid: [
      '........',
      '.#....#.',
      '........',
      '........',
      '........',
      '........',
      '.#....#.',
      '........',
    ],
  },
  // Final boss, 12x12: walls + a fork puzzle (the empty pivot makes two threats at once)
  500: {
    grid: [
      '............',
      '.#........#.',
      '............',
      '............',
      '....x.......',
      '.....x.o....',
      '....xx......',
      '.....o......',
      '...o.....o..',
      '............',
      '.#........#.',
      '............',
    ],
    puzzleMoves: 3,
  },
};

/** Turns an override grid into the layout format { blocked, preset, puzzleMoves }. */
export function overrideLayout(n) {
  const o = BOSS_OVERRIDES[n];
  if (!o) return null;
  const size = o.grid.length, blocked = [], preset = [];
  o.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    const i = r * size + c;
    if (ch === '#') blocked.push(i);
    if (ch === 'x') preset.push({ i, m: 'X' });
    if (ch === 'o') preset.push({ i, m: 'O' });
  }));
  return { size, blocked, preset, puzzleMoves: preset.length ? o.puzzleMoves : null };
}
