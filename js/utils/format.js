/**
 * Text and number formatting helpers.
 */
import { winLength } from '../config/constants.js';

export const sizeLabel = n => `${n}×${n}`;
export const ruleLabel = n => `${sizeLabel(n)} · ${winLength(n)} in a row`;
export const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const timerLabel = on => (on ? 'On' : 'Off');
export const secondsLabel = s => `${s}s`;

/** Local date as YYYY-MM-DD (used by the daily reward). */
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Animates a number inside an element from `from` to `to` (ease-out). */
export function countUp(el, to, { from = 0, duration = 600, suffix = '' } = {}) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || from === to || typeof to !== 'number') { el.textContent = to + suffix; return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / duration);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))) + suffix;
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
