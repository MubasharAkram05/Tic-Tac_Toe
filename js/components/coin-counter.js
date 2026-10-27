/**
 * Coin counter pills ([data-coin-pill]) with count-up and flying coins.
 */
import { $$, replayClass, reduceMotion } from '../utils/dom.js';
import { onEvent } from '../utils/events.js';
import { save } from '../services/storage.js';
import { sound } from '../services/audio.js';

const COIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f5b301" stroke="#b45309" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>';

let raf = 0;

/** HTML for a coin pill. As a button it opens the shop. */
export const coinPillHTML = (asButton = true) => asButton
  ? '<button class="coin-pill" data-coin-pill data-go="#/shop" aria-label="Coins, open shop"><i data-lucide="coins"></i><span class="coin-amt">0</span></button>'
  : '<span class="coin-pill" data-coin-pill><i data-lucide="coins"></i><span class="coin-amt">0</span></span>';

/** Updates every coin counter. With `from`, the number counts up to the current total. */
export function renderCoins(from) {
  const to = save.data.coins, pills = () => $$('[data-coin-pill] .coin-amt');
  cancelAnimationFrame(raf);
  if (from === undefined || from === to || reduceMotion()) {
    pills().forEach(el => { el.textContent = to; });
    return;
  }
  const t0 = performance.now(), dur = 650;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    const shown = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    pills().forEach(el => { el.textContent = shown; });
    if (k < 1) raf = requestAnimationFrame(step);
    else $$('[data-coin-pill]').forEach(p => replayClass(p, 'bump'));
  };
  raf = requestAnimationFrame(step);
}

/** Small coins fly from one element to a coin counter. */
export function flyCoins(fromEl, count, toEl) {
  if (reduceMotion() || !fromEl) return;
  const target = toEl || $$('[data-coin-pill]').find(p => p.offsetParent && p.getBoundingClientRect().width);
  if (!target) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const n = Math.min(10, Math.max(3, Math.ceil(count / 5)));
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'flying-coin';
    c.innerHTML = COIN_SVG;
    const x0 = a.left + a.width / 2 - 11 + (Math.random() - 0.5) * 40, y0 = a.top + a.height / 2 - 11;
    c.style.left = x0 + 'px';
    c.style.top = y0 + 'px';
    document.body.appendChild(c);
    const dx = b.left + 10 - x0, dy = b.top + b.height / 2 - 11 - y0;
    const anim = c.animate(
      [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0.9 }],
      { duration: 280, delay: i * 60, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'backwards' });
    anim.onfinish = () => { c.remove(); if (i % 2 === 0) sound.coin(); };
  }
}

export function initCoinCounter() {
  onEvent('coins', ({ from, to, silent }) => {
    if (silent) return; // the caller animates (e.g. the level result screen)
    renderCoins(from);
    if (to > from) sound.coin();
  });
  renderCoins();
}
