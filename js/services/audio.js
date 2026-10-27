/**
 * Sound effects made with the Web Audio API (no sound files needed).
 * Respects the Sound setting.
 */
import { app } from './storage.js';

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One short tone with a fast fade so there are no clicks. */
function tone(freq, at, dur, type = 'sine', vol = 0.14, slideTo) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator(), gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const on = () => app.settings.sound;

export const sound = {
  click() { if (on()) tone(660, 0, 0.05, 'sine', 0.06); },
  tap(mark) { if (on()) mark === 'X' ? tone(520, 0, 0.09, 'triangle', 0.16, 760) : tone(460, 0, 0.1, 'sine', 0.18, 340); },
  win() { if (on()) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.16)); },
  lose() { if (on()) [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.22, 'triangle', 0.14)); },
  draw() { if (on()) { tone(440, 0, 0.14, 'sine', 0.12); tone(440, 0.16, 0.18, 'sine', 0.12); } },
  error() { if (on()) tone(220, 0, 0.12, 'square', 0.05); },
  coin() { if (on()) { tone(988, 0, 0.05, 'square', 0.04); tone(1319, 0.05, 0.09, 'square', 0.04); } },
  star(i) { if (on()) tone(660 + i * 220, 0, 0.14, 'triangle', 0.14); },
  tick() { if (on()) tone(1200, 0, 0.04, 'square', 0.035); },
};
