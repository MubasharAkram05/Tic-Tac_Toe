/**
 * Bottom navigation (Home / Levels / Profile). Hidden during a game.
 */
import { $, $$ } from '../utils/dom.js';

/** Which tab is highlighted for each route (shop belongs to Profile). */
const TAB_FOR = { home: 'home', levels: 'levels', profile: 'profile', shop: 'profile' };

export function updateBottomNav(route) {
  const tab = TAB_FOR[route];
  $$('#bottomNav .nav-btn').forEach(b => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#bottomNav').classList.toggle('hidden', !tab);
}
