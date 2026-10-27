/**
 * Coin cells: a few cells hold +5 coins (bosses can hold +1 diamond).
 * Placing a mark there collects it. The game only pays what the player
 * collected when the level is won for the first time.
 *   layout.coins = [{ i: cellIndex, kind: 'coin' | 'diamond', amount }]
 */
export const id = 'coins';

export function setup(s, layout) {
  s.coins = {};
  s.collected = [];
  (layout.coins || []).forEach(c => { s.coins[c.i] = { kind: c.kind, amount: c.amount }; });
}

export function afterMove(s, { cell, mark }, events) {
  const c = s.coins[cell];
  if (!c) return;
  delete s.coins[cell];
  s.collected.push({ cell, mark, kind: c.kind, amount: c.amount });
  events.push({ type: 'coin', cell, mark, kind: c.kind, amount: c.amount });
}

/** What `mark` collected so far: { coins, diamonds }. */
export function collectedBy(s, mark) {
  const out = { coins: 0, diamonds: 0 };
  (s.collected || []).forEach(c => { if (c.mark === mark) out[c.kind === 'diamond' ? 'diamonds' : 'coins'] += c.amount; });
  return out;
}
