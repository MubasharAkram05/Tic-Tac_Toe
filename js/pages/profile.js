/**
 * Profile: hero card (avatar, name, level, XP, title), quick stats,
 * stats with tabs and a win-rate ring, achievements and quick actions.
 */
import { $, $$, createScope, renderIcons, setSeg, segHTML, setFieldState, reduceMotion } from '../utils/dom.js';
import { countUp } from '../utils/format.js';
import { nameError } from '../utils/validate.js';
import { NAME_MAX } from '../config/constants.js';
import { shopItem } from '../config/shop-items.js';
import { save } from '../services/storage.js';
import { levelInfo, titleFor, totalStars, highestLevel } from '../services/progress.js';
import { statsFor } from '../services/stats.js';
import { ACHIEVEMENTS, isUnlockedAchievement, progressText, progressFraction } from '../services/achievements.js';
import { equipItem } from '../services/economy.js';
import { applyCosmetics } from '../services/theme.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { onEvent, emit } from '../utils/events.js';
import { createSheet } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';

export const appBar = { title: 'Profile' };

// Long labels on wider screens, short ones on phones (full text stays as the aria-label)
const TABS = [
  { val: 'all', label: 'All', aria: 'All modes' },
  { val: 'computer', label: '<span class="long">vs Computer</span><span class="short">Computer</span>', aria: 'vs Computer' },
  { val: 'friend', label: '<span class="long">vs Player</span><span class="short">Player</span>', aria: 'vs Player' },
  { val: 'campaign', label: 'Levels', aria: 'Levels' },
];
const RING_R = 42, RING_C = 2 * Math.PI * RING_R;

let root, scope, tab = 'all', avatarSheet, achSheet, resetSheet, editing = false;

export function mount(el) {
  root = el;
  scope = createScope();
  editing = false;
  el.innerHTML = skeleton();
  // Data is local, but a short skeleton keeps the page from popping in
  scope.timeout(() => { if (root) { render(true); } }, 120);
  buildSheets();
  scope.on(el, 'click', onClick);
  scope.add(onEvent('progress', () => { if (root && !editing) render(false); }));
}

export function unmount() {
  [avatarSheet, achSheet, resetSheet].forEach(s => s && s.destroy());
  if (scope) scope.dispose();
  root = avatarSheet = achSheet = resetSheet = null;
}

function skeleton() {
  const block = cls => `<div class="skel-block ${cls}"></div>`;
  return `<div class="page-scroll profile-page">${block('sk-hero')}<div class="quick-row">${block('sk-tile')}${block('sk-tile')}${block('sk-tile')}</div>${block('sk-card')}${block('sk-card')}</div>`;
}

/* =========================================================================
   Rendering
   ========================================================================= */
function render(animate) {
  const d = save.data, info = levelInfo(d.xp);
  const pct = Math.round((info.into / info.need) * 100);
  root.innerHTML = `
    <div class="page-scroll profile-page">
      <section class="card hero-card glass">
        <button class="hero-avatar" data-act="avatar" aria-label="Change avatar">
          <span class="ring"></span>
          <span class="face"><i data-lucide="${d.equipped.avatar}"></i></span>
          <span class="edit-badge"><i data-lucide="pencil"></i></span>
        </button>
        <div class="hero-name">
          <div class="name-row"${editing ? ' hidden' : ''}>
            <h2 class="hero-title-name"></h2>
            <button class="icon-btn plain" data-act="edit-name" aria-label="Edit name"><i data-lucide="pencil"></i></button>
          </div>
          <form class="name-form" novalidate${editing ? '' : ' hidden'}>
            <div class="form-row" data-field="profile">
              <input class="text-input" id="pfNameInput" type="text" maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-label="Your name" aria-describedby="pfNameInput-err">
              <div class="field-meta"><span class="err" id="pfNameInput-err" aria-live="polite"></span><span class="count">0/${NAME_MAX}</span></div>
            </div>
          </form>
          <div class="hero-sub">${titleFor(info.lv)}</div>
        </div>
        <div class="xp-row">
          <span class="lv-badge">Lv ${info.lv}</span>
          <div class="xp-bar" role="progressbar" aria-label="XP to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i></i></div>
        </div>
        <div class="xp-text"><span class="xp-now">${info.into}</span> / ${info.need} XP</div>
      </section>

      <div class="quick-row">
        ${mini('coins', 'gold', d.coins, 'Coins')}
        ${mini('star', 'gold', totalStars(), 'Stars')}
        ${mini('flag', '', highestLevel(), 'Highest level')}
      </div>

      <section class="card stats-card glass">
        <div class="card-head"><h3>Stats</h3></div>
        ${segHTML({ group: 'stats', key: 'tab', label: 'Stats for', options: TABS })}
        <div class="stats-body"></div>
      </section>

      <section class="card ach-card glass">
        <div class="card-head"><h3>Achievements <small class="ach-count"></small></h3><button class="link-btn" data-act="all-ach">See all</button></div>
        <div class="ach-strip"></div>
      </section>

      <section class="card actions-card glass">
        ${actionRow('shopping-bag', 'Shop', 'shop')}
        ${actionRow('settings', 'Settings', 'settings')}
        ${actionRow('hard-drive-download', 'Export / Import progress', 'backup')}
        ${actionRow('rotate-ccw', 'Reset progress', 'reset', 'danger')}
      </section>
    </div>`;
  $('.hero-title-name', root).textContent = d.profile.name;
  setSeg($('.seg[data-group="stats"]', root), tab);
  renderStats(animate);
  renderAchievements();
  renderIcons(root);
  const bar = $('.xp-bar i', root);
  if (animate && !reduceMotion()) requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = pct + '%'; }));
  else bar.style.width = pct + '%';
  if (animate) {
    $$('.mini-card [data-count]', root).forEach(n => countUp(n, +n.dataset.count)); // stats body counts itself
    countUp($('.xp-now', root), info.into);
  }
  if (editing) startEdit();
}

const mini = (icon, cls, value, label) => `<div class="mini-card glass ${cls}"><i data-lucide="${icon}"></i><b data-count="${value}">${value}</b><small>${label}</small></div>`;
const actionRow = (icon, label, act, cls = '') => `<button class="action-row ${cls}" data-act="${act}"><span class="ar-icon"><i data-lucide="${icon}"></i></span><span class="ar-label">${label}</span><i data-lucide="chevron-right"></i></button>`;

function renderStats(animate, dir = 0) {
  const s = statsFor(tab), body = $('.stats-body', root);
  const pv = tab === 'friend';
  if (!s.played) {
    body.innerHTML = `<div class="empty-state"><i data-lucide="gamepad-2"></i><span>Play your first game${tab === 'all' ? '' : ' in this mode'} to see your stats.</span></div>`;
  } else {
    body.innerHTML = `
      <div class="winrate">
        <svg class="wr-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="wr-track" cx="50" cy="50" r="${RING_R}"/>
          <circle class="wr-bar" cx="50" cy="50" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/>
        </svg>
        <div class="wr-text"><b data-count="${s.winRate}" data-suffix="%">${s.winRate}%</b><small>${pv ? 'P1 win rate' : 'Win rate'}</small></div>
      </div>
      <div class="stat-grid">
        ${stat('gamepad-2', s.played, 'Played')}
        ${stat('trophy', s.wins, pv ? 'P1 wins' : 'Wins')}
        ${stat('x', s.losses, pv ? 'P2 wins' : 'Losses')}
        ${stat('equal', s.draws, 'Draws')}
        ${stat('flame', s.best, 'Best streak')}
        ${stat('zap', s.streak, 'Current streak')}
      </div>`;
    const bar = $('.wr-bar', body), target = RING_C * (1 - s.winRate / 100);
    if (animate !== false && !reduceMotion()) requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', target)));
    else bar.setAttribute('stroke-dashoffset', target);
    $$('[data-count]', body).forEach(n => countUp(n, +n.dataset.count, { suffix: n.dataset.suffix || '' }));
  }
  renderIcons(body);
  if (dir && body.animate && !reduceMotion()) {
    body.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}
const stat = (icon, value, label) => `<div class="stat"><i data-lucide="${icon}"></i><b data-count="${value}">${value}</b><small>${label}</small></div>`;

function badgeHTML(a, full = false) {
  const on = isUnlockedAchievement(a.id);
  const pct = Math.round(progressFraction(a) * 100);
  return `<div class="badge-card ${on ? 'on' : 'locked'}${full ? ' full' : ''}">
    <span class="b-icon"><i data-lucide="${on ? a.icon : 'lock'}"></i></span>
    <b>${a.name}</b>
    <small>${on ? `+${a.reward} coins` : progressText(a)}</small>
    ${full ? `<span class="b-desc">${a.desc}</span>` : ''}
    ${on ? '' : `<span class="b-bar"><i data-pct="${pct}"></i></span>`}
  </div>`;
}
function setBars(scopeEl) { $$('.b-bar i', scopeEl).forEach(i => { i.style.width = i.dataset.pct + '%'; }); }

function renderAchievements() {
  const got = ACHIEVEMENTS.filter(a => isUnlockedAchievement(a.id)).length;
  $('.ach-count', root).textContent = `${got}/${ACHIEVEMENTS.length}`;
  // unlocked first, then the closest ones to unlocking
  const list = [...ACHIEVEMENTS].sort((a, b) => (isUnlockedAchievement(b.id) - isUnlockedAchievement(a.id)) || (progressFraction(b) - progressFraction(a)));
  const strip = $('.ach-strip', root);
  strip.innerHTML = (got ? '' : '<div class="empty-state slim"><i data-lucide="trophy"></i><span>No achievements yet. Win your first game!</span></div>') +
    `<div class="badge-row">${list.map(a => badgeHTML(a)).join('')}</div>`;
  setBars(strip);
}

/* =========================================================================
   Actions, name editing, sheets
   ========================================================================= */
function onClick(e) {
  const segBtn = e.target.closest('.seg[data-group="stats"] button');
  if (segBtn) {
    const from = TABS.findIndex(t => t.val === tab), to = TABS.findIndex(t => t.val === segBtn.dataset.val);
    if (from === to) return;
    tab = segBtn.dataset.val;
    setSeg(segBtn.parentElement, tab);
    sound.click(); haptic(8);
    renderStats(true, Math.sign(to - from));
    return;
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  sound.click(); haptic(8);
  if (act === 'avatar') openAvatars();
  if (act === 'edit-name') { editing = true; startEdit(); }
  if (act === 'all-ach') openAllAchievements();
  if (act === 'shop') navigate('#/shop');
  if (act === 'settings') navigate('#/settings');
  if (act === 'backup') navigate('#/settings?section=backup');
  if (act === 'reset') resetSheet.open();
}

function startEdit() {
  $('.name-row', root).hidden = true;
  const form = $('.name-form', root), inp = $('#pfNameInput');
  form.hidden = false;
  inp.value = save.data.profile.name;
  validateName();
  inp.focus();
  inp.select();
  inp.oninput = validateName;
  inp.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); finishEdit(false); } };
  inp.onblur = () => { if (editing) finishEdit(true); };
  form.onsubmit = e => { e.preventDefault(); if (validateName()) inp.blur(); else { sound.error(); haptic(30); } };
}
function validateName() {
  const v = $('#pfNameInput').value.trim(), err = nameError(v);
  setFieldState($('[data-field="profile"]', root), v, err, NAME_MAX);
  return !err;
}
/** Saves on Enter / blur if valid, otherwise keeps the old name. */
function finishEdit(keep) {
  if (!editing) return;
  editing = false;
  if (keep && validateName()) {
    save.data.profile.name = $('#pfNameInput').value.trim();
    save.write();
  }
  render(false);
}

function buildSheets() {
  avatarSheet = createSheet({
    id: 'avatarSheet', title: 'Choose avatar',
    body: '<div class="avatar-grid"></div><p class="sheet-note">Want more? <button type="button" class="link-btn" data-shop>Get avatars in the Shop</button></p>',
  });
  avatarSheet.el.addEventListener('click', e => {
    const opt = e.target.closest('.avatar-opt');
    if (opt) {
      equipItem('avatar', opt.dataset.id);
      sound.click(); haptic(8);
      avatarSheet.close();
      return;
    }
    if (e.target.closest('[data-shop]')) { avatarSheet.close(); navigate('#/shop?tab=avatar'); }
  });

  achSheet = createSheet({ id: 'achSheet', title: 'Achievements', body: '<div class="ach-list"></div>' });

  resetSheet = createSheet({
    id: 'resetSheet', title: 'Reset progress?',
    body: '<p class="sheet-note">This clears your coins, levels and stars, shop items, stats and achievements. Settings stay. This can\'t be undone.</p>',
    foot: '<div class="two-btns"><button type="button" class="btn3d ghost" data-close-sheet>Cancel</button><button type="button" class="btn3d danger" data-reset>Reset</button></div>',
  });
  resetSheet.el.querySelector('[data-close-sheet]').addEventListener('click', () => resetSheet.close());
  resetSheet.el.querySelector('[data-reset]').addEventListener('click', () => {
    save.reset();
    applyCosmetics();
    resetSheet.close();
    emit('coins', { from: 0, to: 0 });
    emit('progress');
    showToast('Progress reset. Fresh start!', 'rotate-ccw');
    sound.click(); haptic([10, 30, 10]);
  });
}

function openAvatars() {
  const d = save.data;
  $('.avatar-grid', avatarSheet.el).innerHTML = d.owned.avatar.map(id =>
    `<button type="button" class="avatar-opt" data-id="${id}" aria-pressed="${d.equipped.avatar === id}" aria-label="${shopItem('avatar', id).name}"><i data-lucide="${id}"></i></button>`).join('');
  renderIcons(avatarSheet.el);
  avatarSheet.open();
}

function openAllAchievements() {
  const list = $('.ach-list', achSheet.el);
  list.innerHTML = ACHIEVEMENTS.map(a => badgeHTML(a, true)).join('');
  setBars(list);
  renderIcons(list);
  achSheet.open();
}
