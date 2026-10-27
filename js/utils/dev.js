/**
 * Dev unlock for testing: open the game with ?dev=1 and every level is
 * playable. It only works on a dev host (localhost, a LAN address, a Vercel
 * branch preview). The live site is always blocked, so players can never
 * turn it on.
 *
 * Dev mode is a sandbox: progress goes to its own save key (storage.js), so
 * testing never touches real progress, even on the same device.
 */

/** The live site. Dev mode is never active here, whatever the URL says. */
export const PRODUCTION_HOSTS = ['tic-tac-toe-five-silk-91.vercel.app'];

/** True for hosts where testing tools may run (pure, so it can be tested). */
export function isDevHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || PRODUCTION_HOSTS.includes(h)) return false;
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
  if (/^(192\.168|10)\.\d+\.\d+(\.\d+)?$/.test(h)) return true;           // phone testing on the LAN
  return h.endsWith('.vercel.app') && h.includes('-git-');                 // Vercel branch previews only
}

/** True when ?dev=1 is set on a dev host. Worked out once per page load. */
export function readDevMode(loc) {
  if (!loc || !isDevHost(loc.hostname)) return false;
  try { return new URLSearchParams(loc.search).get('dev') === '1'; } catch (e) { return false; }
}

export const DEV = typeof location !== 'undefined' && readDevMode(location);
