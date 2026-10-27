import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../js/services/storage.js';
import { SAVE_VERSION, STORAGE_KEYS } from '../js/config/constants.js';

/** A save as version 1 (200-level campaign) wrote it. */
const v1 = () => ({
  version: 1,
  profile: { name: 'Ali', avatar: 'cat' },
  coins: 345, coinsEarned: 900, xp: 420, purchases: 2,
  levels: { 1: { stars: 3, completed: true }, 2: { stars: 2, completed: true }, 15: { stars: 1, completed: true }, 137: { stars: 3, completed: true } },
  unlockedLevel: 138,
  owned: { board: ['classic', 'neon'], skin: ['classic'], avatar: ['user', 'cat'] },
  inventory: { hint: 1, undo: 0 },
  equipped: { board: 'neon', skin: 'classic', avatar: 'cat' },
  stats: { all: { played: 10, wins: 6, losses: 3, draws: 1, streak: 2, best: 4 } },
  achievements: { first_win: 123 },
  daily: { last: '2026-10-20', streak: 3 },
});

test('the save moved to a v2 key', () => {
  assert.equal(SAVE_VERSION, 2);
  assert.equal(STORAGE_KEYS.save, 'ttt_save_v2');
  assert.equal(STORAGE_KEYS.legacySave, 'ttt_save_v1');
  assert.equal(STORAGE_KEYS.settings, 'ttt.v3');
});

test('v1 -> v2 keeps every cleared level, star, coin and item', () => {
  const d = migrate(v1());
  assert.equal(d.version, 2);
  assert.deepEqual(d.levels, { 1: { stars: 3, completed: true }, 2: { stars: 2, completed: true }, 15: { stars: 1, completed: true }, 137: { stars: 3, completed: true } });
  assert.equal(d.unlockedLevel, 138);         // same level numbers in the new table
  assert.equal(d.coins, 345);
  assert.equal(d.xp, 420);
  assert.equal(d.profile.name, 'Ali');
  assert.deepEqual(d.owned.board, ['classic', 'neon']);
  assert.equal(d.equipped.avatar, 'cat');
  assert.equal(d.stats.all.wins, 6);
  assert.ok(d.achievements.first_win);
  // new v2 fields
  assert.equal(d.diamonds, 0);
  assert.deepEqual(d.skips, []);
  assert.deepEqual(d.rewards, { complete: [], perfect: [] });
  assert.equal(d.daily.run, 3);
});

test('a finished 200-level campaign continues at level 201', () => {
  const old = v1();
  old.levels[200] = { stars: 2, completed: true };
  old.unlockedLevel = 200;
  assert.equal(migrate(old).unlockedLevel, 201);
});

test('v2 data round-trips; broken data never crashes', () => {
  const d = migrate(v1());
  d.diamonds = 12;
  d.levels[20] = { stars: 1, completed: true, skipped: true };
  d.skips = [0, 99, 'x'];
  const again = migrate(JSON.parse(JSON.stringify(d)));
  assert.equal(again.diamonds, 12);
  assert.deepEqual(again.levels[20], { stars: 1, completed: true, skipped: true });
  assert.deepEqual(again.skips, [0]);          // unknown chapter indexes are dropped
  assert.equal(migrate(null).coins, 0);
  assert.equal(migrate({ version: 99 }).coins, 0);
  assert.equal(migrate({ version: 1, levels: { 600: { stars: 3 } } }).levels[600], undefined);
});
