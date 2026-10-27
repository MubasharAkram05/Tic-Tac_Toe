/**
 * Campaign progress: unlocks, stars, skips, XP, player level and the
 * coin + diamond rewards for levels and chapters.
 */
import { save } from './storage.js';
import { REWARDS, XP, TITLES, DIAMOND_REWARDS, DIAMOND_PRICES } from '../config/constants.js';
import { CHAPTERS, TOTAL_LEVELS, isBoss, chapterOf } from '../config/levels.js';
import { addCoins, addDiamonds, spendDiamonds } from './economy.js';
import { recordGame } from './stats.js';
import { checkAchievements } from './achievements.js';
import { emit } from '../utils/events.js';

/** Level from total XP: level L needs 100 + 50*(L-1) XP to reach L+1. */
export function levelInfo(xp = save.data.xp) {
  let lv = 1, need = 100, rest = xp;
  while (rest >= need) { rest -= need; lv++; need = 100 + 50 * (lv - 1); }
  return { lv, into: rest, need };
}

export const titleFor = lv => TITLES.find(t => lv >= t.from).name;

/**
 * Adds XP. Each player level gained pays DIAMOND_REWARDS.levelUp diamonds.
 * Returns how many levels were gained (0 = none).
 */
export function addXP(n, { silent = false } = {}) {
  const before = levelInfo().lv;
  save.data.xp += n;
  save.write();
  const gained = levelInfo().lv - before;
  if (gained > 0) addDiamonds(gained * DIAMOND_REWARDS.levelUp, { silent });
  return gained;
}

export const bestStars = n => (save.data.levels[n] ? save.data.levels[n].stars : 0);
export const isUnlocked = n => n <= save.data.unlockedLevel;
export const isSkipped = n => !!(save.data.levels[n] && save.data.levels[n].skipped);
export const campaignDone = () => !!save.data.levels[TOTAL_LEVELS];
export const highestLevel = () => (campaignDone() ? TOTAL_LEVELS : save.data.unlockedLevel);

export function totalStars(d = save.data) {
  let s = 0;
  for (const k in d.levels) s += d.levels[k].stars;
  return s;
}
export function chapterStars(ci, d = save.data) {
  const c = CHAPTERS[ci];
  let s = 0;
  for (let n = c.from; n <= c.to; n++) s += d.levels[n] ? d.levels[n].stars : 0;
  return s;
}
export function chapterDone(ci, minStars = 1, d = save.data) {
  const c = CHAPTERS[ci];
  for (let n = c.from; n <= c.to; n++) if (!d.levels[n] || d.levels[n].stars < minStars) return false;
  return true;
}

/**
 * Stars: 1 = win, 2 = win within the move target, 3 = also no undo, hint,
 * continue or timeout.
 */
export function starsFor({ playerMoves, limit, usedHelp, timedOut }) {
  let stars = 1;
  if (playerMoves <= limit) stars = 2;
  if (stars === 2 && !usedHelp && !timedOut) stars = 3;
  return stars;
}

/** Diamonds for a boss first clear: +1, or +2 from chapter 6 onward. */
export const bossDiamonds = level => (level.chapter + 1 >= DIAMOND_REWARDS.bossLateFrom ? DIAMOND_REWARDS.bossLate : DIAMOND_REWARDS.boss);

/**
 * Pays the one-time chapter bonuses that are now earned:
 *   every level cleared -> chapterComplete, every level at 3 stars -> chapterPerfect.
 * Scans every chapter, so progress from an older save is paid too.
 * Returns [{ kind: 'complete' | 'perfect', chapter, diamonds }].
 */
export function payChapterBonuses({ silent = false } = {}) {
  const d = save.data, paid = [];
  CHAPTERS.forEach(c => {
    if (!d.rewards.complete.includes(c.index) && chapterDone(c.index, 1)) {
      d.rewards.complete.push(c.index);
      paid.push({ kind: 'complete', chapter: c.index, diamonds: DIAMOND_REWARDS.chapterComplete });
    }
    if (!d.rewards.perfect.includes(c.index) && chapterDone(c.index, 3)) {
      d.rewards.perfect.push(c.index);
      paid.push({ kind: 'perfect', chapter: c.index, diamonds: DIAMOND_REWARDS.chapterPerfect });
    }
  });
  const total = paid.reduce((s, p) => s + p.diamonds, 0);
  if (total) addDiamonds(total, { silent });
  save.write();
  return paid;
}

/**
 * Records the end of a level and pays rewards. Returns what happened so the
 * result screen can show it.
 *   outcome: 'win' | 'lose' | 'draw', reason: 'moves' when out of moves
 */
export function finishLevel(level, { outcome, reason, playerMoves, usedHelp, timedOut, moveLimit }) {
  const d = save.data, n = level.id, won = outcome === 'win';
  recordGame('campaign', won ? 'win' : outcome === 'draw' && reason !== 'moves' ? 'draw' : 'lose');
  if (!won) {
    checkAchievements();
    emit('progress');
    return { won: false, reason: reason || outcome };
  }
  const limit = moveLimit || level.par;
  const stars = starsFor({ playerMoves, limit, usedHelp, timedOut });
  const skipped = isSkipped(n);
  const prev = skipped ? 0 : bestStars(n);              // a skipped level still pays its first clear
  const first = !prev;
  const newStars = Math.max(0, stars - bestStars(n));
  const base = first ? level.reward : REWARDS.replay;   // replays only pay a little (no farming)
  const starCoins = newStars * REWARDS.perNewStar;      // only stars not earned before
  const xp = XP.win + XP.campaignBonus + Math.floor(n / 10);
  const before = d.coins, gemsBefore = d.diamonds;
  d.levels[n] = { stars: Math.max(bestStars(n), stars), completed: true };
  if (n === d.unlockedLevel && n < TOTAL_LEVELS) d.unlockedLevel = n + 1;
  addCoins(base + starCoins, { silent: true });
  // Diamonds: boss first clear, chapter bonuses, level ups
  const gems = [];
  if (first && level.boss) {
    const g = bossDiamonds(level);
    addDiamonds(g, { silent: true });
    gems.push({ label: 'Boss first clear', diamonds: g });
  }
  payChapterBonuses({ silent: true }).forEach(p => gems.push({
    label: p.kind === 'perfect' ? `Chapter ${p.chapter + 1}: all 3 stars` : `Chapter ${p.chapter + 1} complete`, diamonds: p.diamonds,
  }));
  const levelUps = addXP(xp, { silent: true });
  if (levelUps) gems.push({ label: levelUps > 1 ? `Level up ×${levelUps}` : 'Level up', diamonds: levelUps * DIAMOND_REWARDS.levelUp });
  save.write();
  checkAchievements();
  emit('progress');
  return {
    won: true, stars, newStars, base, starCoins, xp, first, before, gemsBefore, gems, levelUp: levelUps > 0,
    playerMoves, limit, usedHelp, timedOut, boss: isBoss(n),
  };
}

/* ---- Skip a level with diamonds: once per chapter, gives 1 star, no coins ---- */

/** '' if level n can be skipped now, else the reason. */
export function skipBlocker(n) {
  const d = save.data, ch = chapterOf(n);
  if (!ch || n !== d.unlockedLevel || d.levels[n]) return 'Only your current level can be skipped';
  if (d.skips.includes(ch.index)) return 'Skip already used in this chapter';
  return '';
}

/** Skips level n. Returns '' on success or a message for the user. */
export function skipLevel(n) {
  const why = skipBlocker(n);
  if (why) return why;
  if (!spendDiamonds(DIAMOND_PRICES.skip)) return 'Not enough diamonds';
  const d = save.data;
  d.levels[n] = { stars: 1, completed: true, skipped: true };
  d.skips.push(chapterOf(n).index);
  if (n < TOTAL_LEVELS) d.unlockedLevel = n + 1;
  payChapterBonuses();
  save.write();
  checkAchievements();
  emit('progress');
  return '';
}

/** Records a normal (non-campaign) game and gives XP for wins vs the computer. */
export function finishNormalGame(mode, result) {
  recordGame(mode, result);
  if (mode === 'computer' && result === 'win') {
    const ups = addXP(XP.win);
    if (ups) emit('toast', { text: `Level up! +${ups * DIAMOND_REWARDS.levelUp} diamond${ups > 1 ? 's' : ''}`, icon: 'gem' });
  }
  checkAchievements();
  emit('progress');
}
