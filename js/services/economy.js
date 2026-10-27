/**
 * Money: coins and diamonds. Earning, spending, shop purchases, the
 * one-way diamond -> coin exchange and the daily reward.
 * Tells the UI about changes through the event bus ('coins', 'diamonds').
 *
 * Coins are the everyday currency. Diamonds are rare and premium.
 */
import { save } from './storage.js';
import { REWARDS, DIAMOND_REWARDS, EXCHANGE_RATE } from '../config/constants.js';
import { shopItem } from '../config/shop-items.js';
import { emit } from '../utils/events.js';
import { ymd } from '../utils/format.js';
import { checkAchievements } from './achievements.js';
import { applyCosmetics } from './theme.js';

/** Each currency's save fields and event name. */
const WALLETS = {
  coins: { key: 'coins', earned: 'coinsEarned', event: 'coins' },
  diamonds: { key: 'diamonds', earned: 'diamondsEarned', event: 'diamonds' },
};

export const coins = () => save.data.coins;
export const diamonds = () => save.data.diamonds;
export const balance = currency => save.data[WALLETS[currency].key];
export const canAfford = (n, currency = 'coins') => balance(currency) >= n;
/** How many more of a currency are needed (0 = enough). */
export const shortBy = (n, currency = 'coins') => Math.max(0, n - balance(currency));

/** Adds to a wallet. { silent: true } skips the counter count-up (the caller animates it). */
function add(currency, n, silent) {
  if (!(n > 0)) return;
  const w = WALLETS[currency], d = save.data, from = d[w.key];
  d[w.key] += n;
  d[w.earned] += n;
  save.write();
  emit(w.event, { from: silent ? d[w.key] : from, to: d[w.key], silent });
}

function spend(currency, n) {
  if (!canAfford(n, currency)) return false;
  const w = WALLETS[currency], d = save.data;
  d[w.key] -= n;
  save.write();
  emit(w.event, { from: d[w.key], to: d[w.key] });
  return true;
}

export const addCoins = (n, { silent = false } = {}) => add('coins', n, silent);
export const addDiamonds = (n, { silent = false } = {}) => add('diamonds', n, silent);
export const spendCoins = n => spend('coins', n);
export const spendDiamonds = n => spend('diamonds', n);

/** "Need 3 more diamonds" style message, or '' when there is enough. */
export function needText(price, currency) {
  const short = shortBy(price, currency);
  if (!short) return '';
  return `Need ${short} more ${currency === 'diamonds' ? (short === 1 ? 'diamond' : 'diamonds') : (short === 1 ? 'coin' : 'coins')}`;
}

/** Buys a shop item with its own currency. Returns '' on success or a message for the user. */
export function buyItem(type, id) {
  const it = shopItem(type, id), d = save.data;
  if (!it) return 'Unknown item';
  if (!it.consumable && d.owned[type].includes(id)) return 'Already owned';
  if (!spend(it.currency, it.price)) return needText(it.price, it.currency);
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

/** Uses an owned boost token, else pays its price in coins. Returns false if neither is possible. */
export function useBoost(kind, price) {
  const inv = save.data.inventory;
  if (inv[kind] > 0) { inv[kind]--; save.write(); return true; }
  return spendCoins(price);
}

/**
 * One-way exchange: diamonds -> coins at EXCHANGE_RATE each.
 * Coins can never buy diamonds. Returns the coins received (0 = failed).
 */
export function exchangeDiamonds(n = 1) {
  if (!(n > 0) || !spendDiamonds(n)) return 0;
  const got = n * EXCHANGE_RATE;
  addCoins(got);
  checkAchievements();
  return got;
}

/* ---- Daily login reward ----
 * Coins: 20 on day 1, +5 per day of a streak, up to 50 on day 7 (day 7+ stays at 50).
 * Diamonds: every 7th day in a row (day 7, 14, 21, ...) also gives DIAMOND_REWARDS.daily.
 */
export function dailyStatus() {
  const now = new Date(), today = ymd(now);
  const yesterday = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const dd = save.data.daily;
  if (dd.last === today) return { available: false, day: dd.streak };
  const inRow = dd.last === yesterday;                         // missed a day = start again
  const day = inRow ? Math.min(7, dd.streak + 1) : 1;
  const run = inRow ? dd.run + 1 : 1;
  const gems = run % DIAMOND_REWARDS.dailyEvery === 0 ? DIAMOND_REWARDS.daily : 0;
  return { available: true, day, run, amount: REWARDS.daily[day - 1], diamonds: gems, today };
}

/** Marks today as claimed. The caller adds the coins / diamonds (so it can animate them). */
export function claimDaily() {
  const st = dailyStatus();
  if (!st.available) return null;
  save.data.daily = { last: st.today, streak: st.day, run: st.run };
  save.write();
  return st;
}
