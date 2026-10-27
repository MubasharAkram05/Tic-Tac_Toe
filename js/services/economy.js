/**
 * Coins: earning, spending, shop purchases and the daily reward.
 * Tells the UI about changes through the event bus ('coins', 'toast').
 */
import { save } from './storage.js';
import { REWARDS } from '../config/constants.js';
import { shopItem } from '../config/shop-items.js';
import { emit } from '../utils/events.js';
import { ymd } from '../utils/format.js';
import { checkAchievements } from './achievements.js';
import { applyCosmetics } from './theme.js';

export const coins = () => save.data.coins;
export const canAfford = n => save.data.coins >= n;

/** Adds coins. { silent: true } skips the count-up (the caller animates it). */
export function addCoins(n, { silent = false } = {}) {
  if (n <= 0) return;
  const from = save.data.coins;
  save.data.coins += n;
  save.data.coinsEarned += n;
  save.write();
  emit('coins', { from: silent ? save.data.coins : from, to: save.data.coins, silent });
}

export function spendCoins(n) {
  if (!canAfford(n)) return false;
  save.data.coins -= n;
  save.write();
  emit('coins', { from: save.data.coins, to: save.data.coins });
  return true;
}

/** Buys a shop item. Returns '' on success or a message for the user. */
export function buyItem(type, id) {
  const it = shopItem(type, id), d = save.data;
  if (!it) return 'Unknown item';
  if (!it.consumable && d.owned[type].includes(id)) return 'Already owned';
  if (!spendCoins(it.price)) return `Need ${it.price - d.coins} more coins`;
  if (it.consumable) d.inventory[id]++;
  else d.owned[type].push(id);
  d.purchases++;
  save.write();
  checkAchievements();
  emit('progress');
  return '';
}

export function equipItem(type, id) {
  const d = save.data;
  if (!d.owned[type].includes(id)) return;
  d.equipped[type] = id;
  if (type === 'avatar') d.profile.avatar = id;
  save.write();
  applyCosmetics();
  emit('progress');
}

/** Uses an owned boost token, else pays its price. Returns false if neither is possible. */
export function useBoost(kind, price) {
  const inv = save.data.inventory;
  if (inv[kind] > 0) { inv[kind]--; save.write(); return true; }
  return spendCoins(price);
}

/* ---- Daily login reward: 20 coins, +5 per day of a streak, up to 50 on day 7 ---- */
export function dailyStatus() {
  const now = new Date(), today = ymd(now);
  const yesterday = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const dd = save.data.daily;
  if (dd.last === today) return { available: false, day: dd.streak };
  const day = dd.last === yesterday ? Math.min(7, dd.streak + 1) : 1; // missed a day = start again
  return { available: true, day, amount: REWARDS.daily[day - 1], today };
}

export function claimDaily() {
  const st = dailyStatus();
  if (!st.available) return null;
  save.data.daily = { last: st.today, streak: st.day };
  save.write();
  return st;
}
