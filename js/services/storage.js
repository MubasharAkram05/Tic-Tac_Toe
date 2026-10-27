/**
 * Storage. Two localStorage keys, both kept exactly as in earlier versions
 * so saved games keep working:
 *
 *  - "ttt.v3"       app settings + home choices + names + per-board scores
 *  - "ttt_save_v1"  progress: coins, XP, levels, items, stats, achievements
 *
 * Every read / write is wrapped in try/catch. Broken or missing data
 * means a fresh start, never a crash.
 */
import { STORAGE_KEYS, SAVE_VERSION, NAME_MAX, DEFAULT_NAMES, BOARD_SIZES, TIMER_OPTIONS } from '../config/constants.js';
import { TOTAL_LEVELS } from '../config/levels.js';
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
  settings: { sound: true, vibration: true, theme: 'auto', timer: 0 },
  prefs: { mode: 'computer', size: 3 },                 // last level picked in the home carousel
  choices: {
    cpu: { difficulty: 'medium', p1Mark: 'X' },
    pvp: { p1Mark: 'X' },
  },
  names: { ...DEFAULT_NAMES },
  scores: { computer: {}, friend: {}, campaign: {} },   // scores[mode][size or "L<level>"] = { p1, p2, draw }
  flags: { zoomHint: false },
};

function loadApp() {
  const s = readJSON(STORAGE_KEYS.settings) || {};
  Object.assign(app.settings, s.settings);
  if (!TIMER_OPTIONS.includes(app.settings.timer)) app.settings.timer = 0;
  Object.assign(app.prefs, s.prefs);
  if (!BOARD_SIZES.includes(app.prefs.size)) app.prefs.size = 3;
  if (s.choices) {
    Object.assign(app.choices.cpu, s.choices.cpu);
    Object.assign(app.choices.pvp, s.choices.pvp);
  }
  Object.assign(app.names, s.names);
  Object.assign(app.flags, s.flags);
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
   2. Progress save ("ttt_save_v1"), versioned with migrations
   ========================================================================= */
const modeStats = () => ({ played: 0, wins: 0, losses: 0, draws: 0, streak: 0, best: 0 });

function freshSave() {
  return {
    version: SAVE_VERSION,
    profile: { name: 'Player', avatar: 'user' },
    coins: 0, coinsEarned: 0, xp: 0, purchases: 0,
    levels: {},                 // "37": { stars: 2, completed: true }
    unlockedLevel: 1,
    owned: { board: ['classic'], skin: ['classic'], avatar: ['user'] },
    inventory: { hint: 0, undo: 0 },
    equipped: { board: 'classic', skin: 'classic', avatar: 'user' },
    stats: { computer: modeStats(), friend: modeStats(), campaign: modeStats(), all: modeStats() },
    achievements: {},          // id -> time unlocked
    daily: { last: '', streak: 0 },
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
  if (d.levels && typeof d.levels === 'object') {
    for (const [key, v] of Object.entries(d.levels)) {
      const n = +key, stars = v ? toInt(v.stars, 0, 3, 0) : 0;
      if (n >= 1 && n <= TOTAL_LEVELS && stars) out.levels[n] = { stars, completed: true };
    }
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
  }
  // step by step: the next level after the highest cleared one is always open
  const maxDone = Math.max(0, ...Object.keys(out.levels).map(Number));
  out.unlockedLevel = clamp(Math.max(toInt(d.unlockedLevel, 1, TOTAL_LEVELS, 1), maxDone + 1), 1, TOTAL_LEVELS);
  return out;
}

/** Upgrades older saves. Add steps here, e.g. if (d.version === 1) { ...; d.version = 2; } */
function migrate(d) {
  if (!d || typeof d !== 'object' || !Number.isFinite(d.version) || d.version > SAVE_VERSION) return freshSave();
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
  for (let n = 1; n <= maxLv; n++) stars += d.levels[n] ? d.levels[n].stars : 0;
  const compact = {
    v: SAVE_VERSION, n: d.profile.name, c: d.coins, ce: d.coinsEarned, x: d.xp, p: d.purchases,
    u: d.unlockedLevel, s: stars, o: d.owned, i: d.inventory, e: d.equipped, st: d.stats,
    a: Object.keys(d.achievements), d: [d.daily.last, d.daily.streak],
  };
  const body = b64enc(JSON.stringify(compact));
  return `TTT1-${body}-${checksum(body)}`;
}

/** Returns { data } on success or { error } with a message for the user. */
function decode(code) {
  const m = /^TTT1-([A-Za-z0-9+/=]+)-([0-9a-z]+)$/.exec(String(code).replace(/\s+/g, ''));
  if (!m) return { error: "That doesn't look like a progress code." };
  if (checksum(m[1]) !== m[2]) return { error: 'This code is incomplete or has a typo.' };
  try {
    const c = JSON.parse(b64dec(m[1])), levels = {}, achievements = {};
    String(c.s || '').split('').forEach((ch, i) => { if (+ch) levels[i + 1] = { stars: +ch, completed: true }; });
    (c.a || []).forEach(id => { achievements[id] = Date.now(); });
    return {
      data: migrate({
        version: c.v, profile: { name: c.n }, coins: c.c, coinsEarned: c.ce, xp: c.x, purchases: c.p,
        unlockedLevel: c.u, levels, owned: c.o, inventory: c.i, equipped: c.e, stats: c.st,
        achievements, daily: { last: (c.d || [])[0], streak: (c.d || [])[1] },
      }),
    };
  } catch (e) {
    return { error: 'This code could not be read.' };
  }
}

/** Loads both keys. Called once from main.js. */
export function initStorage() {
  loadApp();
  data = migrate(readJSON(STORAGE_KEYS.save));
}
