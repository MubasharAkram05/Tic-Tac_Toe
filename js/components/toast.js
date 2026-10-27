/**
 * Small toast messages at the top of the screen.
 * Services trigger them with emit('toast', { text, icon }).
 */
import { $, renderIcons } from '../utils/dom.js';
import { onEvent } from '../utils/events.js';

export function showToast(text, icon = 'sparkles') {
  const wrap = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i data-lucide="${icon}"></i><span></span>`;
  t.querySelector('span').textContent = text;
  wrap.appendChild(t);
  renderIcons(t);
  while (wrap.children.length > 3) wrap.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 2600);
}

export function initToasts() {
  onEvent('toast', ({ text, icon }) => showToast(text, icon));
}
