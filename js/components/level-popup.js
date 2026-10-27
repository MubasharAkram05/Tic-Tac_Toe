/**
 * Simple level start popup: level number, chapter name, best stars, a timer
 * badge (when the move timer is on) and a big Play button. The current
 * level can also be skipped with diamonds (once per chapter, 1 star).
 * Board size, rules, AI skill and rewards stay in config and are not shown here.
 */
import { $, renderIcons } from '../utils/dom.js';
import { secondsLabel } from '../utils/format.js';
import { DIAMOND_PRICES } from '../config/constants.js';
import { getLevel, chapterOf } from '../config/levels.js';
import { app } from '../services/storage.js';
import { bestStars, skipBlocker, skipLevel } from '../services/progress.js';
import { needText } from '../services/economy.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { createModal } from './modal.js';
import { confirmSpend } from './confirm-sheet.js';
import { showToast } from './toast.js';
import { navigate } from '../router.js';

const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';
export const starSVG = (on, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><path class="${on ? 'star-on' : 'star-off'}" d="${STAR_PATH}"/></svg>`;

let modal = null, current = 0;

/** Config object handed to the game page for a campaign level. */
export function campaignConfig(n) {
  const lv = getLevel(n);
  return {
    mode: 'campaign', levelId: n, size: lv.size, winLength: lv.winLength, aiSkill: lv.aiSkill,
    firstMove: lv.firstMove, moveLimit: lv.moveLimit, timeLimit: lv.timeLimit,
  };
}

function ensureModal() {
  if (modal) return modal;
  modal = createModal({
    id: 'levelModal', labelledBy: 'lmTitle', cardClass: 'level-card',
    html: `
      <button class="icon-btn close-x" data-act="close" aria-label="Close"><i data-lucide="x"></i></button>
      <div class="lm-boss" hidden><i data-lucide="crown"></i>Boss</div>
      <h2 id="lmTitle">Level 1</h2>
      <p class="lm-chapter"></p>
      <div class="lm-stars" aria-label=""></div>
      <div class="lm-timer" hidden><i data-lucide="clock"></i><span></span></div>
      <button class="btn3d big" data-act="play" data-autofocus><i data-lucide="play"></i>Play</button>
      <div class="lm-skip" hidden>
        <button class="link-btn" data-act="skip"><i data-lucide="skip-forward"></i>Skip level <span class="gem-cost"><i data-lucide="gem"></i>${DIAMOND_PRICES.skip}</span></button>
        <small class="lm-skip-msg"></small>
      </div>`,
  });
  modal.el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    sound.click();
    modal.close();
    if (b.dataset.act === 'play') {
      haptic(15);
      navigate('#/game', { state: campaignConfig(current) });
    }
    if (b.dataset.act === 'skip') askSkip(current);
  });
  return modal;
}

/** Diamond skip: confirm in a sheet, then mark the level cleared with 1 star. */
function askSkip(n) {
  confirmSpend({
    title: `Skip level ${n}?`,
    text: 'You get 1 star and the next level opens. One skip per chapter. Win it later for full rewards.',
    price: DIAMOND_PRICES.skip, currency: 'diamonds', confirmLabel: 'Skip',
    onConfirm: () => {
      const fail = skipLevel(n);
      if (fail) { showToast(fail, 'gem'); sound.error(); return; }
      showToast(`Level ${n} skipped · 1 star`, 'skip-forward');
    },
    onCancel: () => openLevelPopup(n),
  });
}

export function openLevelPopup(n) {
  const m = ensureModal(), lv = getLevel(n), ch = chapterOf(n), best = bestStars(n);
  current = n;
  $('#lmTitle').textContent = `Level ${n}`;
  $('.lm-chapter', m.el).textContent = `Chapter ${ch.index + 1} · ${ch.name}`;
  $('.lm-boss', m.el).hidden = !lv.boss;
  const stars = $('.lm-stars', m.el);
  stars.innerHTML = [0, 1, 2].map(i => starSVG(i < best)).join('');
  stars.setAttribute('aria-label', best ? `Best: ${best} of 3 stars` : 'Not played yet');
  const timer = $('.lm-timer', m.el), timed = app.settings.timerOn;
  timer.hidden = !timed;
  if (timed) timer.querySelector('span').textContent = `${secondsLabel(lv.timeLimit)} per move`;
  // Skip: only the current, uncleared level, once per chapter
  const blocked = skipBlocker(n), skip = $('.lm-skip', m.el);
  const usedHere = blocked && blocked.includes('chapter');
  skip.hidden = !!blocked && !usedHere;
  const need = needText(DIAMOND_PRICES.skip, 'diamonds');
  $('[data-act="skip"]', m.el).disabled = !!blocked || !!need;
  $('.lm-skip-msg', m.el).textContent = usedHere ? blocked : need;
  renderIcons(m.el);
  m.open();
}
