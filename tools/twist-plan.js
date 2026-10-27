/**
 * Shared by the table generator and the tests: plans every level's twists
 * (config/level-twists.js) and searches each layout with full validation.
 */
import { TOTAL_LEVELS, chapterOf, isBoss } from '../js/config/levels.js';
import { winLength } from '../js/config/constants.js';
import { planAllTwists, BOSS_OVERRIDES } from '../js/config/level-twists.js';
import { findLayout } from '../js/core/layout-validator.js';
import { TWIST_CODES } from '../js/config/twist-table.js';

/** The fields the generator uses, without the twists themselves. */
export function baseLevel(n) {
  const ch = chapterOf(n);
  if (!ch) return null;
  return { id: n, chapter: ch.index, size: ch.size, winLength: winLength(ch.size), boss: isBoss(n) };
}

let plans = null;
/** Planned twist ids of level n (before the layout search). */
export function planFor(n) {
  if (!plans) plans = planAllTwists(TOTAL_LEVELS, baseLevel);
  return plans[n] || [];
}

const CODE = Object.fromEntries(Object.entries(TWIST_CODES).map(([c, id]) => [id, c]));

/** { table, stats }: table[n] = [codes, attempt, puzzleMoves?] for every twist level that found a layout. */
export function tableEntries() {
  const table = {}, stats = { planned: 0, fallback: [], overrides: 0 };
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    if (BOSS_OVERRIDES[n]) { stats.overrides++; continue; }
    const twists = planFor(n);
    if (!twists.length) continue;
    stats.planned++;
    const found = findLayout(n, baseLevel(n), twists);
    if (!found) { stats.fallback.push(n); continue; }
    const codes = twists.map(id => CODE[id]).join('');
    table[n] = found.layout.puzzleMoves ? [codes, found.attempt, found.layout.puzzleMoves] : [codes, found.attempt];
  }
  return { table, stats };
}
