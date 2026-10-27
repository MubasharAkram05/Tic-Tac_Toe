/**
 * App-wide constants: board sizes, win rules, rewards, prices, storage keys.
 * Pure data only (no DOM), so core/ and tests can import it too.
 */

export const BOARD_SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** 3x3 = 3 in a row, 4x4..6x6 = 4, 7x7..12x12 = 5. */
export const winLength = size => (size === 3 ? 3 : size <= 6 ? 4 : 5);

export const NAME_MAX = 12;
export const DEFAULT_NAMES = { p1: 'Player 1', p2: 'Player 2', solo: 'You' };

/* Move timer values (base times, multipliers, ring colours) live in config/timers.js. */

/** Board layout: gap between cells by size (10x10 and up use 3px). */
export const BOARD_GAPS = { 3: 10, 4: 9, 5: 8, 6: 6, 7: 5, 8: 4, 9: 4 };
export const ZOOM_FROM = 9;   // pinch zoom on 9x9 and up
export const MAX_ZOOM = 2;

/** Prices in coins. */
export const PRICES = { hint: 20, undo: 10 };

/** Coin rewards. */
export const REWARDS = {
  firstClearBase: 10,        // first clear = 10 + floor(level / 10)
  firstClearDivisor: 10,
  bossMultiplier: 3,         // boss first clear x3
  replay: 2,                 // replaying a cleared level
  perNewStar: 5,             // only for stars not earned before
  daily: [20, 25, 30, 35, 40, 45, 50], // day 1..7 of a streak, day 7+ stays at 50
};

/** Diamonds: the rare premium currency. */
export const DIAMOND_REWARDS = {
  boss: 1,                   // boss level first clear
  bossLate: 2,               // ...from chapter `bossLateFrom` onward
  bossLateFrom: 6,           // chapter number (1-based)
  chapterPerfect: 5,         // 3 stars on every level of a chapter
  chapterComplete: 3,        // every level of a chapter cleared
  levelUp: 1,                // each player level gained
  dailyEvery: 7,             // daily reward: every 7th day in a row...
  daily: 2,                  // ...gives this many diamonds
};

/** What diamonds buy. */
export const DIAMOND_PRICES = {
  extraTime: 1,              // +10s on the current move, once per game
  continue: 2,               // after losing a level: undo the last 2 moves and keep going, once per attempt
  skip: 5,                   // skip a level, once per chapter, gives 1 star
};

/** One-way exchange: 1 diamond = 100 coins (coins can't buy diamonds). */
export const EXCHANGE_RATE = 100;

export const XP = { win: 10, campaignBonus: 5 };

/** Player titles by level (first entry whose level is reached wins). */
export const TITLES = [
  { from: 35, name: 'Legend' },
  { from: 20, name: 'Master' },
  { from: 10, name: 'Pro' },
  { from: 5, name: 'Rookie' },
  { from: 1, name: 'Beginner' },
];

/**
 * localStorage keys. "settings" must not change. Progress moved to
 * "ttt_save_v2"; the old "ttt_save_v1" key is read once and migrated.
 */
export const STORAGE_KEYS = { settings: 'ttt.v3', save: 'ttt_save_v2', legacySave: 'ttt_save_v1', devSave: 'ttt_save_dev' };
export const SAVE_VERSION = 2;
