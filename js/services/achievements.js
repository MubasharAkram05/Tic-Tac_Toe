/**
 * Achievements: definitions, progress ("7/10 wins") and unlocking.
 * Unlocking pays coins (and diamonds for some) and shows a toast through
 * the event bus. Ids never change, so badges from older saves stay unlocked.
 */
import { save } from './storage.js';
import { CHAPTERS, isBoss, TOTAL_LEVELS } from '../config/levels.js';
import { addCoins, addDiamonds } from './economy.js';
import { totalStars } from './progress.js';
import { emit } from '../utils/events.js';

const bestChapterPerfect = d => Math.max(...CHAPTERS.map(c => {
  let n3 = 0;
  for (let n = c.from; n <= c.to; n++) if (d.levels[n] && d.levels[n].stars === 3) n3++;
  return n3 / c.count;
}));

/** progress(d) returns [current, target]; done when current >= target. `diamonds` is an optional extra prize. */
export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Win', desc: 'Win a game vs the computer', icon: 'trophy', reward: 20, progress: d => [d.stats.all.wins, 1], unit: 'win' },
  { id: 'wins_25', name: 'Getting Good', desc: 'Win 25 games', icon: 'medal', reward: 50, progress: d => [d.stats.all.wins, 25], unit: 'wins' },
  { id: 'streak_10', name: 'On Fire', desc: 'Win 10 games in a row', icon: 'flame', reward: 100, diamonds: 2, progress: d => [d.stats.all.best, 10], unit: 'streak' },
  { id: 'chapter_1', name: 'Warmed Up', desc: 'Clear Chapter 1', icon: 'flag', reward: 50, diamonds: 1, progress: d => [Object.keys(d.levels).filter(n => +n <= CHAPTERS[0].to).length, CHAPTERS[0].count], unit: 'levels' },
  { id: 'boss_1', name: 'Boss Slayer', desc: 'Beat a boss level', icon: 'crown', reward: 40, diamonds: 1, progress: d => [Object.keys(d.levels).some(n => isBoss(+n) && !d.levels[n].skipped) ? 1 : 0, 1], unit: 'boss' },
  { id: 'perfect_ch', name: 'Perfectionist', desc: 'Get 3 stars on every level of a chapter', icon: 'sparkles', reward: 150, diamonds: 3, progress: d => [Math.round(bestChapterPerfect(d) * 100), 100], unit: '%' },
  { id: 'stars_100', name: 'Star Collector', desc: 'Collect 100 stars', icon: 'star', reward: 80, progress: d => [totalStars(d), 100], unit: 'stars' },
  { id: 'reach_50', name: 'Halfway Hero', desc: 'Reach level 50', icon: 'footprints', reward: 60, progress: d => [d.unlockedLevel, 50], unit: 'level' },
  { id: 'reach_100', name: 'Centurion', desc: 'Reach level 100', icon: 'mountain', reward: 120, diamonds: 2, progress: d => [d.unlockedLevel, 100], unit: 'level' },
  { id: 'beat_200', name: 'Double Century', desc: 'Beat level 200', icon: 'medal', reward: 200, diamonds: 3, progress: d => [d.levels[200] ? 1 : 0, 1], unit: 'level' },
  { id: 'reach_300', name: 'Mountain Top', desc: 'Reach level 300', icon: 'mountain', reward: 250, diamonds: 3, progress: d => [d.unlockedLevel, 300], unit: 'level' },
  { id: 'beat_500', name: 'Grand Champion', desc: `Beat level ${TOTAL_LEVELS}`, icon: 'crown', reward: 500, diamonds: 5, progress: d => [d.levels[TOTAL_LEVELS] ? 1 : 0, 1], unit: 'level' },
  { id: 'daily_7', name: 'Loyal Player', desc: 'Claim the daily reward 7 days in a row', icon: 'calendar-check', reward: 50, diamonds: 1, progress: d => [d.daily.streak, 7], unit: 'days' },
  { id: 'shopper', name: 'Shopper', desc: 'Buy something in the shop', icon: 'shopping-bag', reward: 20, progress: d => [d.purchases, 1], unit: 'item' },
  { id: 'rich', name: 'Coin Hoarder', desc: 'Earn 1000 coins in total', icon: 'coins', reward: 50, progress: d => [d.coinsEarned, 1000], unit: 'coins' },
  { id: 'gems_25', name: 'Gem Collector', desc: 'Earn 25 diamonds in total', icon: 'gem', reward: 100, diamonds: 2, progress: d => [d.diamondsEarned, 25], unit: 'diamonds' },
];

const done = (a, d) => { const [cur, target] = a.progress(d); return cur >= target; };
export const isUnlockedAchievement = id => !!save.data.achievements[id];

/** "7/10 wins" style text for a locked badge. */
export function progressText(a, d = save.data) {
  const [cur, target] = a.progress(d);
  if (a.unit === '%') return `${Math.min(cur, target)}%`;
  return `${Math.min(cur, target)}/${target} ${a.unit}`;
}
export const progressFraction = (a, d = save.data) => { const [cur, target] = a.progress(d); return Math.min(1, cur / target); };

/** "+50 coins, +2 diamonds" text for a badge's prize. */
export const rewardText = a => `+${a.reward} coins${a.diamonds ? `, +${a.diamonds} ${a.diamonds === 1 ? 'diamond' : 'diamonds'}` : ''}`;

/** Unlocks anything newly earned, pays its prize and queues a toast. */
export function checkAchievements() {
  const d = save.data;
  // one pass can unlock a badge whose prize unlocks another (e.g. diamonds earned), so loop
  const all = [];
  for (let fresh; (fresh = ACHIEVEMENTS.filter(a => !d.achievements[a.id] && done(a, d))).length;) {
    fresh.forEach(a => {
      d.achievements[a.id] = Date.now();
      save.write();
      addCoins(a.reward);
      if (a.diamonds) addDiamonds(a.diamonds);
      all.push(a);
    });
  }
  all.forEach((a, i) => setTimeout(() => emit('toast', { text: `Achievement: ${a.name} (${rewardText(a)})`, icon: a.icon }), 400 + i * 700));
  return all;
}
