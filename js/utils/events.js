/**
 * Tiny event bus so services can tell the UI that something changed
 * (coins, toasts, progress) without importing UI code.
 *
 * Events used:
 *   'coins'    { from, to }        coin total changed
 *   'toast'    { text, icon }      show a toast
 *   'progress' {}                  save data changed (levels, items, stats)
 *   'sheet'    { open: boolean }   any bottom sheet opened / closed
 */
const listeners = new Map();

export function onEvent(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name).delete(fn);
}

export function emit(name, detail = {}) {
  (listeners.get(name) || []).forEach(fn => {
    try { fn(detail); } catch (e) { console.error(e); }
  });
}
