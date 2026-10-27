/**
 * One-time tutorial for each level twist: 2 short lines, a tiny animated
 * example board and a "Got it" button. "Seen" is remembered per twist in
 * app.flags.twists (localStorage, key "ttt.v3").
 *
 *   withTwistTutorials(['gravity', 'ice'], () => startTheLevel());
 *
 * A level with several new twists shows their tutorials one after another.
 */
import { $, renderIcons } from '../utils/dom.js';
import { app, saveApp } from '../services/storage.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { TWIST_INFO, twistIcon } from '../config/level-twists.js';
import { markSVG } from './board-view.js';
import { createModal } from './modal.js';

const BAN = '<svg viewBox="0 0 24 24" class="ban" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>';
const SNOW = '<svg viewBox="0 0 24 24" class="tw-icon ice-ic" aria-hidden="true"><path d="M2 12h20M12 2v20m8-6-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/></svg>';
const COIN = '<svg viewBox="0 0 24 24" class="tw-icon coin-ic" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#f5b301" stroke="#b45309" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/></svg>';

/**
 * Example boards. One string per row:
 *   '.' empty   '#' blocked   'X' / 'O' marks   'x' / 'o' given (pinned) marks
 *   '+' the X move that appears   'v' an X that fades (vanishing)   '~' ice (melts in 3)
 *   '$' coin cell   'c' coin cell an X lands on   'd' an X that drops into place
 *   'r' a cell of the ring that is about to close
 */
const TUTORIALS = {
  coins: { lines: ['Some cells hold coins (+5), and bosses may hide a diamond.', 'Play there and win the level to keep them. First clear only.'], demo: ['$.O', '.X.', 'c.O'] },
  vanish: { lines: ['You can keep only a few marks on the board.', 'Play one more and your oldest mark (faded) disappears.'], demo: ['vX.', 'O.O', '..+'] },
  blocked: { lines: ['Some cells are blocked. Nobody can play there.', 'A blocked cell breaks a line, so plan around it.'], demo: ['X#+', '.O.', 'O..'] },
  ice: { lines: ['Ice cells are frozen at the start.', 'They melt after the number of moves shown, then you can play there.'], demo: ['~X.', '.O.', 'O.+'] },
  lines: { lines: ['This level has a line rule, shown in the top bar.', '"Straight only": rows and columns win, diagonals don\'t.'], demo: ['XX+', '.O.', 'O..'] },
  gravity: { lines: ['Marks fall down, like Connect Four.', 'Tap any cell in a column: your mark drops to the lowest free cell.'], demo: ['...', '.d.', 'OXO'] },
  puzzle: { lines: ['Some marks are already on the board (they have a small pin).', 'Win within the moves shown, or the level fails.'], demo: ['x.o', 'xo.', '+..'] },
  wrap: { lines: ['Rows and diagonals wrap from the right edge to the left edge.', 'The faded columns at the sides show where a line continues.'], demo: ['+.XX', '.O..', 'O...'] },
  shrink: { lines: ['Every 8 moves the outer ring closes (it blinks red before).', 'Marks already in the ring stay and still count.'], demo: ['rrrr', 'rX.r', 'r.Or', 'rrrr'] },
};

let modal = null, queue = [], onDone = null;

const seen = id => !!(app.flags.twists && app.flags.twists[id]);
function markSeen(id) {
  app.flags.twists = { ...(app.flags.twists || {}), [id]: true };
  saveApp();
}

function demoHTML(rows) {
  const cell = ch => {
    if (ch === '#') return `<div class="cell filled blocked instant">${BAN}</div>`;
    if (ch === '.') return '<div class="cell instant"></div>';
    if (ch === 'r') return '<div class="cell instant ring-warn"></div>';
    if (ch === '~') return `<div class="cell filled ice instant">${SNOW}<b class="ice-n">3</b></div>`;
    if (ch === '$') return `<div class="cell coin coin instant">${COIN}</div>`;
    if (ch === 'c') return `<div class="cell coin tt-coin">${COIN}<span class="tt-on">${markSVG('X')}</span></div>`;
    if (ch === '+') return `<div class="cell filled x tt-move">${markSVG('X')}</div>`;
    if (ch === 'd') return `<div class="cell filled x tt-drop">${markSVG('X')}</div>`;
    if (ch === 'v') return `<div class="cell filled x instant fading">${markSVG('X')}</div>`;
    const m = ch.toUpperCase();
    return `<div class="cell filled ${ch.toLowerCase()} instant${ch !== m ? ' preset' : ''}">${markSVG(m)}</div>`;
  };
  return rows.join('').split('').map(cell).join('');
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
    showNext();
  });
  return modal;
}

function showNext() {
  const id = queue.shift();
  if (!id) { const cb = onDone; onDone = null; if (cb) cb(); return; }
  markSeen(id);
  const t = TUTORIALS[id], m = ensureModal(), demo = $('.tt-demo', m.el);
  $('.tt-icon', m.el).innerHTML = `<i data-lucide="${twistIcon(id)}"></i>`;
  $('#ttTitle').textContent = TWIST_INFO[id].name;
  demo.innerHTML = demoHTML(t.demo);
  demo.style.setProperty('--cols', t.demo[0].length);
  demo.classList.toggle('wrap-demo', id === 'wrap');
  $('.tt-lines', m.el).innerHTML = t.lines.map(l => `<p>${l}</p>`).join('');
  renderIcons(m.el);
  m.open();
}

/** Runs `cb` right away, or after the tutorials of the twists this player hasn't seen yet. */
export function withTwistTutorials(ids, cb) {
  queue = (ids || []).filter(id => TUTORIALS[id] && !seen(id));
  onDone = cb;
  showNext();
}

/** Same for a single twist id. */
export const withTwistTutorial = (id, cb) => withTwistTutorials(id ? [id] : [], cb);
