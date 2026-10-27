/**
 * Vibration feedback (where the phone supports it). Respects the setting.
 */
import { app } from './storage.js';

export function haptic(pattern) {
  if (!app.settings.vibration || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* not allowed right now */ }
}
