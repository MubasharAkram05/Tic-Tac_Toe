/**
 * Campaign progress: unlocks, stars, XP and player level.
 */
import { save } from './storage.js';
import { REWARDS, XP, TITLES } from '../config/constants.js';
import { CHAPTERS, TOTAL_LEVELS, isBoss } from '../config/levels.js';
import { addCoins } from './economy.js';
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

/** Adds XP. Returns true if the player levelled up. */
export function addXP(n) {
  const before = levelInfo().lv;
  save.data.xp += n;
  save.write();
  return levelInfo().lv > before;
}

export const bestStars = n => (save.data.levels[n] ? save.data.levels[n].stars : 0);
export const isUnlocked = n => n <= save.data.unlockedLevel;
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
 * Stars: 1 = win, 2 = win within the move target, 3 = also no undo, hint or timeout.
 */
export function starsFor({ playerMoves, limit, usedHelp, timedOut }) {
  let stars = 1;
  if (playerMoves <= limit) stars = 2;
  if (stars === 2 && !usedHelp && !timedOut) stars = 3;
  return stars;
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
  const prev = bestStars(n), first = !prev;
  const newStars = Math.max(0, stars - prev);
  const base = first ? level.reward : REWARDS.replay;   // replays only pay a little (no farming)
  const starCoins = newStars * REWARDS.perNewStar;      // only stars not earned before
  const xp = XP.win + XP.campaignBonus + Math.floor(n / 10);
  const before = d.coins;
  d.levels[n] = { stars: Math.max(prev, stars), completed: true };
  if (n === d.unlockedLevel && n < TOTAL_LEVELS) d.unlockedLevel = n + 1;
  addCoins(base + starCoins, { silent: true });
  const levelUp = addXP(xp);
  save.write();
  checkAchievements();
  emit('progress');
  return { won: true, stars, newStars, base, starCoins, xp, first, before, levelUp, playerMoves, limit, usedHelp, timedOut, boss: isBoss(n) };
}

/** Records a normal (non-campaign) game and gives XP for wins vs the computer. */
export function finishNormalGame(mode, result) {
  recordGame(mode, result);
  if (mode === 'computer' && result === 'win') addXP(XP.win);
  checkAchievements();
  emit('progress');
}
