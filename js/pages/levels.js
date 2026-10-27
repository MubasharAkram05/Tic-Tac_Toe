/**
 * Levels page: a zig-zag path map of the 200 campaign levels, grouped in
 * chapters. Chapters are rendered lazily when they scroll near the screen,
 * with skeleton circles until then, so low-end phones stay smooth.
 */
import { $, $$, createScope, replayClass } from '../utils/dom.js';
import { sizeLabel } from '../utils/format.js';
import { CHAPTERS, TOTAL_LEVELS, chapterOf, isBoss } from '../config/levels.js';
import { save } from '../services/storage.js';
import { totalStars, chapterStars } from '../services/progress.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { showToast } from '../components/toast.js';
import { openLevelPopup, starSVG } from '../components/level-popup.js';

export const appBar = { title: 'Levels', settings: false }; // the star pill takes the right side

const ROW = 96;
const ZIG = [0, 0.55, 1, 0.55, 0, -0.55, -1, -0.55];
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const CROWN_SVG = '<svg class="crown" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';

let scope = null, root = null, map = null, scroller = null, width = 0, io = null, ro = null;
const rendered = new Set();

const amp = () => Math.max(40, Math.min(110, (width - 100) / 2));
const xOf = n => width / 2 + ZIG[(n - 1) % ZIG.length] * amp();
const yOf = (c, n) => (n - c.from) * ROW + ROW / 2;
const stateOf = n => (save.data.levels[n] ? 'done' : n <= save.data.unlockedLevel ? 'current' : 'locked');
const place = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };

export function mount(el) {
  root = el;
  scope = createScope();
  rendered.clear();
  el.innerHTML = `<div class="levels-scroll"><div class="levels-map"></div></div>`;
  scroller = $('.levels-scroll', el);
  map = $('.levels-map', el);
  $('#appExtra').innerHTML = `<span class="star-pill" aria-label="Total stars">${starSVG(true)}<span class="star-total"></span></span>`;

  // Section shells with skeletons first, real nodes a moment later
  map.innerHTML = CHAPTERS.map(c => `
    <section class="chapter" data-ch="${c.index}">
      <div class="ch-card glass"></div>
      <div class="ch-nodes"></div>
    </section>`).join('');
  requestAnimationFrame(() => {
    if (!root) return;
    width = map.clientWidth || 340;
    CHAPTERS.forEach(c => {
      const box = map.children[c.index].querySelector('.ch-nodes');
      box.style.height = c.count * ROW + 'px';
      for (let n = c.from; n <= c.to; n++) {
        const s = document.createElement('span');
        s.className = 'skel';
        place(s, xOf(n), yOf(c, n));
        box.appendChild(s);
      }
    });
    renderCards();
    io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) renderChapter(+e.target.parentElement.dataset.ch);
    }), { root: scroller, rootMargin: '700px 0px' });
    $$('.ch-nodes', map).forEach(box => io.observe(box));
    ro = new ResizeObserver(() => {
      if (Math.abs(map.clientWidth - width) < 2) return;
      width = map.clientWidth;
      rendered.forEach(renderChapter);
    });
    ro.observe(map);
    scrollToCurrent();
  });
  scope.on(map, 'click', onNodeTap);
}

export function unmount() {
  if (io) io.disconnect();
  if (ro) ro.disconnect();
  if (scope) scope.dispose();
  io = ro = root = map = scroller = null;
}

function renderCards() {
  const d = save.data;
  CHAPTERS.forEach(c => {
    const got = chapterStars(c.index), max = c.count * 3, locked = c.from > d.unlockedLevel;
    const card = map.children[c.index].querySelector('.ch-card');
    card.classList.toggle('locked', locked);
    card.innerHTML = `
      <img class="ch-art" src="assets/images/chapter-${c.index + 1}.svg" alt="" width="56" height="56" loading="lazy">
      <div class="ch-info">
        <span class="ch-num">Chapter ${c.index + 1}${locked ? ' · locked' : ''}</span>
        <h3>${c.name}</h3>
        <span class="ch-meta">${sizeLabel(c.size)} · ${c.win} in a row</span>
      </div>
      <span class="ch-stars">${starSVG(true)}${got}/${max}</span>
      <span class="ch-bar"><i></i></span>`;
    card.querySelector('.ch-bar i').style.width = `${(got / max) * 100}%`;
  });
  $('.star-total').textContent = `${totalStars()}/${TOTAL_LEVELS * 3}`;
}

function renderChapter(ci) {
  if (!map) return;
  const c = CHAPTERS[ci], d = save.data, box = map.children[ci].querySelector('.ch-nodes');
  const H = c.count * ROW;
  let path = '', nodes = '';
  for (let n = c.from; n <= c.to; n++) {
    const st = stateOf(n), boss = isBoss(n);
    if (n < c.to) {
      const x = xOf(n), y = yOf(c, n), x2 = xOf(n + 1), y2 = yOf(c, n + 1);
      path += `<path class="${d.levels[n] ? 'done' : ''}" d="M${x} ${y} C${x} ${y + ROW / 2} ${x2} ${y2 - ROW / 2} ${x2} ${y2}"/>`;
    }
    const stars = st === 'done' ? d.levels[n].stars : 0;
    const label = st === 'locked' ? 'locked' : st === 'done' ? `${stars} of 3 stars` : 'ready to play';
    nodes += `<button class="node ${st}${boss ? ' boss' : ''}" data-level="${n}" aria-label="Level ${n}${boss ? ', boss' : ''}, ${label}">` +
      (boss ? CROWN_SVG : '') +
      (st === 'locked' ? LOCK_SVG : `<span>${n}</span>`) +
      (st === 'done' ? `<span class="node-stars">${[0, 1, 2].map(i => starSVG(i < stars)).join('')}</span>` : '') +
      '</button>';
  }
  box.innerHTML = `<svg class="ch-path" viewBox="0 0 ${width} ${H}" preserveAspectRatio="none" aria-hidden="true">${path}</svg>${nodes}`;
  box.querySelectorAll('.node').forEach(node => { const n = +node.dataset.level; place(node, xOf(n), yOf(c, n)); });
  rendered.add(ci);
}

/** Scrolls so the current level sits in the middle of the screen. */
function scrollToCurrent() {
  const n = save.data.unlockedLevel, c = chapterOf(n);
  const box = map.children[c.index].querySelector('.ch-nodes');
  const y = map.offsetTop + box.offsetTop + yOf(c, n);
  scroller.scrollTop = Math.max(0, y - scroller.clientHeight / 2);
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
