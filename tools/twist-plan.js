/**
 * Shared by the table generator and the tests: plans every level's twist
 * and searches its layout (with full validation).
 */
import { TOTAL_LEVELS, chapterOf, isBoss } from '../js/config/levels.js';
import { winLength } from '../js/config/constants.js';
import { planTwist, BOSS_OVERRIDES } from '../js/config/level-twists.js';
import { findLayout } from '../js/core/layout-validator.js';

/** The fields the generator uses, without the twist itself. */
export function baseLevel(n) {
  const ch = chapterOf(n);
  return { id: n, chapter: ch.index, size: ch.size, winLength: winLength(ch.size), boss: isBoss(n) };
}

export function planTwistFor(n) {
  const prev = n > 1 ? { chapter: chapterOf(n - 1).index, boss: isBoss(n - 1) } : null;
  return planTwist(n, chapterOf(n).index, isBoss(n), prev);
}

const CODE = { blocked: 'b', puzzle: 'p', mixed: 'm' };

/** { table, stats }: table[n] = [code, attempt, puzzleMoves?] for every twist level that found a layout. */
export function tableEntries() {
  const table = {}, stats = { planned: 0, fallback: [], overrides: 0 };
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    if (BOSS_OVERRIDES[n]) { stats.overrides++; continue; }
    const type = planTwistFor(n);
    if (type === 'none') continue;
    stats.planned++;
    const found = findLayout(n, baseLevel(n), type);
    if (!found) { stats.fallback.push(n); continue; }
    table[n] = found.layout.puzzleMoves ? [CODE[type], found.attempt, found.layout.puzzleMoves] : [CODE[type], found.attempt];
  }
  return { table, stats };
}
