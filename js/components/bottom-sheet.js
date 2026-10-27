/**
 * Bottom sheets: slide up from the bottom, close on swipe down, backdrop
 * tap, the X button or Escape. They stay above the on-screen keyboard.
 *
 *   const sheet = createSheet({ id, title, body, foot, form: true });
 *   sheet.open(); sheet.close(); sheet.destroy();
 */
import { $, renderIcons } from '../utils/dom.js';
import { emit } from '../utils/events.js';

const stack = [];
let backdrop = null;

function getBackdrop() {
  if (!backdrop) {
    backdrop = $('#sheetBackdrop');
    backdrop.addEventListener('click', () => closeTopSheet());
  }
  return backdrop;
}

export const anySheetOpen = () => stack.length > 0;
export function closeTopSheet() {
  const top = stack[stack.length - 1];
  if (top) top.close();
  return !!top;
}

/** Keeps sheets inside the visible area when the keyboard opens (iOS + Android). */
export function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', kb + 'px');
    document.documentElement.style.setProperty('--vvh', vv.height + 'px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

export function createSheet({ id, title = '', body = '', foot = '', form = false, onClose }) {
  const el = document.createElement(form ? 'form' : 'div');
  el.className = 'sheet';
  el.id = id;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', `${id}-title`);
  if (form) el.noValidate = true;
  el.innerHTML = `
    <div class="sheet-grab">
      <div class="sheet-handle"></div>
      <div class="sheet-head">
        <h3 id="${id}-title">${title}</h3>
        <button type="button" class="icon-btn" data-close-sheet aria-label="Close"><i data-lucide="x"></i></button>
      </div>
    </div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
  document.body.appendChild(el);
  renderIcons(el);

  const api = {
    el,
    isOpen: () => el.classList.contains('open'),
    setTitle(t) { el.querySelector(`#${id}-title`).textContent = t; },
    open() {
      if (stack.includes(api)) return;
      stack.push(api);
      el.style.zIndex = 21 + stack.length;
      el.classList.add('open');
      getBackdrop().classList.add('open');
      emit('sheet', { open: true, id });
    },
    close() {
      if (!stack.includes(api)) return;
      stack.splice(stack.indexOf(api), 1);
      el.classList.remove('open');
      el.style.transform = '';
      if (el.contains(document.activeElement)) document.activeElement.blur();
      if (!stack.length) getBackdrop().classList.remove('open');
      emit('sheet', { open: false, id });
      if (onClose) onClose();
    },
    destroy() { api.close(); el.remove(); },
  };

  // Drag the handle / header down to close
  const grab = el.querySelector('.sheet-grab');
  let y0 = null, dy = 0;
  grab.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    y0 = e.clientY; dy = 0;
    grab.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  grab.addEventListener('pointermove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    el.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 === null) return;
    y0 = null;
    el.classList.remove('dragging');
    if (dy > 80) api.close(); else el.style.transform = '';
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
  el.querySelectorAll('[data-close-sheet]').forEach(b => b.addEventListener('click', () => api.close()));
  // keep a focused input visible above the keyboard
  el.addEventListener('focusin', e => {
    if (e.target.matches('input, textarea')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
  return api;
}
