/**
 * One-time tutorial for each level twist (blocked cells, puzzle, mixed):
 * 2-3 short lines, a small animated example board and a "Got it" button.
 * "Seen" is remembered in app.flags.twists (localStorage, key "ttt.v3").
 *
 *   withTwistTutorial('blocked', () => startTheLevel());
 */
import { $, renderIcons } from '../utils/dom.js';
import { app, saveApp } from '../services/storage.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { markSVG } from './board-view.js';
import { createModal } from './modal.js';

const BAN = '<svg viewBox="0 0 24 24" class="ban" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>';

/** Example boards (3x3): '.' empty, '#' blocked, 'X' / 'O' marks, 'x' / 'o' given (pinned) marks, '+' the X move that appears. */
const TUTORIALS = {
  blocked: {
    icon: 'ban', title: 'Blocked cells',
    lines: ['Some cells are blocked. Nobody can play there.', 'A blocked cell breaks a line, so plan around it.'],
    demo: ['X#+', '.O.', 'O..'],
  },
  puzzle: {
    icon: 'puzzle', title: 'Puzzle level',
    lines: ['Some marks are already on the board (they have a small pin).', 'Win within the moves shown, or the level fails.'],
    demo: ['x.o', 'xo.', '+..'],
  },
  mixed: {
    icon: 'layers', title: 'Mixed level',
    lines: ['Blocked cells and given marks on one board.', 'Find the winning line before your moves run out.'],
    demo: ['#xo', '.x.', 'o+#'],
  },
};

let modal = null, onDone = null;

const seen = type => !!(app.flags.twists && app.flags.twists[type]);

function markSeen(type) {
  app.flags.twists = { ...(app.flags.twists || {}), [type]: true };
  if (type === 'mixed') Object.assign(app.flags.twists, { blocked: true, puzzle: true }); // covers both
  saveApp();
}

function demoHTML(rows) {
  return rows.join('').split('').map(ch => {
    if (ch === '#') return `<div class="cell filled blocked instant">${BAN}</div>`;
    if (ch === '.') return '<div class="cell instant"></div>';
    if (ch === '+') return `<div class="cell filled x tt-move">${markSVG('X')}</div>`;
    const m = ch.toUpperCase();
    return `<div class="cell filled ${ch.toLowerCase()} instant${ch !== m ? ' preset' : ''}">${markSVG(m)}</div>`;
  }).join('');
}

function ensureModal() {
  if (modal) return modal;
  modal = createModal({
    id: 'twistModal', labelledBy: 'ttTitle', cardClass: 'twist-card', dismissible: false,
    html: `
      <div class="tt-icon"></div>
      <h2 id="ttTitle"></h2>
      <div class="tt-demo" data-board="classic" aria-hidden="true"></div>
      <div class="tt-lines"></div>
      <button class="btn3d big" data-act="got-it" data-autofocus><i data-lucide="check"></i>Got it</button>`,
  });
  modal.el.addEventListener('click', e => {
    if (!e.target.closest('[data-act="got-it"]')) return;
    sound.click(); haptic(10);
    modal.close();
    const cb = onDone;
    onDone = null;
    if (cb) cb();
  });
  return modal;
}

/** Runs `cb` right away, or after the tutorial if this twist is new to the player. */
export function withTwistTutorial(type, cb) {
  const t = TUTORIALS[type];
  if (!t || seen(type)) { cb(); return; }
  markSeen(type);
  const m = ensureModal();
  onDone = cb;
  $('.tt-icon', m.el).innerHTML = `<i data-lucide="${t.icon}"></i>`;
  $('#ttTitle').textContent = t.title;
  $('.tt-demo', m.el).innerHTML = demoHTML(t.demo);
  $('.tt-lines', m.el).innerHTML = t.lines.map(l => `<p>${l}</p>`).join('');
  renderIcons(m.el);
  m.open();
}
