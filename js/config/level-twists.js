/**
 * Level twists (Levels mode only): what each level gets, the intro
 * schedule, sizes, counts and the combination rules. Pure data +
 * functions (no DOM). The rules themselves live in core/twists/, the
 * layouts are built by core/layout-generator.js and checked by
 * core/layout-validator.js (tests only).
 *
 * Twist ids:
 *   coins    coin cells (+5 coins, bosses: +1 diamond), paid on a first-clear win
 *   vanish   vanishing marks (only N marks each, the oldest disappears)
 *   blocked  blocked cells
 *   ice      ice cells that melt after N moves
 *   lines    line rule: "straight only" or "diagonal only"
 *   gravity  marks drop down their column
 *   puzzle   pre-placed marks, win in N
 *   wrap     rows and diagonals wrap from the right edge to the left
 *   shrink   the outer ring closes every 8 moves
 */
import { mulberry32 } from '../utils/seeded-random.js';

export const TWIST_IDS = ['coins', 'vanish', 'blocked', 'ice', 'lines', 'gravity', 'puzzle', 'wrap', 'shrink'];

/**
 * Intro schedule: the first level of each twist is an easy level with
 * only that twist. Intros never sit on a boss level (every 10th), so they
 * come on the next normal level; bosses use the twist later.
 */
export const INTRO = { coins: 25, vanish: 41, blocked: 51, ice: 71, lines: 101, gravity: 121, puzzle: 196, wrap: 261, shrink: 281 };
export const NO_TWISTS_BEFORE = 21;   // levels 1-20: none
export const MIXES_FROM = 300;        // from here on: up to 2 twists on normal levels, 3 on bosses

export const introOf = n => TWIST_IDS.find(id => INTRO[id] === n) || null;

/** Smallest board each twist works on. Shrinking needs 9x9: the area must stay >= win length + 2. */
export const MIN_SIZE = { coins: 4, vanish: 4, blocked: 5, ice: 5, lines: 5, gravity: 5, puzzle: 8, wrap: 8, shrink: 9 };
/** "Diagonal only" needs room: 6x6 and up. */
export const DIAGONAL_MIN_SIZE = 6;

/** Never on the same level. */
export const FORBIDDEN = [
  ['gravity', 'vanish'],   // a vanished mark would leave marks floating
  ['gravity', 'shrink'],
  ['vanish', 'puzzle'],
  ['wrap', 'shrink'],
];
/** Puzzles only mix with twists that keep the classic rules, so "win in N" stays exact. */
export const PUZZLE_PARTNERS = ['blocked', 'coins'];

export function comboAllowed(ids) {
  if (FORBIDDEN.some(([a, b]) => ids.includes(a) && ids.includes(b))) return false;
  if (ids.includes('puzzle') && ids.some(id => id !== 'puzzle' && !PUZZLE_PARTNERS.includes(id))) return false;
  return true;
}

/** How many twists a level may have. */
export const maxTwists = (n, boss) => (n >= MIXES_FROM ? (boss ? 3 : 2) : boss ? 2 : 1);

/** Chance a normal level gets a twist (if the streak rule allows it). */
export const TWIST_CHANCE = 0.7;
/** After 3 or 4 twist levels in a row, the next normal level has no twist. */
export const STREAK = [3, 4];
/** A twist is "new" for this many levels after its intro and is picked more often (20-30% of levels). */
export const NEW_FOR = 40;
const WEIGHT = { fresh: 4.5, shrinkNormal: 0.4, shrinkBoss: 2.2 };

/** Blocked cells by grid (about 5-8% of the cells): [min, max]. Bosses use max. */
export const BLOCKED_COUNTS = {
  5: [1, 2], 6: [2, 3], 7: [3, 4], 8: [3, 5], 9: [4, 6], 10: [5, 7], 11: [6, 9], 12: [7, 10],
};
/** Ice cells by grid: [min, max] (2-6), each melts after 4-8 moves in total. */
export const ICE_COUNTS = { 5: [2, 3], 6: [2, 4], 7: [3, 4], 8: [3, 5], 9: [3, 5], 10: [4, 6], 11: [4, 6], 12: [4, 6] };
export const ICE_MELT = [4, 8];
/** Coin cells: 1-3 cells of +5 coins; bosses add one +1 diamond cell. */
export const COIN_CELLS = [1, 3];
export const COIN_VALUE = 5;
export const DIAMOND_VALUE = 1;
/** Shrinking: a ring every 8 moves, warning 2 moves before. */
export const SHRINK = { every: 8, warn: 2 };

/**
 * Pre-placed marks by grid (X + O together, always even so X = O and the
 * player moves first): [min, max]. A puzzle needs at least k - 2 player
 * marks on one line to start a forcing sequence.
 */
export const PRESET_COUNTS = {
  5: [4, 4], 6: [4, 6], 7: [6, 6], 8: [6, 8], 9: [6, 8], 10: [6, 8], 11: [6, 8], 12: [6, 8],
};

/** Puzzle goal: win within N of your own moves. Bosses want at least `bossMin`. */
export const PUZZLE_MOVES = { min: 2, max: 4, bossMin: 3 };

/** Layout search: attempt a uses seed (level + SEED_STEP * a); give up after MAX_ATTEMPTS. */
export const SEED_STEP = 1000;
export const MAX_ATTEMPTS = 50;

/** Twists available on level n (introduced before it and fitting the board). */
export const availableTwists = (n, size) => TWIST_IDS.filter(id => INTRO[id] < n && size >= MIN_SIZE[id]);

/** Weighted pick of `count` twists that may go together. Deterministic for a given rnd. */
function pickTwists(rnd, n, size, boss, count) {
  const out = [];
  for (let t = 0; t < count; t++) {
    const pool = availableTwists(n, size).filter(id => !out.includes(id) && comboAllowed([...out, id]));
    if (!pool.length) break;
    // new twists are picked more often; shrinking mostly on bosses
    const w = pool.map(id => (n - INTRO[id] <= NEW_FOR ? WEIGHT.fresh : 1) * (id === 'shrink' ? (boss ? WEIGHT.shrinkBoss : WEIGHT.shrinkNormal) : 1));
    let r = rnd() * w.reduce((a, b) => a + b, 0), j = 0;
    while (r >= w[j] && j < w.length - 1) r -= w[j++];
    out.push(pool[j]);
  }
  return out;
}

/**
 * Plans the twists of every level (1..total) in one pass, because the
 * "normal level between 3-4 twist levels" rule depends on the levels
 * before. `levelAt(n)` gives { size, boss }. Deterministic.
 * Returns plans[n] = [twist ids] (in TWIST_IDS order).
 */
export function planAllTwists(total, levelAt) {
  const plans = [];
  let streak = 0, streakMax = STREAK[0];
  for (let n = 1; n <= total; n++) {
    const { size, boss } = levelAt(n), rnd = mulberry32(n * 7919 + 13);
    let ids = [];
    const intro = introOf(n);
    if (intro) ids = [intro];
    else if (n >= NO_TWISTS_BEFORE && availableTwists(n, size).length) {
      const max = maxTwists(n, boss);
      if (boss) ids = pickTwists(rnd, n, size, true, max >= 3 ? (rnd() < 0.5 ? 3 : 2) : max === 2 && rnd() < 0.6 ? 2 : 1);
      else {
        // bosses and intros always get a twist, so rest before them if the streak would get too long
        let ahead = 0; // forced twist levels right after this one (a boss, an intro, or both)
        for (let m = n + 1; levelAt(m) && (levelAt(m).boss || introOf(m)); m++) ahead++;
        const mustRest = streak >= streakMax || (ahead > 0 && streak + 1 + ahead > streakMax);
        if (!mustRest && rnd() < TWIST_CHANCE) ids = pickTwists(rnd, n, size, false, max === 2 && rnd() < 0.45 ? 2 : 1);
      }
    }
    plans[n] = TWIST_IDS.filter(id => ids.includes(id));
    if (plans[n].length) streak++;
    else { streak = 0; streakMax = STREAK[rnd() < 0.5 ? 0 : 1]; }
  }
  return plans;
}

/**
 * Hand-crafted boss layouts. They win over generated layouts and pass the
 * same validation (see tests/twists/). Grid rows use:
 *   '.' empty   '#' blocked   'x' player mark   'o' machine mark
 *   '$' coin cell (+5 coins)   '*' diamond cell (+1 diamond)
 * Rule twists are added as fields: shrink: { rings }, rule, gravity, wrap.
 */
export const BOSS_OVERRIDES = {
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
  // Chapter 9 boss, 11x11: the board shrinks twice (to 7x7) around four pillars,
  // with the prizes waiting in the middle
  370: {
    grid: [
      '...........',
      '...........',
      '...........',
      '...#...#...',
      '...........',
      '....$*$....',
      '...........',
      '...#...#...',
      '...........',
      '...........',
      '...........',
    ],
    shrink: { rings: 2 },
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
      '......*.....',
      '.#........#.',
      '............',
    ],
    puzzleMoves: 3,
  },
};

/** Turns an override grid into the layout format (see core/layout-generator.js). */
export function overrideLayout(n) {
  const o = BOSS_OVERRIDES[n];
  if (!o) return null;
  const size = o.grid.length, blocked = [], preset = [], coins = [];
  o.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    const i = r * size + c;
    if (ch === '#') blocked.push(i);
    if (ch === 'x') preset.push({ i, m: 'X' });
    if (ch === 'o') preset.push({ i, m: 'O' });
    if (ch === '$') coins.push({ i, kind: 'coin', amount: COIN_VALUE });
    if (ch === '*') coins.push({ i, kind: 'diamond', amount: DIAMOND_VALUE });
  }));
  const extra = {
    shrink: o.shrink ? { every: SHRINK.every, warn: SHRINK.warn, ...o.shrink } : null,
    rule: o.rule || null,
    ...(o.gravity ? { gravity: true } : {}),
    ...(o.wrap ? { wrap: true } : {}),
  };
  const on = { blocked: blocked.length, puzzle: preset.length, coins: coins.length, shrink: o.shrink, lines: o.rule, gravity: o.gravity, wrap: o.wrap };
  const twists = TWIST_IDS.filter(id => on[id]);
  return { size, twists, blocked, preset, coins, ice: [], vanish: null, ...extra, puzzleMoves: preset.length ? o.puzzleMoves : null };
}

/**
 * How each twist shows up in the UI: Lucide icon, name, the short chip
 * label and a one-line explanation (shown when a chip is tapped).
 * `layout` is the level's layout, so texts can use its numbers.
 */
export const TWIST_INFO = {
  coins: { icon: 'coins', name: 'Coin cells', chip: 'Coins', explain: () => 'Coin cells pay +5 coins (diamond cells +1 diamond) when you win the level for the first time.' },
  vanish: { icon: 'hourglass', name: 'Vanishing marks', chip: 'Vanish', explain: l => `You keep only ${(l && l.vanish && l.vanish.limit) || 'a few'} marks. Play one more and your oldest one fades out.` },
  blocked: { icon: 'ban', name: 'Blocked cells', chip: 'Blocked', explain: () => 'Nobody can play on a stone, and it breaks lines.' },
  ice: { icon: 'snowflake', name: 'Ice cells', chip: 'Ice', explain: () => 'Frozen cells melt after the number of moves shown on them.' },
  lines: {
    icon: l => (l && l.rule === 'diagonal' ? 'move-diagonal' : 'grid-3x3'), name: 'Line rule',
    chip: l => (l && l.rule === 'diagonal' ? 'Diagonal only' : 'Straight only'),
    explain: l => (l && l.rule === 'diagonal' ? 'Only diagonal lines win. Rows and columns do not count.' : 'Only rows and columns win. Diagonals do not count.'),
  },
  gravity: { icon: 'arrow-down-to-line', name: 'Gravity', chip: 'Gravity', explain: () => 'Your mark drops to the lowest free cell of the column you tap.' },
  puzzle: { icon: 'puzzle', name: 'Puzzle', chip: 'Puzzle', explain: l => `The pinned marks were there from the start. Win in ${(l && l.puzzleMoves) || 'a few'} moves.` },
  wrap: { icon: 'repeat', name: 'Wrap-around', chip: 'Wrap', explain: () => 'Rows and diagonals continue from the right edge to the left edge.' },
  shrink: { icon: 'shrink', name: 'Shrinking board', chip: 'Shrink', explain: () => 'Every 8 moves the outer ring closes. Marks already there stay.' },
};

/** Icon / chip text of a twist for a layout (some depend on it, like the line rule). */
export const twistIcon = (id, layout) => { const v = TWIST_INFO[id].icon; return typeof v === 'function' ? v(layout) : v; };
export const twistChip = (id, layout) => { const v = TWIST_INFO[id].chip; return typeof v === 'function' ? v(layout) : v; };
