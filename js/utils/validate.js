/**
 * Validation helpers (pure).
 */
import { NAME_MAX } from '../config/constants.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Whole number in [lo, hi], or the default when the value isn't a finite number. */
export const toInt = (v, lo, hi, d) => (Number.isFinite(v) ? clamp(Math.floor(v), lo, hi) : d);

/** Returns an error message for a player name, or '' when it is fine. */
export function nameError(value, { required = true } = {}) {
  const v = String(value || '').trim();
  if (!v) return required ? "Name can't be empty" : '';
  if (v.length > NAME_MAX) return `Max ${NAME_MAX} characters`;
  return '';
}
