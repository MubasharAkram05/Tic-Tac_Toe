/**
 * Currency counters in the top bar (and in the level result card):
 * coins ([data-coin-pill]) and diamonds ([data-gem-pill]). Numbers count up
 * when they change, and small coins / diamonds can fly into a counter.
 */
import { $$, replayClass, reduceMotion } from '../utils/dom.js';
import { onEvent } from '../utils/events.js';
import { save } from '../services/storage.js';
import { sound } from '../services/audio.js';

const ICON_SVG = {
  coins: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f5b301" stroke="#b45309" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>',
  diamonds: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="#38bdf8" stroke="#0369a1" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 9h20M9 3l3 6 3-6M12 9v12" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/></svg>',
};
const PILL = { coins: '[data-coin-pill]', diamonds: '[data-gem-pill]' };
const AMOUNT = { coins: '.coin-amt', diamonds: '.gem-amt' };
const raf = { coins: 0, diamonds: 0 };

const value = kind => save.data[kind];

/** Pill HTML. As a button it opens the right shop tab. */
export function currencyPillHTML(kind, asButton = true) {
  const coin = kind === 'coins';
  const attrs = coin ? 'class="coin-pill" data-coin-pill' : 'class="gem-pill" data-gem-pill';
  const inner = `<i data-lucide="${coin ? 'coins' : 'gem'}"></i><span class="${coin ? 'coin-amt' : 'gem-amt'}">${value(kind)}</span>`;
  return asButton
    ? `<button ${attrs} data-go="#/shop?tab=${kind}" aria-label="${coin ? 'Coins' : 'Diamonds'}, open shop">${inner}</button>`
    : `<span ${attrs}>${inner}</span>`;
}

/** Both pills side by side (used by the level result card). */
export const currencyBarHTML = (asButton = false) => `<div class="currency-bar">${currencyPillHTML('coins', asButton)}${currencyPillHTML('diamonds', asButton)}</div>`;

/** Updates every counter of one kind. With `from`, the number counts up to the current total. */
export function renderCurrency(kind, from) {
  const to = value(kind), amounts = () => $$(`${PILL[kind]} ${AMOUNT[kind]}`);
  cancelAnimationFrame(raf[kind]);
  if (from === undefined || from === to || reduceMotion()) {
    amounts().forEach(el => { el.textContent = to; });
    return;
  }
  const t0 = performance.now(), dur = 650;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    const shown = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    amounts().forEach(el => { el.textContent = shown; });
    if (k < 1) raf[kind] = requestAnimationFrame(step);
    else $$(PILL[kind]).forEach(p => replayClass(p, 'bump'));
  };
  raf[kind] = requestAnimationFrame(step);
}

/** Shows a fixed number on every counter of one kind (e.g. the "before" value of a reward). */
export function showAmount(kind, n, root = document) {
  root.querySelectorAll(`${PILL[kind]} ${AMOUNT[kind]}`).forEach(el => { el.textContent = n; });
}

/** Small coins or diamonds fly from one element into a visible counter. */
export function flyCurrency(kind, fromEl, count, toEl) {
  if (reduceMotion() || !fromEl || !(count > 0)) return;
  const target = toEl || $$(PILL[kind]).find(p => p.offsetParent && p.getBoundingClientRect().width);
  if (!target) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const n = kind === 'coins' ? Math.min(10, Math.max(3, Math.ceil(count / 5))) : Math.min(6, Math.max(2, count));
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'flying-coin' + (kind === 'diamonds' ? ' gem' : '');
    c.innerHTML = ICON_SVG[kind];
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

/** Listens for wallet changes and keeps every counter in sync. Called once from main.js. */
export function initCurrencyBar() {
  ['coins', 'diamonds'].forEach(kind => {
    onEvent(kind, ({ from, to, silent }) => {
      if (silent) return; // the caller animates (e.g. the level result screen)
      renderCurrency(kind, from);
      if (to > from) sound.coin();
    });
    renderCurrency(kind);
  });
}
