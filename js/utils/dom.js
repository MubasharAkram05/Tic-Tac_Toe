/**
 * Small DOM helpers shared by components and pages.
 */
import { createIcons } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Creates one element from an HTML string. */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Adds a listener and returns a function that removes it (handy for unmount). */
export function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  return () => target.removeEventListener(type, fn, opts);
}

/** Collects cleanup functions so a page can undo everything in unmount(). */
export function createScope() {
  const fns = [];
  return {
    on(target, type, fn, opts) { fns.push(on(target, type, fn, opts)); },
    add(fn) { fns.push(fn); },
    timeout(fn, ms) { const id = setTimeout(fn, ms); fns.push(() => clearTimeout(id)); return id; },
    dispose() { while (fns.length) { try { fns.pop()(); } catch (e) { /* keep cleaning */ } } },
  };
}

export const escapeHTML = s => String(s).replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/** Turns <i data-lucide="name"> placeholders into inline Lucide SVGs. */
export const renderIcons = (root = document) => createIcons(root);

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Restarts a CSS animation class on an element. */
export function replayClass(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Updates a segmented control: sliding thumb position + aria-checked. */
export function setSeg(seg, val) {
  if (!seg) return;
  const btns = Array.from(seg.querySelectorAll(':scope > button'));
  const idx = Math.max(0, btns.findIndex(b => b.dataset.val === String(val)));
  seg.style.setProperty('--count', btns.length);
  seg.style.setProperty('--idx', idx);
  btns.forEach((b, i) => b.setAttribute('aria-checked', String(i === idx)));
}

/** Shows a name field's counter ("3/12") and inline error under the input. */
export function setFieldState(row, value, error, max) {
  if (!row) return;
  row.querySelector('.count').textContent = `${value.length}/${max}`;
  row.classList.toggle('invalid', !!error);
  row.querySelector('input').setAttribute('aria-invalid', String(!!error));
  row.querySelector('.err').textContent = error;
}

/** HTML for a name input with the counter right under it, aligned right. */
export function nameFieldHTML({ id, field, label, hint = '', placeholder = '', enterkey = 'go', max }) {
  return `<div class="form-row" data-field="${field}">
    <label class="lbl" for="${id}">${label}${hint ? ` <small>${hint}</small>` : ''}</label>
    <input class="text-input" id="${id}" type="text" maxlength="${max}" placeholder="${placeholder}" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="${enterkey}" aria-describedby="${id}-err">
    <div class="field-meta"><span class="err" id="${id}-err" aria-live="polite"></span><span class="count">0/${max}</span></div>
  </div>`;
}

/** HTML for a segmented control. options = [{ val, label, aria? }] */
export function segHTML({ group, key, label, options }) {
  return `<div class="seg" data-group="${group}" data-key="${key}" role="radiogroup" aria-label="${label}">
    <span class="seg-thumb"></span>
    ${options.map(o => `<button type="button" role="radio" data-val="${o.val}"${o.aria ? ` aria-label="${o.aria}"` : ''}>${o.label}</button>`).join('')}
  </div>`;
}
