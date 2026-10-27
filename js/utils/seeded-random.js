/**
 * Seeded random numbers, so a level's layout is the same on every device
 * and every replay. Pure functions, no DOM.
 *
 *   const rnd = mulberry32(37);
 *   rnd();           // 0 <= x < 1, always the same sequence for seed 37
 *   randInt(rnd, 2, 5), pick(rnd, list), shuffle(rnd, list)
 */

/** mulberry32: a tiny, fast 32-bit generator. Returns a function giving numbers in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole number from min to max (both included). */
export const randInt = (rnd, min, max) => min + Math.floor(rnd() * (max - min + 1));

/** One item of a list. */
export const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

/** Shuffled copy of a list (Fisher-Yates). O(n). */
export function shuffle(rnd, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
