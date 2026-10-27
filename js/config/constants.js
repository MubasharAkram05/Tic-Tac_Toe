/**
 * App-wide constants: board sizes, win rules, rewards, prices, storage keys.
 * Pure data only (no DOM), so core/ and tests can import it too.
 */

export const BOARD_SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** 3x3 = 3 in a row, 4x4..6x6 = 4, 7x7..12x12 = 5. */
export const winLength = size => (size === 3 ? 3 : size <= 6 ? 4 : 5);

export const NAME_MAX = 12;
export const DEFAULT_NAMES = { p1: 'Player 1', p2: 'Player 2', solo: 'You' };

/** Move timer choices in seconds (0 = off). */
export const TIMER_OPTIONS = [0, 10, 20, 30];
/** Timer ring turns amber / red below these fractions; the last N seconds pulse. */
export const TIMER_WARN = 0.5;
export const TIMER_DANGER = 0.25;
export const TIMER_FINAL_SECONDS = 5;

/** Board layout: gap between cells by size (10x10 and up use 3px). */
export const BOARD_GAPS = { 3: 10, 4: 9, 5: 8, 6: 6, 7: 5, 8: 4, 9: 4 };
export const ZOOM_FROM = 9;   // pinch zoom on 9x9 and up
export const MAX_ZOOM = 2;

/** Prices in coins. */
export const PRICES = { hint: 20, undo: 10 };

/** Coin rewards. */
export const REWARDS = {
  firstClearBase: 10,        // first clear = 10 + floor(level / 5)
  firstClearDivisor: 5,
  bossMultiplier: 3,         // boss first clear x3
  replay: 2,                 // replaying a cleared level
  perNewStar: 5,             // only for stars not earned before
  daily: [20, 25, 30, 35, 40, 45, 50], // day 1..7 of a streak, day 7+ stays at 50
};

export const XP = { win: 10, campaignBonus: 5 };

/** Player titles by level (first entry whose level is reached wins). */
export const TITLES = [
  { from: 35, name: 'Legend' },
  { from: 20, name: 'Master' },
  { from: 10, name: 'Pro' },
  { from: 5, name: 'Rookie' },
  { from: 1, name: 'Beginner' },
];

/** localStorage keys. These must not change, or saved progress is lost. */
export const STORAGE_KEYS = { settings: 'ttt.v3', save: 'ttt_save_v1' };
export const SAVE_VERSION = 1;
