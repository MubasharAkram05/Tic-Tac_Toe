/**
 * Circular countdown ring drawn around a player's avatar, with the
 * seconds left in the middle. Colour: green > 50%, amber 25-50%, red < 25%.
 */
import { TIMER_WARN, TIMER_DANGER, TIMER_FINAL_SECONDS } from '../config/constants.js';

const R = 21, CIRC = 2 * Math.PI * R;

export const timerRingHTML = () => `
  <svg class="timer-ring" viewBox="0 0 48 48" aria-hidden="true">
    <circle class="tr-track" cx="24" cy="24" r="${R}"/>
    <circle class="tr-bar" cx="24" cy="24" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
  </svg>
  <span class="timer-secs" aria-hidden="true"></span>`;

/** Shows the ring on an avatar wrapper and updates it. */
export function setRing(avatarEl, fraction, remainingMs) {
  if (!avatarEl) return;
  const secs = Math.ceil(remainingMs / 1000);
  avatarEl.classList.add('timing');
  avatarEl.classList.toggle('t-warn', fraction <= TIMER_WARN && fraction > TIMER_DANGER);
  avatarEl.classList.toggle('t-danger', fraction <= TIMER_DANGER);
  avatarEl.classList.toggle('t-final', secs <= TIMER_FINAL_SECONDS);
  avatarEl.querySelector('.tr-bar').setAttribute('stroke-dashoffset', String(CIRC * (1 - fraction)));
  avatarEl.querySelector('.timer-secs').textContent = secs;
  avatarEl.setAttribute('aria-label', `${secs} seconds left`);
}

export function clearRing(avatarEl) {
  if (!avatarEl) return;
  avatarEl.classList.remove('timing', 't-warn', 't-danger', 't-final');
  avatarEl.removeAttribute('aria-label');
}
