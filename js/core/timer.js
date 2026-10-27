/**
 * Move timer. Pure logic (no DOM): remaining time is always computed from
 * timestamps, not by counting ticks, so it stays accurate on slow phones
 * and after the tab was throttled.
 *
 *   const t = new MoveTimer({ seconds: 20, onTick, onExpire });
 *   t.start(); t.pause(); t.resume(); t.stop(); t.addTime(10000);
 *
 * onTick(remainingMs, fraction) runs every `interval` ms while running.
 * onExpire() runs once when time is up.
 */
export class MoveTimer {
  constructor({ seconds, onTick = () => {}, onExpire = () => {}, interval = 100, now = () => performance.now() }) {
    this.duration = seconds * 1000;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.interval = interval;
    this.now = now;
    this.left = this.duration;   // ms left when last paused / started
    this.startedAt = 0;
    this.handle = 0;
    this.running = false;
    this.done = false;
  }

  /** Time left in ms (never below 0). */
  get remaining() {
    if (!this.running) return Math.max(0, this.left);
    return Math.max(0, this.left - (this.now() - this.startedAt));
  }

  /** 1 = full time left, 0 = time is up. */
  get fraction() {
    return this.duration ? this.remaining / this.duration : 0;
  }

  start() {
    this.stop();
    this.left = this.duration;
    this.done = false;
    this.resume();
  }

  resume() {
    if (this.running || this.done || this.left <= 0) return;
    this.running = true;
    this.startedAt = this.now();
    this.handle = setInterval(() => this.tick(), this.interval);
    this.tick();
  }

  pause() {
    if (!this.running) return;
    this.left = this.remaining;
    this.running = false;
    clearInterval(this.handle);
    this.handle = 0;
  }

  stop() {
    this.pause();
    this.done = true;
  }

  /**
   * Adds time to the current move (e.g. +10s bought with a diamond). The ring
   * is measured against the new, longer total, so it jumps back up.
   */
  addTime(ms) {
    if (this.done || !(ms > 0)) return;
    const wasRunning = this.running;
    this.pause();
    this.left += ms;
    this.duration = Math.max(this.duration, this.left);
    if (wasRunning) this.resume(); else this.tick();
  }

  tick() {
    const r = this.remaining;
    this.onTick(r, this.duration ? r / this.duration : 0);
    if (r <= 0 && !this.done) {
      this.stop();
      this.onExpire();
    }
  }
}
