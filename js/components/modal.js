/**
 * Centered popup cards (result, level start, leave confirm).
 *
 *   const m = createModal({ id, html, labelledBy, role, dismissible });
 *   m.open(); m.close(); m.destroy();
 */
import { renderIcons } from '../utils/dom.js';

const stack = [];

export const anyModalOpen = () => stack.length > 0;

/** Closes the top modal if it may be dismissed (Escape). Returns true if one closed. */
export function closeTopModal() {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].dismissible) { stack[i].close(); return true; }
  }
  return false;
}

export function createModal({ id, html, labelledBy, role = 'dialog', dismissible = true, cardClass = '' }) {
  const el = document.createElement('div');
  el.className = 'overlay modal';
  el.id = id;
  el.setAttribute('role', role);
  el.setAttribute('aria-modal', 'true');
  if (labelledBy) el.setAttribute('aria-labelledby', labelledBy);
  el.innerHTML = `<div class="modal-card ${cardClass}">${html}</div>`;
  document.body.appendChild(el);
  renderIcons(el);

  const api = {
    el,
    card: el.firstElementChild,
    dismissible,
    isOpen: () => el.classList.contains('open'),
    open() {
      if (!stack.includes(api)) stack.push(api);
      el.classList.add('open');
      const focusable = el.querySelector('[data-autofocus]');
      if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 60);
    },
    close() {
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      el.classList.remove('open');
    },
    destroy() { api.close(); el.remove(); },
  };
  return api;
}
