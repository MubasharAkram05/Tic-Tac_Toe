/**
 * App entry: load saved data, apply the theme, start the router,
 * wire global keys and register the service worker for offline play.
 */
import { initStorage } from './services/storage.js';
import { startAutoTheme, applyCosmetics } from './services/theme.js';
import { trackKeyboard, closeTopSheet } from './components/bottom-sheet.js';
import { closeTopModal } from './components/modal.js';
import { initToasts } from './components/toast.js';
import { initCurrencyBar } from './components/currency-bar.js';
import { sound } from './services/audio.js';
import { haptic } from './services/haptics.js';
import { $, renderIcons } from './utils/dom.js';
import { startRouter, navigate, goBack } from './router.js';
import { DEV } from './utils/dev.js';

initStorage();
startAutoTheme();
applyCosmetics();
trackKeyboard();
initToasts();
renderIcons(document);
initCurrencyBar();
// ?dev=1 on a dev host: all levels open, sandbox save. A badge makes it obvious.
if (DEV) document.body.insertAdjacentHTML('beforeend', '<div class="dev-badge" role="status" aria-label="Dev mode: all levels unlocked, progress saved separately">DEV</div>');
startRouter();

// Any element with data-go="#/route" navigates there (coin / diamond pills, settings buttons, nav tabs)
document.addEventListener('click', e => {
  const link = e.target.closest('[data-go]');
  if (!link) return;
  e.preventDefault();
  sound.click();
  haptic(8);
  navigate(link.dataset.go);
});
$('#appBack').addEventListener('click', () => { sound.click(); goBack('#/profile'); });

// Escape closes the top popup, then the top sheet
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!closeTopModal()) closeTopSheet();
});

// Splash: tap to skip, or it fades out by itself
const splash = $('#splash');
const hideSplash = () => splash.classList.add('gone');
splash.addEventListener('click', hideSplash);
setTimeout(hideSplash, 1500);
splash.addEventListener('transitionend', () => splash.remove(), { once: true });

// Offline support (only over http/https)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
