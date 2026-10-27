import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactNumber } from '../js/utils/format.js';

test('money numbers: full with commas under 10,000, short from 10,000', () => {
  assert.equal(compactNumber(0), '0');
  assert.equal(compactNumber(345), '345');
  assert.equal(compactNumber(9850), '9,850');
  assert.equal(compactNumber(9999), '9,999');
  assert.equal(compactNumber(10000), '10k');
  assert.equal(compactNumber(12345), '12.3k');
  assert.equal(compactNumber(999999), '999.9k');
  assert.equal(compactNumber(1200000), '1.2M');
  assert.equal(compactNumber(3000000), '3M');
  assert.equal(compactNumber(-5), '0');
});

test('unit is picked from the value, then rounded down inside it', () => {
  assert.equal(compactNumber(9999), '9,999');
  assert.equal(compactNumber(10000), '10k');
  assert.equal(compactNumber(999999), '999.9k');
  assert.equal(compactNumber(1000000), '1M');
  assert.equal(compactNumber(9999999), '9.9M');
  assert.equal(compactNumber(10050), '10k');     // 10.05k rounds down, never up
  assert.equal(compactNumber(1999999), '1.9M');
  assert.equal(compactNumber(undefined), '0');
});
