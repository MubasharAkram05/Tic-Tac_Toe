import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MoveTimer } from '../js/core/timer.js';

/** A fake clock so the tests are instant and exact. */
function fakeClock() {
  let t = 0;
  return { now: () => t, advance: ms => { t += ms; } };
}

test('remaining time comes from timestamps, not tick counts', () => {
  const clock = fakeClock();
  const timer = new MoveTimer({ seconds: 10, now: clock.now, interval: 100000 });
  timer.start();
  clock.advance(3500);
  assert.equal(timer.remaining, 6500);
  assert.equal(timer.fraction, 0.65);
  timer.stop();
});

test('pause and resume keep the remaining time', () => {
  const clock = fakeClock();
  const timer = new MoveTimer({ seconds: 10, now: clock.now, interval: 100000 });
  timer.start();
  clock.advance(2000);
  timer.pause();
  clock.advance(60000); // app in the background for a minute
  assert.equal(timer.remaining, 8000);
  timer.resume();
  clock.advance(1000);
  assert.equal(timer.remaining, 7000);
  timer.stop();
});

test('expires once and calls onExpire', () => {
  const clock = fakeClock();
  let expired = 0;
  const timer = new MoveTimer({ seconds: 1, now: clock.now, interval: 100000, onExpire: () => { expired++; } });
  timer.start();
  clock.advance(1200);
  timer.tick();
  timer.tick();
  assert.equal(expired, 1);
  assert.equal(timer.remaining, 0);
});

test('addTime extends the current move and the ring total', () => {
  const clock = fakeClock();
  const timer = new MoveTimer({ seconds: 10, now: clock.now, interval: 100000 });
  timer.start();
  clock.advance(8000);
  timer.addTime(10000);
  assert.equal(timer.remaining, 12000);
  assert.equal(timer.duration, 12000);
  clock.advance(2000);
  assert.equal(timer.remaining, 10000);
  timer.stop();
  timer.addTime(5000); // ignored once stopped
  assert.equal(timer.remaining, 10000);
});
