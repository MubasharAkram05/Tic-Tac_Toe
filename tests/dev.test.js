import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDevHost, readDevMode, PRODUCTION_HOSTS } from '../js/utils/dev.js';

test('dev unlock never runs on the live site', () => {
  for (const h of PRODUCTION_HOSTS) {
    assert.equal(isDevHost(h), false);
    assert.equal(isDevHost(h.toUpperCase()), false);
    assert.equal(readDevMode({ hostname: h, search: '?dev=1' }), false);
  }
});

test('dev hosts: localhost, LAN, Vercel branch previews', () => {
  for (const h of ['localhost', '127.0.0.1', '[::1]', 'my-pc.local', '192.168.1.20', '10.0.0.5', 'tic-tac-toe-git-ccr-3b281773-3g3ozw-ali-sultan1.vercel.app'])
    assert.equal(isDevHost(h), true, h);
});

test('other hosts are not dev hosts', () => {
  for (const h of ['', 'example.com', 'tic-tac-toe.vercel.app', 'evil-git-.com', 'tictactoe.game', '8.8.8.8'])
    assert.equal(isDevHost(h), false, h);
});

test('needs ?dev=1 exactly', () => {
  assert.equal(readDevMode({ hostname: 'localhost', search: '?dev=1' }), true);
  assert.equal(readDevMode({ hostname: 'localhost', search: '' }), false);
  assert.equal(readDevMode({ hostname: 'localhost', search: '?dev=true' }), false);
  assert.equal(readDevMode(null), false);
});
