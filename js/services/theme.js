/**
 * Light / dark theme (auto by time of day or manual) and the board theme
 * bought in the shop.
 */
import { app, save } from './storage.js';

/** 'light' from 7:00 to 19:00 in auto mode. */
export function resolvedTheme() {
  if (app.settings.theme !== 'auto') return app.settings.theme;
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? 'light' : 'dark';
}

export function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#fde8dc' : '#1b1838');
}

export function setTheme(value) {
  app.settings.theme = value;
  applyTheme();
}

/** Board theme + skins are read from the save; this sets the page-wide board theme. */
export function applyCosmetics() {
  document.documentElement.dataset.board = save.data.equipped.board;
}

/** Re-checks the auto theme every 5 minutes. */
export function startAutoTheme() {
  applyTheme();
  setInterval(() => { if (app.settings.theme === 'auto') applyTheme(); }, 5 * 60 * 1000);
}
