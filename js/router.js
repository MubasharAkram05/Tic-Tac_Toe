/**
 * Hash router: #/home, #/levels, #/game, #/profile, #/shop, #/settings.
 *
 * - Pages export mount(el, params, state), unmount() and optional
 *   beforeLeave(proceed) and appBar settings.
 * - "settings" is an overlay: it opens as a sheet on top of the current page.
 * - navigate(hash, { state }) passes data to the next page (e.g. a game config).
 */
import { $, renderIcons } from './utils/dom.js';
import { updateBottomNav } from './components/bottom-nav.js';
import * as home from './pages/home.js';
import * as levels from './pages/levels.js';
import * as game from './pages/game.js';
import * as profile from './pages/profile.js';
import * as shop from './pages/shop.js';
import * as settings from './pages/settings.js';

const PAGES = { home, levels, game, profile, shop };
const OVERLAYS = { settings };
const ORDER = { home: 1, levels: 2, profile: 3, shop: 4, game: 5 };

let current = null;          // { name, mod, el, hash }
let pendingState = null;
let force = false;
let depth = 0;               // how many in-app history entries we pushed

function parse(hash) {
  const [path, query = ''] = (hash || '').replace(/^#\/?/, '').split('?');
  const name = path || 'home';
  return { name, params: Object.fromEntries(new URLSearchParams(query)) };
}

/** Goes to a route. { replace } swaps the history entry, { force } skips beforeLeave. */
export function navigate(hash, { replace = false, state = null, force: f = false } = {}) {
  pendingState = state;
  force = f;
  if (location.hash === hash && !replace) { handle(); return; }
  if (replace) { history.replaceState(null, '', hash); handle(); }
  else { depth++; location.hash = hash; }
}

/** Back inside the app, or to a fallback route if there is no in-app history. */
export function goBack(fallback = '#/home') {
  if (depth > 0) { depth--; history.back(); }
  else navigate(fallback, { replace: true });
}

export const currentRoute = () => (current ? current.name : '');

function applyAppBar(cfg = {}) {
  const bar = $('#appBar');
  bar.hidden = !!cfg.hidden;
  $('#appBack').hidden = !cfg.back;
  $('#appTitle').textContent = cfg.title || '';
  $('#appExtra').innerHTML = '';
  $('#appSettings').hidden = cfg.settings === false;
}

function mount(name, params) {
  const mod = PAGES[name] || home;
  const host = $('#pageHost');
  const el = document.createElement('section');
  el.className = `page page-${name}`;
  const dir = current ? Math.sign((ORDER[name] || 0) - (ORDER[current.name] || 0)) : 0;
  if (current) {
    const old = current;
    try { old.mod.unmount(); } catch (e) { console.error(e); }
    old.el.classList.add(dir < 0 ? 'leave-right' : 'leave-left');
    setTimeout(() => old.el.remove(), 280);
  }
  el.classList.add(dir > 0 ? 'enter-right' : dir < 0 ? 'enter-left' : 'enter-fade');
  host.appendChild(el);
  current = { name, mod, el, hash: location.hash || '#/home' };
  applyAppBar(mod.appBar);
  updateBottomNav(name);
  document.body.dataset.route = name;
  const state = pendingState;
  pendingState = null;
  mod.mount(el, params, state);
  renderIcons(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('active')));
}

function handle() {
  const { name, params } = parse(location.hash);

  // Overlay routes open on top of whatever page is showing
  if (OVERLAYS[name]) {
    if (!current) mount('home', {});
    OVERLAYS[name].open(params, () => { if (parse(location.hash).name === name) goBack('#/home'); });
    return;
  }
  Object.values(OVERLAYS).forEach(o => o.close());

  if (current && current.name === name) {
    current.hash = location.hash;
    if (current.mod.update) current.mod.update(params, pendingState);
    pendingState = null;
    return;
  }
  // Let the current page stop the change (e.g. "Leave game?")
  if (current && current.mod.beforeLeave && !force) {
    const target = location.hash;
    const state = pendingState;
    history.replaceState(null, '', current.hash);
    const ok = current.mod.beforeLeave(() => navigate(target, { force: true, state, replace: true }));
    if (!ok) return;
    history.replaceState(null, '', target);
  }
  force = false;
  mount(PAGES[name] ? name : 'home', params);
}

export function startRouter() {
  window.addEventListener('hashchange', handle);
  if (!location.hash) history.replaceState(null, '', '#/home');
  handle();
}
