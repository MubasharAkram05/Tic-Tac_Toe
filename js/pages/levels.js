/**
 * Levels page: a zig-zag path map of the 500 campaign levels in 10 chapters.
 *
 * Virtualized: every level has a fixed position (worked out once), but only
 * the nodes near the screen exist in the DOM. Scrolling adds the nodes that
 * come into range and removes the ones that leave it, so 500 levels stay
 * smooth on low-end phones. Chapter header cards (10) are always rendered.
 *
 * A "Jump to current level" button shows up when the current level is
 * scrolled out of view.
 */
import { $, createScope, renderIcons, replayClass } from '../utils/dom.js';
import { sizeLabel } from '../utils/format.js';
import { CHAPTERS, TOTAL_LEVELS, chapterOf, isBoss } from '../config/levels.js';
import { save } from '../services/storage.js';
import { totalStars, chapterStars } from '../services/progress.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { onEvent } from '../utils/events.js';
import { showToast } from '../components/toast.js';
import { openLevelPopup, starSVG } from '../components/level-popup.js';

export const appBar = { title: 'Levels', settings: false }; // the star pill takes the right side

const ROW = 96;          // vertical space per level
const HEAD = 140;        // space for a chapter header card
const BUFFER = 700;      // render nodes this far above / below the screen (px)
const ZIG = [0, 0.55, 1, 0.55, 0, -0.55, -1, -0.55];
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const CROWN_SVG = '<svg class="crown" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';

/* ---- Fixed layout, computed once: chapter header tops and level y positions ---- */
const headTop = [];                      // y of each chapter header slot
const Y = new Float64Array(TOTAL_LEVELS + 2);
let MAP_H = 0;
(() => {
  let y = 0;
  CHAPTERS.forEach(c => {
    headTop[c.index] = y;
    y += HEAD;
    for (let n = c.from; n <= c.to; n++) Y[n] = y + (n - c.from) * ROW + ROW / 2;
    y += c.count * ROW;
  });
  MAP_H = y + 24;
})();

let scope = null, root = null, map = null, scroller = null, nodesLayer = null, pathSvg = null, fab = null;
let width = 0, ro = null, raf = 0;
let range = [0, -1];                     // levels currently in the DOM
const live = new Map();                  // level -> node element

const amp = () => Math.max(40, Math.min(110, (width - 100) / 2));
const xOf = n => width / 2 + ZIG[(n - 1) % ZIG.length] * amp();
const stateOf = n => (save.data.levels[n] ? 'done' : n <= save.data.unlockedLevel ? 'current' : 'locked');
const place = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
const currentLevel = () => Math.min(save.data.unlockedLevel, TOTAL_LEVELS);

/** First level whose y is >= v (binary search, O(log n)). */
function firstAtOrBelow(v) {
  let lo = 1, hi = TOTAL_LEVELS;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (Y[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

export function mount(el) {
  root = el;
  scope = createScope();
  live.clear();
  range = [0, -1];
  el.innerHTML = `
    <div class="levels-scroll">
      <div class="levels-map">
        ${CHAPTERS.map(c => `<div class="ch-slot" data-ch="${c.index}"><div class="ch-card glass"></div></div>`).join('')}
        <svg class="lv-path" aria-hidden="true"></svg>
        <div class="lv-nodes"></div>
      </div>
    </div>
    <button class="jump-fab" hidden aria-label="Jump to current level"><i data-lucide="locate-fixed"></i><span>Level <b></b></span></button>`;
  scroller = $('.levels-scroll', el);
  map = $('.levels-map', el);
  nodesLayer = $('.lv-nodes', el);
  pathSvg = $('.lv-path', el);
  fab = $('.jump-fab', el);
  map.style.height = MAP_H + 'px';
  map.querySelectorAll('.ch-slot').forEach(s => { s.style.top = headTop[+s.dataset.ch] + 'px'; });
  $('#appExtra').innerHTML = `<span class="star-pill" aria-label="Total stars">${starSVG(true)}<span class="star-total"></span></span>`;
  renderIcons(el);
  renderCards();

  requestAnimationFrame(() => {
    if (!root) return;
    width = map.clientWidth || 340;
    scrollToCurrent(false);
    update(true);
    ro = new ResizeObserver(() => {
      if (!root || Math.abs(map.clientWidth - width) < 2) return;
      width = map.clientWidth;
      update(true);
    });
    ro.observe(map);
  });
  scope.on(scroller, 'scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(false); }); }, { passive: true });
  scope.on(map, 'click', onNodeTap);
  scope.on(fab, 'click', () => { sound.click(); haptic(8); scrollToCurrent(true); });
  // A skip or a cleared level changes states: redraw what is on screen
  scope.add(onEvent('progress', () => { if (root) { renderCards(); update(true); } }));
}

export function unmount() {
  if (ro) ro.disconnect();
  cancelAnimationFrame(raf);
  raf = 0;
  if (scope) scope.dispose();
  live.clear();
  ro = root = map = scroller = nodesLayer = pathSvg = fab = null;
}

/* ---------- Chapter header cards ---------- */
function renderCards() {
  const d = save.data;
  CHAPTERS.forEach(c => {
    const got = chapterStars(c.index), max = c.count * 3, locked = c.from > d.unlockedLevel;
    const card = map.querySelector(`.ch-slot[data-ch="${c.index}"] .ch-card`);
    card.classList.toggle('locked', locked);
    card.innerHTML = `
      <img class="ch-art" src="assets/images/chapter-${c.index + 1}.svg" alt="" width="56" height="56" loading="lazy">
      <div class="ch-info">
        <span class="ch-num">Chapter ${c.index + 1} · ${c.from}-${c.to}</span>
        <h3>${c.name}</h3>
        <span class="ch-meta">${locked ? `Reach level ${c.from} to unlock` : `${sizeLabel(c.size)} · ${c.win} in a row`}</span>
      </div>
      ${locked ? `<span class="ch-lock" aria-label="Locked">${LOCK_SVG}</span>` : `<span class="ch-stars" aria-label="${got} of ${max} stars">${starSVG(true)}${got}/${max}</span>`}
      <span class="ch-bar"><i></i></span>`;
    card.querySelector('.ch-bar i').style.width = `${(got / max) * 100}%`;
  });
  $('.star-total').textContent = `${totalStars()}/${TOTAL_LEVELS * 3}`;
}

/* ---------- Virtualized nodes + path ---------- */
function makeNode(n) {
  const d = save.data, st = stateOf(n), boss = isBoss(n);
  const stars = st === 'done' ? d.levels[n].stars : 0;
  const label = st === 'locked' ? 'locked' : st === 'done' ? `${stars} of 3 stars` : 'ready to play';
  const b = document.createElement('button');
  b.className = `node ${st}${boss ? ' boss' : ''}`;
  b.dataset.level = n;
  b.setAttribute('aria-label', `Level ${n}${boss ? ', boss' : ''}, ${label}`);
  b.innerHTML = (boss ? CROWN_SVG : '') +
    (st === 'locked' ? LOCK_SVG : `<span>${n}</span>`) +
    (st === 'done' ? `<span class="node-stars">${[0, 1, 2].map(i => starSVG(i < stars)).join('')}</span>` : '');
  place(b, xOf(n), Y[n]);
  return b;
}

/**
 * Brings the DOM in line with the scroll position.
 * full = true redraws every visible node (after a resize or a progress change).
 */
function update(full) {
  if (!root || !width) return;
  const top = scroller.scrollTop - BUFFER, bottom = scroller.scrollTop + scroller.clientHeight + BUFFER;
  const a = firstAtOrBelow(top), b = Math.max(a, firstAtOrBelow(bottom) - 1);
  if (full) { live.forEach(el => el.remove()); live.clear(); }
  else if (a === range[0] && b === range[1]) { updateFab(); return; }
  // remove nodes that left the range, add the ones that came in
  live.forEach((el, n) => { if (n < a || n > b) { el.remove(); live.delete(n); } });
  const frag = document.createDocumentFragment();
  for (let n = a; n <= b; n++) if (!live.has(n)) { const el = makeNode(n); live.set(n, el); frag.appendChild(el); }
  nodesLayer.appendChild(frag);
  range = [a, b];
  drawPath(a, b);
  updateFab();
}

/** One SVG for the visible stretch of path. Lines only join levels of the same chapter. */
function drawPath(a, b) {
  const y0 = Y[a] - ROW, y1 = Y[b] + ROW, d = save.data;
  let html = '';
  for (let n = a; n < b; n++) {
    if (chapterOf(n) !== chapterOf(n + 1)) continue;
    const x = xOf(n), y = Y[n] - y0, x2 = xOf(n + 1), y2 = Y[n + 1] - y0;
    html += `<path class="${d.levels[n] ? 'done' : ''}" d="M${x} ${y} C${x} ${y + ROW / 2} ${x2} ${y2 - ROW / 2} ${x2} ${y2}"/>`;
  }
  pathSvg.style.top = y0 + 'px';
  pathSvg.style.height = (y1 - y0) + 'px';
  pathSvg.setAttribute('viewBox', `0 0 ${width} ${y1 - y0}`);
  pathSvg.innerHTML = html;
}

/** Shows the jump button (with an up / down arrow) when the current level is off screen. */
function updateFab() {
  const n = currentLevel(), y = Y[n] - scroller.scrollTop, h = scroller.clientHeight;
  const off = y < 40 || y > h - 40;
  fab.hidden = !off;
  if (!off) return;
  fab.querySelector('b').textContent = n;
  fab.classList.toggle('up', y < 0);
}

/** Puts the current level in the middle of the screen. */
function scrollToCurrent(smooth) {
  const h = scroller.clientHeight, target = Math.max(0, Y[currentLevel()] - h / 2);
  if (!smooth) { scroller.scrollTop = target; return; }
  // far away: jump close first, then glide the last screen (a long smooth scroll feels slow)
  const dist = target - scroller.scrollTop;
  if (Math.abs(dist) > 2 * h) scroller.scrollTop = target - Math.sign(dist) * h;
  scroller.scrollTo({ top: target, behavior: 'smooth' });
}

function onNodeTap(e) {
  const node = e.target.closest('.node');
  if (!node) return;
  if (node.classList.contains('locked')) {
    replayClass(node, 'shake');
    sound.error(); haptic(30);
    showToast(`Clear level ${save.data.unlockedLevel} first`, 'lock');
    return;
  }
  sound.click(); haptic(10);
  openLevelPopup(+node.dataset.level);
}
