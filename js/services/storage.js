/**
 * Storage. Two localStorage keys:
 *
 *  - "ttt.v3"       app settings + home choices + names + per-board scores
 *  - "ttt_save_v2"  progress: coins, diamonds, XP, levels, items, stats, achievements
 *
 * Older progress in "ttt_save_v1" is migrated once into "ttt_save_v2".
 * Level numbers stay the same, so cleared levels and stars are kept. The
 * v1 key is left in place as a backup.
 *
 * Every read / write is wrapped in try/catch. Broken or missing data
 * means a fresh start, never a crash.
 */
import { STORAGE_KEYS, SAVE_VERSION, NAME_MAX, DEFAULT_NAMES, BOARD_SIZES } from '../config/constants.js';
import { TOTAL_LEVELS, CHAPTERS } from '../config/levels.js';
import { shopIds } from '../config/shop-items.js';
import { clamp, toInt } from '../utils/validate.js';

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
}

/* =========================================================================
   1. App state ("ttt.v3")
   ========================================================================= */
export const app = {
  settings: { sound: true, vibration: true, theme: 'auto', timerOn: true }, // move timer is on by default
  prefs: { mode: 'computer', size: 3 },                 // last level picked in the home carousel
  choices: {
    cpu: { difficulty: 'medium', p1Mark: 'X' },
    pvp: { p1Mark: 'X' },
  },
  names: { ...DEFAULT_NAMES },
  scores: { computer: {}, friend: {}, campaign: {} },   // scores[mode][size or "L<level>"] = { p1, p2, draw }
  flags: { zoomHint: false, twists: {}, timerReset: false }, // twists: tutorials seen; timerReset: see loadApp
};

function loadApp() {
  const s = readJSON(STORAGE_KEYS.settings) || {};
  Object.assign(app.settings, s.settings);
  // Older versions saved a timer choice from the setup sheets (Off / 10s / 20s / 30s, or
  // On / Off). The sheets no longer have one: the timer is on by default with automatic
  // times, so it is switched On for everyone once. After that only Settings changes it.
  delete app.settings.timer;
  if (typeof app.settings.timerOn !== 'boolean') app.settings.timerOn = true;
  Object.assign(app.prefs, s.prefs);
  if (!BOARD_SIZES.includes(app.prefs.size)) app.prefs.size = 3;
  if (s.choices) {
    Object.assign(app.choices.cpu, s.choices.cpu);
    Object.assign(app.choices.pvp, s.choices.pvp);
  }
  Object.assign(app.names, s.names);
  Object.assign(app.flags, s.flags);
  if (!app.flags.timerReset) {
    app.settings.timerOn = true;
    app.flags.timerReset = true;
    saveApp();
  }
  if (s.scores) {
    app.scores = { computer: s.scores.computer || {}, friend: s.scores.friend || {}, campaign: s.scores.campaign || {} };
  }
}
export const saveApp = () => writeJSON(STORAGE_KEYS.settings, app);

/** Scores for one mode and board size (or campaign level), created on first use. */
export function scoreBook(mode, key) {
  const book = app.scores[mode];
  return (book[key] = book[key] || { p1: 0, p2: 0, draw: 0 });
}

/* =========================================================================
   2. Progress save ("ttt_save_v2"), versioned with migrations
   ========================================================================= */
const modeStats = () => ({ played: 0, wins: 0, losses: 0, draws: 0, streak: 0, best: 0 });

function freshSave() {
  return {
    version: SAVE_VERSION,
    profile: { name: 'Player', avatar: 'user' },
    coins: 0, coinsEarned: 0, xp: 0, purchases: 0,
    diamonds: 0, diamondsEarned: 0,
    levels: {},                 // "37": { stars: 2, completed: true } (+ skipped: true when skipped with diamonds)
    unlockedLevel: 1,
    skips: [],                  // chapter indexes where a level was skipped (max one per chapter)
    rewards: { complete: [], perfect: [] }, // chapter indexes whose diamond bonus was paid
    owned: { board: ['classic'], skin: ['classic'], avatar: ['user'] },
    inventory: { hint: 0, undo: 0 },
    equipped: { board: 'classic', skin: 'classic', avatar: 'user' },
    stats: { computer: modeStats(), friend: modeStats(), campaign: modeStats(), all: modeStats() },
    achievements: {},          // id -> time unlocked
    daily: { last: '', streak: 0, run: 0 },  // streak caps at 7 (coins); run counts every day in a row (diamonds)
  };
}

/** Copies only valid fields over a fresh save, so broken data can never crash the game. */
function sanitize(d) {
  const out = freshSave();
  if (!d || typeof d !== 'object') return out;
  if (d.profile && typeof d.profile.name === 'string' && d.profile.name.trim()) out.profile.name = d.profile.name.trim().slice(0, NAME_MAX);
  out.coins = toInt(d.coins, 0, 1e9, 0);
  out.coinsEarned = toInt(d.coinsEarned, out.coins, 1e9, out.coins);
  out.xp = toInt(d.xp, 0, 1e9, 0);
  out.purchases = toInt(d.purchases, 0, 1e6, 0);
  out.diamonds = toInt(d.diamonds, 0, 1e9, 0);
  out.diamondsEarned = toInt(d.diamondsEarned, out.diamonds, 1e9, out.diamonds);
  if (d.levels && typeof d.levels === 'object') {
    for (const [key, v] of Object.entries(d.levels)) {
      const n = +key, stars = v ? toInt(v.stars, 0, 3, 0) : 0;
      if (n >= 1 && n <= TOTAL_LEVELS && stars) out.levels[n] = v.skipped ? { stars: 1, completed: true, skipped: true } : { stars, completed: true };
    }
  }
  const chapterList = list => (Array.isArray(list) ? [...new Set(list.filter(i => Number.isInteger(i) && CHAPTERS[i]))] : []);
  out.skips = chapterList(d.skips);
  if (d.rewards) {
    out.rewards.complete = chapterList(d.rewards.complete);
    out.rewards.perfect = chapterList(d.rewards.perfect);
  }
  for (const type of ['board', 'skin', 'avatar']) {
    const valid = shopIds(type);
    if (d.owned && Array.isArray(d.owned[type])) out.owned[type] = [...new Set([...out.owned[type], ...d.owned[type].filter(x => valid.includes(x))])];
    if (d.equipped && out.owned[type].includes(d.equipped[type])) out.equipped[type] = d.equipped[type];
  }
  out.profile.avatar = out.equipped.avatar;
  if (d.inventory) {
    out.inventory.hint = toInt(d.inventory.hint, 0, 999, 0);
    out.inventory.undo = toInt(d.inventory.undo, 0, 999, 0);
  }
  if (d.stats) {
    for (const m of Object.keys(out.stats)) if (d.stats[m]) for (const k of Object.keys(out.stats[m])) out.stats[m][k] = toInt(d.stats[m][k], 0, 1e9, 0);
  }
  if (d.achievements && typeof d.achievements === 'object') {
    for (const id of Object.keys(d.achievements)) if (/^[a-z0-9_]+$/.test(id)) out.achievements[id] = toInt(d.achievements[id], 0, 1e15, Date.now());
  }
  if (d.daily) {
    out.daily.last = typeof d.daily.last === 'string' ? d.daily.last : '';
    out.daily.streak = toInt(d.daily.streak, 0, 7, 0);
    out.daily.run = toInt(d.daily.run, out.daily.streak, 1e6, out.daily.streak);
  }
  // step by step: the next level after the highest cleared one is always open
  const maxDone = Math.max(0, ...Object.keys(out.levels).map(Number));
  out.unlockedLevel = clamp(Math.max(toInt(d.unlockedLevel, 1, TOTAL_LEVELS, 1), maxDone + 1), 1, TOTAL_LEVELS);
  return out;
}

/**
 * Upgrades older saves step by step, then cleans the result.
 *  v1 -> v2: 200 -> 500 levels. Level numbers map 1:1, so `levels` and
 *            `unlockedLevel` are kept as they are. Diamonds, skips and the
 *            chapter bonus lists start empty; the daily run starts at the streak.
 * Exported for the tests.
 */
export function migrate(d) {
  if (!d || typeof d !== 'object' || !Number.isFinite(d.version) || d.version > SAVE_VERSION) return freshSave();
  if (d.version === 1) {
    d = { ...d, version: 2, diamonds: 0, diamondsEarned: 0, skips: [], rewards: { complete: [], perfect: [] } };
    if (d.daily) d.daily = { ...d.daily, run: d.daily.streak };
  }
  return sanitize(d);
}

let data = freshSave();

export const save = {
  get data() { return data; },
  write() { writeJSON(STORAGE_KEYS.save, data); },
  replace(next) { data = next; this.write(); },
  reset() { data = freshSave(); this.write(); },
  exportCode,
  decode,
};

/* ---- Export / import as a short text code ---- */
const b64enc = str => btoa(unescape(encodeURIComponent(str)));
const b64dec = str => decodeURIComponent(escape(atob(str)));
function checksum(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(-5);
}

function exportCode() {
  const d = data, maxLv = Math.max(0, ...Object.keys(d.levels).map(Number));
  let stars = '';
  // one digit per level; "s" marks a skipped level (it counts as 1 star)
  for (let n = 1; n <= maxLv; n++) stars += d.levels[n] ? (d.levels[n].skipped ? 's' : d.levels[n].stars) : 0;
  const compact = {
    v: SAVE_VERSION, n: d.profile.name, c: d.coins, ce: d.coinsEarned, x: d.xp, p: d.purchases,
    dm: d.diamonds, de: d.diamondsEarned, sk: d.skips, rw: d.rewards,
    u: d.unlockedLevel, s: stars, o: d.owned, i: d.inventory, e: d.equipped, st: d.stats,
    a: Object.keys(d.achievements), d: [d.daily.last, d.daily.streak, d.daily.run],
  };
  const body = b64enc(JSON.stringify(compact));
  return `TTT2-${body}-${checksum(body)}`;
}

/** Returns { data } on success or { error } with a message for the user. Reads TTT1 (old) and TTT2 codes. */
function decode(code) {
  const m = /^TTT[12]-([A-Za-z0-9+/=]+)-([0-9a-z]+)$/.exec(String(code).replace(/\s+/g, ''));
  if (!m) return { error: "That doesn't look like a progress code." };
  if (checksum(m[1]) !== m[2]) return { error: 'This code is incomplete or has a typo.' };
  try {
    const c = JSON.parse(b64dec(m[1])), levels = {}, achievements = {};
    String(c.s || '').split('').forEach((ch, i) => {
      if (ch === 's') levels[i + 1] = { stars: 1, completed: true, skipped: true };
      else if (+ch) levels[i + 1] = { stars: +ch, completed: true };
    });
    (c.a || []).forEach(id => { achievements[id] = Date.now(); });
    return {
      data: migrate({
        version: c.v, profile: { name: c.n }, coins: c.c, coinsEarned: c.ce, xp: c.x, purchases: c.p,
        diamonds: c.dm, diamondsEarned: c.de, skips: c.sk, rewards: c.rw,
        unlockedLevel: c.u, levels, owned: c.o, inventory: c.i, equipped: c.e, stats: c.st,
        achievements, daily: { last: (c.d || [])[0], streak: (c.d || [])[1], run: (c.d || [])[2] },
      }),
    };
  } catch (e) {
    return { error: 'This code could not be read.' };
  }
}

/** Loads both keys. Called once from main.js. A v1 save is migrated and written to the v2 key. */
export function initStorage() {
  loadApp();
  const current = readJSON(STORAGE_KEYS.save);
  if (current) { data = migrate(current); return; }
  const legacy = readJSON(STORAGE_KEYS.legacySave);
  data = migrate(legacy);
  if (legacy) save.write();
}
