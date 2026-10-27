/**
 * Service worker: precaches the whole app so it works offline.
 * Bump CACHE when files change so players get the new version.
 * Google Fonts are cached at runtime the first time they load.
 */
const CACHE = 'ttt-v5';
const FONT_CACHE = 'ttt-fonts-v1';
const APP_FILES = [
  './',
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/images/chapter-1.svg",
  "./assets/images/chapter-10.svg",
  "./assets/images/chapter-2.svg",
  "./assets/images/chapter-3.svg",
  "./assets/images/chapter-4.svg",
  "./assets/images/chapter-5.svg",
  "./assets/images/chapter-6.svg",
  "./assets/images/chapter-7.svg",
  "./assets/images/chapter-8.svg",
  "./assets/images/chapter-9.svg",
  "./css/base/layout.css",
  "./css/base/reset.css",
  "./css/base/typography.css",
  "./css/base/variables.css",
  "./css/components/board-twists.css",
  "./css/components/bottom-nav.css",
  "./css/components/bottom-sheet.css",
  "./css/components/buttons.css",
  "./css/components/cards.css",
  "./css/components/modal.css",
  "./css/components/segmented.css",
  "./css/components/timer.css",
  "./css/components/toast.css",
  "./css/main.css",
  "./css/pages/game.css",
  "./css/pages/home.css",
  "./css/pages/levels.css",
  "./css/pages/profile.css",
  "./css/pages/shop.css",
  "./js/components/board-view.js",
  "./js/components/bottom-nav.js",
  "./js/components/bottom-sheet.js",
  "./js/components/confetti.js",
  "./js/components/confirm-sheet.js",
  "./js/components/currency-bar.js",
  "./js/components/level-popup.js",
  "./js/components/modal.js",
  "./js/components/timer-ring.js",
  "./js/components/toast.js",
  "./js/components/twist-tutorial.js",
  "./js/config/constants.js",
  "./js/config/level-twists.js",
  "./js/config/levels.js",
  "./js/config/shop-items.js",
  "./js/config/timers.js",
  "./js/config/twist-table.js",
  "./js/core/ai.js",
  "./js/core/ai.worker.js",
  "./js/core/board.js",
  "./js/core/layout-generator.js",
  "./js/core/layout-validator.js",
  "./js/core/random.js",
  "./js/core/rules.js",
  "./js/core/timer.js",
  "./js/core/twist-ai.js",
  "./js/core/twists/blocked.js",
  "./js/core/twists/coin-cells.js",
  "./js/core/twists/gravity.js",
  "./js/core/twists/ice-cells.js",
  "./js/core/twists/index.js",
  "./js/core/twists/line-rule.js",
  "./js/core/twists/preset.js",
  "./js/core/twists/shrinking.js",
  "./js/core/twists/vanishing.js",
  "./js/core/twists/wrap.js",
  "./js/main.js",
  "./js/pages/game.js",
  "./js/pages/home.js",
  "./js/pages/levels.js",
  "./js/pages/profile.js",
  "./js/pages/settings.js",
  "./js/pages/shop.js",
  "./js/router.js",
  "./js/services/achievements.js",
  "./js/services/ai-runner.js",
  "./js/services/audio.js",
  "./js/services/economy.js",
  "./js/services/haptics.js",
  "./js/services/progress.js",
  "./js/services/stats.js",
  "./js/services/storage.js",
  "./js/services/theme.js",
  "./js/utils/dom.js",
  "./js/utils/events.js",
  "./js/utils/format.js",
  "./js/utils/icons.js",
  "./js/utils/seeded-random.js",
  "./js/utils/validate.js",
  "./index.html",
  "./manifest.json",
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: cache first, then network (works offline after the first visit)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONT_CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App files: cache first, fall back to the network, then to the app shell
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => caches.match('./index.html'))),
  );
});
