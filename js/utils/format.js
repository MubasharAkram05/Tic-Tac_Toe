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

/**
 * Short money numbers for the coin / diamond pills:
 *   9850 -> "9,850", 12345 -> "12.3k", 1200000 -> "1.2M" (no trailing ".0").
 * The unit is picked from the value first (>= 1,000,000 -> M, >= 10,000 -> k),
 * then the number is rounded down inside that unit, so it never shows more
 * than you have: 999,999 -> "999.9k", 9,999,999 -> "9.9M".
 */
export function compactNumber(n) {
  n = Math.max(0, Math.round(+n || 0));
  if (n < 10000) return n.toLocaleString('en-US');
  const [div, unit] = n < 1e6 ? [1e3, 'k'] : [1e6, 'M'];
  const v = Math.floor((n / div) * 10) / 10; // round down so 9,999,999 never shows "10M" early
  return (v % 1 ? v.toFixed(1) : String(v)) + unit;
}

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
