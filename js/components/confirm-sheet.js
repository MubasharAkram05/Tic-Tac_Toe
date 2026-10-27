/**
 * Small bottom sheet that confirms a diamond (or coin) purchase, so the
 * app never needs a browser confirm() dialog.
 *
 *   confirmSpend({ title: 'Skip level 12?', text: 'You get 1 star.', price: 5,
 *                  currency: 'diamonds', confirmLabel: 'Skip', onConfirm, onCancel });
 *
 * The buy button is disabled with an inline "Need N more diamonds" message
 * when the player can't afford it. The sheet sits above popups, so it also
 * works from the level popup and the level result card.
 */
import { $, renderIcons, escapeHTML } from '../utils/dom.js';
import { balance, needText } from '../services/economy.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { createSheet } from './bottom-sheet.js';

let sheet = null, pending = null;

function build() {
  sheet = createSheet({
    id: 'confirmSheet', title: '',
    onClose: () => { const p = pending; pending = null; if (p && p.onCancel) p.onCancel(); },
    body: `
      <div class="confirm-body">
        <span class="confirm-icon"><i data-lucide="gem"></i></span>
        <p class="confirm-text"></p>
        <div class="confirm-price"></div>
        <p class="confirm-msg" aria-live="polite"></p>
      </div>`,
    foot: `<div class="two-btns">
      <button type="button" class="btn3d ghost" data-confirm="no">Cancel</button>
      <button type="button" class="btn3d gem" data-confirm="yes" data-autofocus></button>
    </div>`,
  });
  sheet.el.classList.add('confirm-sheet');
  sheet.el.addEventListener('click', e => {
    const b = e.target.closest('[data-confirm]');
    if (!b || b.disabled) return;
    const p = pending;
    if (b.dataset.confirm === 'yes') {
      pending = null;                // confirmed: closing must not run onCancel
      sheet.close();
      haptic([10, 30, 10]);
      if (p && p.onConfirm) p.onConfirm();
    } else {
      sound.click();
      sheet.close();                 // onClose runs onCancel
    }
  });
}

const icon = c => (c === 'diamonds' ? 'gem' : 'coins');

/** Opens the confirm sheet. */
export function confirmSpend({ title, text = '', price, currency = 'diamonds', confirmLabel = 'Buy', onConfirm, onCancel }) {
  if (!sheet) build();
  if (sheet.isOpen()) { pending = null; sheet.close(); }
  pending = { onConfirm, onCancel };
  const need = needText(price, currency);
  sheet.setTitle(title);
  sheet.el.classList.toggle('coins', currency === 'coins');
  $('.confirm-icon', sheet.el).innerHTML = `<i data-lucide="${icon(currency)}"></i>`;
  $('.confirm-text', sheet.el).textContent = text;
  $('.confirm-price', sheet.el).innerHTML =
    `<span>Price</span><b><i data-lucide="${icon(currency)}"></i>${price}</b>` +
    `<span>You have</span><b><i data-lucide="${icon(currency)}"></i>${balance(currency)}</b>`;
  $('.confirm-msg', sheet.el).textContent = need;
  const yes = $('[data-confirm="yes"]', sheet.el);
  yes.disabled = !!need;
  yes.className = `btn3d ${currency === 'diamonds' ? 'gem' : 'gold'}`;
  yes.innerHTML = `<i data-lucide="${icon(currency)}"></i>${escapeHTML(confirmLabel)} · ${price}`;
  renderIcons(sheet.el);
  sound.click();
  sheet.open();
}
