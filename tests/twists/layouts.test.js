import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, TOTAL_LEVELS, CHAPTERS } from '../../js/config/levels.js';
import {
  BOSS_OVERRIDES, INTRO, FORBIDDEN, MIN_SIZE, MIXES_FROM, maxTwists, overrideLayout, BLOCKED_COUNTS, TWIST_IDS,
} from '../../js/config/level-twists.js';
import { TWIST_TABLE } from '../../js/config/twist-table.js';
import { buildLayout, generateLayout } from '../../js/core/layout-generator.js';
import { validateLayout, validateBlocked } from '../../js/core/layout-validator.js';
import { createBoard } from '../../js/core/board.js';
import { createState, winFrom } from '../../js/core/twists/index.js';
import { maxRings } from '../../js/core/twists/shrinking.js';
import { mulberry32 } from '../../js/utils/seeded-random.js';
import { tableEntries, baseLevel } from '../../tools/twist-plan.js';

const all = Array.from({ length: TOTAL_LEVELS }, (_, i) => getLevel(i + 1));

test('mulberry32: same seed = same numbers, different seed = different numbers', () => {
  const a = mulberry32(37), b = mulberry32(37), c = mulberry32(38);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('twist table is up to date (run `npm run twists` after changing levels or twists)', () => {
  assert.deepEqual(tableEntries().table, { ...TWIST_TABLE });
});

test('all 500 levels pass validation', () => {
  all.forEach(l => {
    if (!l.twists.length) { assert.equal(l.layout, null, `level ${l.id}`); return; }
    assert.equal(validateLayout(l.layout, l), '', `level ${l.id} (${l.twists.join('+')})`);
  });
});

test('forbidden combos never appear; puzzles only with blocked / coins', () => {
  all.forEach(l => {
    FORBIDDEN.forEach(([a, b]) => assert.ok(!(l.twists.includes(a) && l.twists.includes(b)), `level ${l.id}: ${a} + ${b}`));
    if (l.twists.includes('puzzle')) assert.ok(l.twists.every(id => ['puzzle', 'blocked', 'coins'].includes(id)), `level ${l.id}`);
  });
});

test('same seed = same layout, every time', () => {
  for (const n of [25, 41, 137, 222, 313, 444, 499]) {
    const lv = baseLevel(n);
    assert.deepEqual(generateLayout(n, lv), generateLayout(n, lv));
    if (lv.size >= 5) assert.deepEqual(buildLayout(n, lv, ['ice', 'coins'], 3), buildLayout(n, lv, ['ice', 'coins'], 3));
  }
});

test('intro schedule: one new twist at a time, the intro level has only that twist and is easy', () => {
  assert.deepEqual(INTRO, { coins: 25, vanish: 41, blocked: 51, ice: 71, lines: 101, gravity: 121, puzzle: 196, wrap: 261, shrink: 281 });
  for (const [id, n] of Object.entries(INTRO)) {
    const l = getLevel(n);
    assert.deepEqual(l.twists, [id], `level ${n}`);
    assert.equal(l.boss, false, `intro ${n} is not a boss`);
    assert.equal(l.intro, id);
    assert.equal(l.aiSkill, 0.4);
    assert.equal(l.moveLimit, id === 'puzzle' ? l.layout.puzzleMoves : 0);
    for (let m = 1; m < n; m++) assert.ok(!getLevel(m).twists.includes(id), `${id} before its intro (level ${m})`);
  }
  all.filter(l => l.id <= 20).forEach(l => assert.deepEqual(l.twists, []));
});

test('max 2 twists on normal levels and 3 on bosses (1 / 2 before level 300)', () => {
  all.forEach(l => assert.ok(l.twists.length <= maxTwists(l.id, l.boss), `level ${l.id}: ${l.twists}`));
  assert.ok(all.some(l => l.id >= MIXES_FROM && !l.boss && l.twists.length === 2));
  assert.ok(all.some(l => l.boss && l.twists.length === 3));
});

test('a normal level comes after at most 4 twist levels in a row', () => {
  let streak = 0;
  all.forEach(l => {
    streak = l.twists.length ? streak + 1 : 0;
    assert.ok(streak <= 4, `level ${l.id}: ${streak} twist levels in a row`);
  });
});

test('after its intro, a new twist shows up in about 20-30% of levels', () => {
  for (const [id, n] of Object.entries(INTRO)) {
    if (id === 'shrink' || id === 'puzzle') continue; // only on big boards / mostly bosses
    let hits = 0;
    for (let m = n + 1; m <= n + 40; m++) if (getLevel(m).twists.includes(id)) hits++;
    assert.ok(hits / 40 >= 0.15 && hits / 40 <= 0.45, `${id}: ${hits}/40`);
  }
});

test('every twist only on boards it fits', () => {
  all.forEach(l => l.twists.forEach(id => assert.ok(l.size >= MIN_SIZE[id], `level ${l.id}: ${id} on ${l.size}x${l.size}`)));
  all.filter(l => l.layout && l.layout.rule === 'diagonal').forEach(l => assert.ok(l.size >= 6));
  all.filter(l => l.layout && l.layout.shrink).forEach(l => {
    assert.ok(l.layout.shrink.rings <= maxRings(l.size, l.winLength));
    assert.ok(l.size - 2 * l.layout.shrink.rings >= l.winLength + 2, `level ${l.id}`);
  });
});

test('coins and ice never sit on blocked cells; counts are in range', () => {
  all.filter(l => l.layout).forEach(l => {
    const blocked = new Set(l.layout.blocked);
    (l.layout.coins || []).forEach(c => assert.ok(!blocked.has(c.i), `level ${l.id} coin`));
    (l.layout.ice || []).forEach(c => assert.ok(!blocked.has(c.i), `level ${l.id} ice`));
    if (l.twists.includes('blocked') && !BOSS_OVERRIDES[l.id]) {
      const [lo, hi] = BLOCKED_COUNTS[l.size], n = l.layout.blocked.length;
      assert.ok(n >= lo && n <= hi, `level ${l.id}: ${n} blocked`);
    }
    const gems = (l.layout.coins || []).filter(c => c.kind === 'diamond').length;
    if (!l.boss) assert.equal(gems, 0, `level ${l.id}: diamond cell on a normal level`);
  });
});

test('no level starts with a win', () => {
  all.filter(l => l.layout).forEach(l => {
    const s = createState(l.size, l.layout);
    s.board.forEach((v, i) => { if (v === 'X' || v === 'O') assert.equal(winFrom(s, i), null, `level ${l.id}`); });
  });
});

test('hand-crafted boss overrides win over generated layouts', () => {
  for (const n of Object.keys(BOSS_OVERRIDES).map(Number)) {
    const o = overrideLayout(n), l = getLevel(n);
    assert.equal(o.size, l.size, `override ${n} size`);
    assert.deepEqual(l.layout.blocked, o.blocked);
    assert.deepEqual(l.layout.preset, o.preset);
    assert.equal(validateLayout(l.layout, l), '', `override ${n}`);
  }
});

test('validators reject bad layouts', () => {
  const lv = baseLevel(301); // 9x9
  assert.notEqual(validateLayout({ twists: ['gravity', 'vanish'], blocked: [], preset: [], gravity: true, vanish: { limit: 7 } }, lv), '');
  assert.notEqual(validateLayout({ twists: ['wrap', 'shrink'], blocked: [], preset: [], wrap: true, shrink: { rings: 1 } }, lv), '');
  assert.match(validateLayout({ twists: ['shrink'], blocked: [], preset: [], shrink: { rings: 2 } }, lv), /win length \+ 2/);
  assert.match(validateLayout({ twists: ['coins', 'blocked'], blocked: [3], preset: [], coins: [{ i: 3, kind: 'coin', amount: 5 }] }, lv), /overlap/);
  assert.notEqual(validateBlocked(createBoard(9, { blocked: [30, 40, 50], preset: [] }), 9, 5), '');
  const lv5 = baseLevel(60); // 5x5
  assert.match(validateLayout({ twists: ['wrap'], blocked: [], preset: [], wrap: true }, lv5), /needs 8x8/);
});

test('every twist id is used somewhere in the campaign', () => {
  TWIST_IDS.forEach(id => assert.ok(all.some(l => l.twists.includes(id)), id));
  assert.equal(CHAPTERS.length, 10);
});
