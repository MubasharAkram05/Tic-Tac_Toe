/**
 * Home: continue-campaign card, daily reward, "Select level" carousel,
 * mode buttons and the vs Computer / vs Player setup sheets.
 */
import { $, $$, createScope, renderIcons, setSeg, segHTML, nameFieldHTML, setFieldState, reduceMotion } from '../utils/dom.js';
import { sizeLabel, timerLabel } from '../utils/format.js';
import { nameError, clamp } from '../utils/validate.js';
import { BOARD_SIZES, NAME_MAX, TIMER_OPTIONS, winLength } from '../config/constants.js';
import { getLevel, chapterOf } from '../config/levels.js';
import { app, saveApp, save } from '../services/storage.js';
import { dailyStatus, claimDaily, addCoins } from '../services/economy.js';
import { checkAchievements } from '../services/achievements.js';
import { campaignDone } from '../services/progress.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { createSheet } from '../components/bottom-sheet.js';
import { flyCoins } from '../components/coin-counter.js';
import { miniMark } from '../components/board-view.js';
import { showToast } from '../components/toast.js';
import { openLevelPopup } from '../components/level-popup.js';
import { navigate } from '../router.js';

export const appBar = { title: '' };

let scope = null, cpuSheet = null, pvpSheet = null, root = null;

const LAST = BOARD_SIZES.length - 1;
const index = () => BOARD_SIZES.indexOf(app.prefs.size);

export function mount(el) {
  root = el;
  scope = createScope();
  el.innerHTML = `
    <div class="page-scroll home-main">
      <div class="home-cards">
        <button class="continue-card glass" data-act="continue">
          <span class="cc-icon"><i data-lucide="map"></i></span>
          <span class="cc-text"><small class="cc-label">Continue Campaign</small><b class="cc-title">Level 1</b></span>
          <i data-lucide="chevron-right"></i>
        </button>
        <div class="daily-card glass" hidden>
          <span class="dc-icon"><i data-lucide="gift"></i></span>
          <span class="dc-text"><b>Daily reward</b><small class="dc-sub"></small></span>
          <button class="btn3d gold small" data-act="claim">Claim</button>
        </div>
      </div>

      <h1 class="title">Select Level</h1>

      <div class="carousel" role="group" aria-roledescription="carousel" aria-label="Board size">
        <div class="lv-row">
          <button class="icon-btn arrow" data-act="prev" aria-label="Smaller board"><i data-lucide="chevron-left"></i></button>
          <div class="lv-stage"><div class="lv-preview glass" aria-hidden="true"></div></div>
          <button class="icon-btn arrow" data-act="next" aria-label="Bigger board"><i data-lucide="chevron-right"></i></button>
        </div>
        <div class="lv-label" aria-live="polite"></div>
        <div class="dots">${BOARD_SIZES.map((s, i) => `<button class="dot" data-i="${i}" aria-label="${sizeLabel(s)}, ${winLength(s)} in a row"><span></span></button>`).join('')}</div>
      </div>

      <div class="modes">
        <button class="mode-btn cpu" data-act="cpu" aria-label="Player vs Computer"><i data-lucide="user"></i><b>vs</b><i data-lucide="monitor"></i></button>
        <button class="mode-btn pvp" data-act="pvp" aria-label="Player vs Player"><i data-lucide="user"></i><b>vs</b><i data-lucide="user"></i></button>
      </div>

      <footer class="footer">Made by <b>Sussal Productions</b></footer>
    </div>`;
  renderIcons(el);
  renderCards();
  renderCarousel(true);
  buildSheets();

  scope.on(el, 'click', onClick);
  wireSwipe();
  scope.on(document, 'keydown', e => {
    if (e.target.closest('input, textarea') || document.querySelector('.sheet.open')) return;
    if (e.key === 'ArrowLeft') changeTo(index() - 1);
    if (e.key === 'ArrowRight') changeTo(index() + 1);
  });
}

export function unmount() {
  if (scope) scope.dispose();
  [cpuSheet, pvpSheet].forEach(s => s && s.destroy());
  cpuSheet = pvpSheet = root = null;
}

function onClick(e) {
  const b = e.target.closest('[data-act], .dot');
  if (!b) return;
  if (b.classList.contains('dot')) { changeTo(+b.dataset.i); return; }
  const act = b.dataset.act;
  if (act === 'prev') changeTo(index() - 1);
  if (act === 'next') changeTo(index() + 1);
  if (act === 'cpu') { sound.click(); haptic(10); openCpuSheet(); }
  if (act === 'pvp') { sound.click(); haptic(10); openPvpSheet(); }
  if (act === 'continue') {
    sound.click(); haptic(10);
    if (campaignDone()) navigate('#/levels'); else openLevelPopup(save.data.unlockedLevel);
  }
  if (act === 'claim') claim(b);
}

/* ---------- Continue + daily cards ---------- */
function renderCards() {
  const d = save.data, u = d.unlockedLevel, lv = getLevel(u), done = campaignDone();
  $('.cc-label', root).textContent = done ? 'Campaign complete!' : 'Continue Campaign';
  $('.cc-title', root).textContent = done ? 'Replay any level for stars' : `Level ${u}${lv.boss ? ' · Boss' : ''}`;
  $('.continue-card', root).setAttribute('aria-label', done ? 'Campaign complete, open levels' : `Continue campaign, level ${u}, ${chapterOf(u).name}`);
  const st = dailyStatus();
  $('.daily-card', root).hidden = !st.available;
  if (st.available) $('.dc-sub', root).textContent = `Day ${st.day} · ${st.amount} coins${st.day > 1 ? ' · streak!' : ''}`;
}

function claim(btn) {
  const st = claimDaily();
  if (!st) return;
  haptic([10, 30, 10]);
  flyCoins(btn, st.amount);
  setTimeout(() => {
    addCoins(st.amount);
    showToast(`Day ${st.day} reward: +${st.amount} coins`, 'gift');
    checkAchievements();
    if (root) renderCards();
  }, 300);
}

/* ---------- Level carousel ---------- */
/**
 * Small animated demo board as SVG: X marks a winning line of the right
 * length for this size, O marks sit next to it, then the win line draws.
 */
function demoSVG(n) {
  const k = winLength(n);
  const g = n <= 4 ? 4 : n <= 8 ? 2.5 : 1.6;
  const c = (100 - (n - 1) * g) / n, step = c + g;
  const at = (r, col) => [col * step + c / 2, r * step + c / 2];
  let svg = '<svg viewBox="0 0 100 100">';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    svg += `<rect class="pv-cell" x="${(col * step).toFixed(2)}" y="${(r * step).toFixed(2)}" width="${c.toFixed(2)}" height="${c.toFixed(2)}" rx="${(c * 0.22).toFixed(2)}"/>`;
  }
  const line = [], os = [];
  if (n % 2) { // odd sizes: diagonal win
    const s0 = Math.floor((n - k) / 2);
    for (let i = 0; i < k; i++) line.push([s0 + i, s0 + i]);
    for (let i = 0; i < k - 1; i++) os.push([s0 + i, s0 + i + 1]);
  } else {     // even sizes: middle row win
    const r = Math.floor((n - 1) / 2), c0 = Math.floor((n - k) / 2);
    for (let i = 0; i < k; i++) line.push([r, c0 + i]);
    for (let i = 0; i < k - 1; i++) os.push([r + 1, c0 + i]);
  }
  const hh = c * 0.28, sw = (c * 0.15).toFixed(2);
  let step2 = 0; // animation order: d0, d1, ... (delays live in home.css)
  for (let i = 0; i < k; i++) {
    const [x, y] = at(...line[i]);
    svg += `<g class="pv-mark d${step2++}"><path class="pv-x" stroke-width="${sw}" d="M${x - hh} ${y - hh}L${x + hh} ${y + hh}M${x + hh} ${y - hh}L${x - hh} ${y + hh}"/></g>`;
    if (i < k - 1) {
      const [ox, oy] = at(...os[i]);
      svg += `<g class="pv-mark d${step2++}"><circle class="pv-o" stroke-width="${sw}" cx="${ox}" cy="${oy}" r="${hh * 1.05}"/></g>`;
    }
  }
  let [x1, y1] = at(...line[0]), [x2, y2] = at(...line[k - 1]);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ext = c * 0.32;
  x1 -= dx / len * ext; y1 -= dy / len * ext; x2 += dx / len * ext; y2 += dy / len * ext;
  svg += `<line class="pv-win x d${step2}" pathLength="100" stroke-width="${(c * 0.12).toFixed(2)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  return svg + '</svg>';
}

function renderMeta() {
  const n = app.prefs.size, i = index();
  $('.lv-label', root).innerHTML = `${sizeLabel(n)} <span>· ${winLength(n)} in a row</span>`;
  $$('.dot', root).forEach((d, j) => d.setAttribute('aria-current', String(j === i)));
  $('[data-act="prev"]', root).disabled = i === 0;
  $('[data-act="next"]', root).disabled = i === LAST;
}
function renderPreview() { $('.lv-preview', root).innerHTML = demoSVG(app.prefs.size); }
function renderCarousel() { renderMeta(); renderPreview(); }

/** Slides to level `to`. dragX = where the preview is after a swipe. */
function changeTo(to, dragX = 0) {
  if (!root) return;
  to = clamp(to, 0, LAST);
  const from = index(), preview = $('.lv-preview', root);
  if (to === from) { snapBack(dragX); return; }
  const dir = to > from ? 1 : -1;
  app.prefs.size = BOARD_SIZES[to];
  saveApp();
  renderMeta();
  sound.click(); haptic(8);
  preview.getAnimations().forEach(a => a.cancel());
  preview.style.transform = '';
  if (reduceMotion() || !preview.animate) { renderPreview(); return; }
  const out = preview.animate(
    [{ transform: `translateX(${dragX}px)`, opacity: 1 }, { transform: `translateX(${-dir * 90}px)`, opacity: 0 }],
    { duration: 140, easing: 'ease-in' });
  out.onfinish = () => {
    if (!root) return;
    renderPreview();
    preview.animate([{ transform: `translateX(${dir * 90}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };
}
function snapBack(x) {
  const preview = $('.lv-preview', root);
  preview.style.transform = '';
  if (x && preview.animate) preview.animate([{ transform: `translateX(${x}px)` }, { transform: 'translateX(0)' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

/* Swipe left / right on the preview. Vertical moves are left to the browser (touch-action: pan-y). */
function wireSwipe() {
  const stage = $('.lv-stage', root), preview = $('.lv-preview', root);
  let sx = 0, sy = 0, dx = 0, axis = null, active = false;
  scope.on(stage, 'pointerdown', e => { active = true; axis = null; dx = 0; sx = e.clientX; sy = e.clientY; });
  scope.on(stage, 'pointermove', e => {
    if (!active) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!axis && Math.hypot(mx, my) > 8) {
      axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (axis === 'x') stage.setPointerCapture(e.pointerId);
    }
    if (axis !== 'x') return;
    const atEdge = (mx > 0 && index() === 0) || (mx < 0 && index() === LAST);
    dx = atEdge ? mx * 0.25 : mx; // rubber band at the ends
    preview.style.transform = `translateX(${dx}px)`;
  });
  const end = () => {
    if (!active) return;
    active = false;
    if (axis !== 'x') return;
    if (dx < -50) changeTo(index() + 1, dx);
    else if (dx > 50) changeTo(index() - 1, dx);
    else snapBack(dx);
  };
  scope.on(stage, 'pointerup', end);
  scope.on(stage, 'pointercancel', end);
}

/* ---------- Setup sheets: name(s), difficulty, mark, timer, Start ---------- */
const markSeg = (group, label) => segHTML({ group, key: 'p1Mark', label, options: [{ val: 'X', label: miniMark('X'), aria: 'X' }, { val: 'O', label: miniMark('O'), aria: 'O' }] });
const timerSeg = group => segHTML({ group, key: 'timer', label: 'Move timer', options: TIMER_OPTIONS.map(s => ({ val: s, label: timerLabel(s) })) });

function buildSheets() {
  cpuSheet = createSheet({
    id: 'cpuSheet', form: true,
    body: `
      ${nameFieldHTML({ id: 'cpuName', field: 'solo', label: 'Your name', hint: '(optional)', placeholder: 'You', max: NAME_MAX })}
      <div class="form-row"><div class="lbl">Difficulty</div>
        ${segHTML({ group: 'cpu', key: 'difficulty', label: 'Difficulty', options: [{ val: 'easy', label: 'Easy' }, { val: 'medium', label: 'Medium' }, { val: 'hard', label: 'Hard' }] })}</div>
      <div class="form-row"><div class="lbl">Play as</div>${markSeg('cpu', 'Play as')}</div>
      <div class="form-row"><div class="lbl">Move timer</div>${timerSeg('cpu')}</div>`,
    foot: '<button type="submit" class="btn3d big" data-start><i data-lucide="play"></i>Start</button>',
  });
  pvpSheet = createSheet({
    id: 'pvpSheet', form: true,
    body: `
      ${nameFieldHTML({ id: 'p1Name', field: 'p1', label: '<span class="fmark" data-for="p1"></span>Player 1 name', enterkey: 'next', max: NAME_MAX })}
      ${nameFieldHTML({ id: 'p2Name', field: 'p2', label: '<span class="fmark" data-for="p2"></span>Player 2 name', max: NAME_MAX })}
      <div class="form-row"><div class="lbl">Player 1 is</div>${markSeg('pvp', 'Player 1 is')}</div>
      <div class="form-row"><div class="lbl">Move timer</div>${timerSeg('pvp')}</div>`,
    foot: '<button type="submit" class="btn3d big" data-start><i data-lucide="play"></i>Start</button>',
  });

  [cpuSheet, pvpSheet].forEach(sheet => {
    sheet.el.addEventListener('click', e => {
      const btn = e.target.closest('.seg button');
      if (!btn) return;
      const seg = btn.parentElement, group = seg.dataset.group, key = seg.dataset.key;
      const val = key === 'timer' ? +btn.dataset.val : btn.dataset.val;
      if (key === 'timer') app.settings.timer = val; // one shared timer choice
      else app.choices[group][key] = val;
      setSeg(seg, val);
      if (group === 'pvp' && key === 'p1Mark') renderPvpMarks();
      saveApp(); sound.click(); haptic(8);
    });
  });

  $('#cpuName').addEventListener('input', () => validateCpu(true));
  cpuSheet.el.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateCpu()) { sound.error(); haptic(40); return; }
    app.names.solo = $('#cpuName').value.trim() || 'You';
    saveApp();
    start({ mode: 'computer', difficulty: app.choices.cpu.difficulty, p1Mark: app.choices.cpu.p1Mark }, cpuSheet);
  });

  ['#p1Name', '#p2Name'].forEach(id => $(id).addEventListener('input', () => validatePvp(true)));
  $('#p1Name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#p2Name').focus(); } });
  pvpSheet.el.addEventListener('submit', e => {
    e.preventDefault();
    if (!validatePvp()) { sound.error(); haptic(40); return; }
    app.names.p1 = $('#p1Name').value.trim();
    app.names.p2 = $('#p2Name').value.trim();
    saveApp();
    start({ mode: 'friend', p1Mark: app.choices.pvp.p1Mark }, pvpSheet);
  });
}

/** vs Computer: name is optional (empty = "You"). */
function validateCpu(store) {
  const v = $('#cpuName').value.trim(), err = nameError(v, { required: false });
  setFieldState($('#cpuSheet [data-field="solo"]'), v, err, NAME_MAX);
  $('#cpuSheet [data-start]').disabled = !!err;
  if (store === true && !err) { app.names.solo = v || 'You'; saveApp(); } // remember even without Start
  return !err;
}

/** vs Player: both names required and different. */
function validatePvp(store) {
  const a = $('#p1Name').value.trim(), b = $('#p2Name').value.trim();
  const e1 = nameError(a);
  let e2 = nameError(b);
  if (!e2 && a && a.toLowerCase() === b.toLowerCase()) e2 = 'Pick a different name';
  setFieldState($('#pvpSheet [data-field="p1"]'), a, e1, NAME_MAX);
  setFieldState($('#pvpSheet [data-field="p2"]'), b, e2, NAME_MAX);
  $('#pvpSheet [data-start]').disabled = !!(e1 || e2);
  if (store === true) {
    if (!e1) app.names.p1 = a;
    if (!e2) app.names.p2 = b;
    saveApp();
  }
  return !(e1 || e2);
}

function renderPvpMarks() {
  const m1 = app.choices.pvp.p1Mark;
  $('#pvpSheet [data-for="p1"]').innerHTML = miniMark(m1);
  $('#pvpSheet [data-for="p2"]').innerHTML = miniMark(m1 === 'X' ? 'O' : 'X');
}

function openCpuSheet() {
  const c = app.choices.cpu;
  cpuSheet.setTitle(`vs Computer · ${sizeLabel(app.prefs.size)}`);
  setSeg($('#cpuSheet .seg[data-key="difficulty"]'), c.difficulty);
  setSeg($('#cpuSheet .seg[data-key="p1Mark"]'), c.p1Mark);
  setSeg($('#cpuSheet .seg[data-key="timer"]'), app.settings.timer);
  $('#cpuName').value = app.names.solo === 'You' ? '' : app.names.solo;
  validateCpu();
  cpuSheet.open();
}

function openPvpSheet() {
  const c = app.choices.pvp;
  pvpSheet.setTitle(`vs Player · ${sizeLabel(app.prefs.size)}`);
  setSeg($('#pvpSheet .seg[data-key="p1Mark"]'), c.p1Mark);
  setSeg($('#pvpSheet .seg[data-key="timer"]'), app.settings.timer);
  $('#p1Name').value = app.names.p1;
  $('#p2Name').value = app.names.p2;
  renderPvpMarks();
  validatePvp();
  pvpSheet.open();
}

/** Builds the game config and opens the game page. */
function start(extra, sheet) {
  const config = { size: app.prefs.size, timer: app.settings.timer, ...extra };
  sheet.close();
  sound.click(); haptic(15);
  navigate('#/game', { state: config });
}
