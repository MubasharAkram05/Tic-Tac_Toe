/**
 * Shop: boosts (hint, undo), board themes, X/O skins and avatars.
 * Items you can't afford show the price, a lock and "Need N more coins".
 */
import { $, createScope, renderIcons, setSeg, segHTML } from '../utils/dom.js';
import { SHOP_ITEMS, SHOP_TABS, shopItem } from '../config/shop-items.js';
import { save } from '../services/storage.js';
import { buyItem, equipItem } from '../services/economy.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { onEvent } from '../utils/events.js';
import { markSVG, skinMark } from '../components/board-view.js';
import { showToast } from '../components/toast.js';

export const appBar = { title: 'Shop', back: true };

let root, scope, tab = 'boost';

export function mount(el, params) {
  root = el;
  scope = createScope();
  if (params && SHOP_ITEMS[params.tab]) tab = params.tab;
  el.innerHTML = `
    <div class="page-scroll shop-page">
      ${segHTML({ group: 'shop', key: 'tab', label: 'Shop section', options: SHOP_TABS.map(t => ({ val: t.id, label: t.label })) })}
      <div class="shop-grid"></div>
    </div>`;
  render();
  scope.on(el, 'click', onClick);
  scope.add(onEvent('progress', () => root && render()));
  scope.add(onEvent('coins', () => root && render()));
}

export function update(params) {
  if (params && SHOP_ITEMS[params.tab]) { tab = params.tab; render(); }
}

export function unmount() {
  if (scope) scope.dispose();
  root = null;
}

function preview(type, it) {
  if (type === 'boost') return `<div class="si-boost"><i data-lucide="${it.icon}"></i></div>`;
  if (type === 'avatar') return `<div class="si-avatar"><i data-lucide="${it.id}"></i></div>`;
  const cell = m => `<div class="cell${m ? ' filled ' + m.toLowerCase() : ''} instant">${m ? (type === 'skin' ? skinMark(it.id, m) : markSVG(m)) : ''}</div>`;
  if (type === 'board') return `<div class="si-board" data-board="${it.id}">${['X', '', 'O', '', 'X', '', 'O', '', 'X'].map(cell).join('')}</div>`;
  return `<div class="si-marks">${cell('X')}${cell('O')}</div>`;
}

function render() {
  const d = save.data;
  setSeg($('.seg[data-group="shop"]', root), tab);
  $('.shop-grid', root).innerHTML = SHOP_ITEMS[tab].map(it => {
    const owned = !it.consumable && d.owned[tab].includes(it.id);
    const equipped = owned && d.equipped[tab] === it.id;
    const short = it.price - d.coins;
    let btn, msg = '';
    if (equipped) btn = '<button class="btn3d small ghost" disabled>Equipped</button>';
    else if (owned) btn = `<button class="btn3d small" data-act="equip" data-id="${it.id}">Equip</button>`;
    else {
      btn = `<button class="btn3d small gold" data-act="buy" data-id="${it.id}" ${short > 0 ? 'disabled' : ''} aria-label="Buy ${it.name} for ${it.price} coins"><i data-lucide="coins"></i>${it.price}</button>`;
      if (short > 0) msg = `Need ${short} more coins`;
    }
    const desc = it.consumable ? `${it.desc} · you have ${d.inventory[it.id]}` : '';
    return `<div class="shop-item glass ${equipped ? 'equipped' : ''}">
      ${!owned && !it.consumable ? '<span class="si-lock" aria-label="Locked"><i data-lucide="lock"></i></span>' : ''}
      ${preview(tab, it)}
      <span class="si-name">${it.name}</span>${desc ? `<span class="si-desc">${desc}</span>` : ''}
      ${btn}<span class="si-msg">${msg}</span>
    </div>`;
  }).join('');
  renderIcons(root);
}

function onClick(e) {
  const segBtn = e.target.closest('.seg button');
  if (segBtn) { tab = segBtn.dataset.val; sound.click(); haptic(8); render(); return; }
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const it = shopItem(tab, b.dataset.id);
  if (b.dataset.act === 'buy') {
    const fail = buyItem(tab, it.id);
    if (fail) { showToast(fail, 'coins'); sound.error(); return; }
    haptic([10, 30, 10]);
    showToast(it.consumable ? `Bought 1 ${it.name}` : `Unlocked ${it.name}!`, 'shopping-bag');
    if (!it.consumable) equipItem(tab, it.id);
  } else {
    equipItem(tab, it.id);
    sound.click(); haptic(8);
  }
  render();
}
