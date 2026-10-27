/**
 * Move timer values. Every timer number in the app lives here, so pages
 * never hardcode seconds.
 *
 * Time per move = base time for the grid x a multiplier, rounded to whole
 * seconds and never below MIN_SECONDS.
 *   - vs Computer: the difficulty multiplier (Easy gets the most time)
 *   - vs Player:   Medium time for the grid
 *   - Levels:      x1.5 on the first level of a chapter, going down step by
 *                  step to x0.8 on the last normal level; bosses get x0.7
 *
 * Pure data + functions (no DOM).
 */

/** Seconds per move on Medium, by board size. Bigger grids get more time. */
export const BASE_TIMES = { 3: 10, 4: 12, 5: 14, 6: 16, 7: 18, 8: 20, 9: 22, 10: 24, 11: 27, 12: 30 };

/** vs Computer: Easy = most time, Hard = least. */
export const DIFFICULTY_MULTIPLIERS = { easy: 1.5, medium: 1, hard: 0.7 };

/** Campaign: first level of a chapter -> last normal level, and bosses. */
export const LEVEL_MULTIPLIERS = { first: 1.5, last: 0.8, boss: 0.7 };

/** No move ever gets less than this. */
export const MIN_SECONDS = 7;

/** Extra time bought with a diamond during a game. */
export const EXTRA_TIME_SECONDS = 10;

/** Ring colours: amber at or below 50% left, red below 25%; the last 5 seconds pulse. */
export const TIMER_WARN = 0.5;
export const TIMER_DANGER = 0.25;
export const TIMER_FINAL_SECONDS = 5;

const round = (size, mult) => Math.max(MIN_SECONDS, Math.round(baseTime(size) * mult));

/** Medium time for a grid (falls back to the nearest smaller size). */
export function baseTime(size) {
  if (BASE_TIMES[size]) return BASE_TIMES[size];
  const sizes = Object.keys(BASE_TIMES).map(Number).filter(s => s <= size);
  return BASE_TIMES[sizes.length ? Math.max(...sizes) : 3];
}

/**
 * Seconds per move for a normal game.
 *   getMoveTime(3, 'easy') = 15, getMoveTime(12, 'hard') = 21
 * vs Player games pass 'medium'.
 */
export function getMoveTime(size, difficulty = 'medium') {
  return round(size, DIFFICULTY_MULTIPLIERS[difficulty] || DIFFICULTY_MULTIPLIERS.medium);
}

/**
 * Multiplier for a campaign level.
 *   progress: 0 on the first normal level of the chapter, 1 on the last one
 */
export function levelMultiplier(progress, boss) {
  if (boss) return LEVEL_MULTIPLIERS.boss;
  const t = Math.min(1, Math.max(0, progress || 0));
  return LEVEL_MULTIPLIERS.first + (LEVEL_MULTIPLIERS.last - LEVEL_MULTIPLIERS.first) * t;
}

/**
 * Seconds per move for a campaign level. Takes the level object from
 * getLevel() (it needs `size`, `boss` and `progress`).
 */
export function getLevelMoveTime(level) {
  return round(level.size, levelMultiplier(level.progress, level.boss));
}
