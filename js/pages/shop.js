/**
 * Shop with two tabs:
 *  - Coins:    boosts (hint, undo), board themes, X/O skins, avatars
 *  - Diamonds: the diamond -> coin exchange, premium boards, animated skins,
 *              legendary avatars
 * Items you can't afford show a disabled button and "Need N more ...".
 * Diamond purchases are confirmed in a small bottom sheet.
 *
 * Routes: #/shop?tab=coins | #/shop?tab=diamonds, and the older
 * #/shop?tab=avatar style (opens that section of the Coins tab).
 */
import { $, createScope, renderIcons, setSeg, segHTML } from '../utils/dom.js';
import { EXCHANGE_RATE } from '../config/constants.js';
import { SHOP_ITEMS, SHOP_TABS, SHOP_SECTIONS, shopItem, itemsFor } from '../config/shop-items.js';
import { save } from '../services/storage.js';
import { buyItem, equipItem, exchangeDiamonds, needText } from '../services/economy.js';
import { sound } from '../services/audio.js';
import { haptic } from '../services/haptics.js';
import { onEvent } from '../utils/events.js';
import { markSVG, skinMark } from '../components/board-view.js';
import { confirmSpend } from '../components/confirm-sheet.js';
import { flyCurrency } from '../components/currency-bar.js';
import { showToast } from '../components/toast.js';

export const appBar = { title: 'Shop', back: true };

let root, scope, tab = 'coins', focusType = '';

const CURRENCY_ICON = { coins: 'coins', diamonds: 'gem' };

/** Reads ?tab=… : a currency tab, or an item type (section of the Coins tab). */
function readParams(params) {
  focusType = '';
  if (!params || !params.tab) return;
  if (SHOP_TABS.some(t => t.id === params.tab)) tab = params.tab;
  else if (SHOP_ITEMS[params.tab]) { tab = 'coins'; focusType = params.tab; }
}

export function mount(el, params) {
  root = el;
  scope = createScope();
  readParams(params);
  el.innerHTML = `
    <div class="page-scroll shop-page">
      ${segHTML({ group: 'shop', key: 'tab', label: 'Shop currency', options: SHOP_TABS.map(t => ({ val: t.id, label: `<i data-lucide="${t.icon}"></i>${t.label}`, aria: t.label })) })}
      <div class="shop-body"></div>
    </div>`;
  render();
  scope.on(el, 'click', onClick);
  scope.add(onEvent('progress', () => root && render()));
  scope.add(onEvent('coins', () => root && render()));
  scope.add(onEvent('diamonds', () => root && render()));
}

export function update(params) {
  readParams(params);
  render();
}

export function unmount() {
  if (scope) scope.dispose();
  root = null;
}

function preview(type, it) {
  if (type === 'boost') return `<div class="si-boost"><i data-lucide="${it.icon}"></i></div>`;
  if (type === 'avatar') return `<div class="si-avatar${it.legendary ? ' legendary' : ''}"><i data-lucide="${it.id}"></i></div>`;
  const cell = m => `<div class="cell${m ? ' filled ' + m.toLowerCase() : ''} instant">${m ? (type === 'skin' ? skinMark(it.id, m) : markSVG(m)) : ''}</div>`;
  if (type === 'board') return `<div class="si-board" data-board="${it.id}">${['X', '', 'O', '', 'X', '', 'O', '', 'X'].map(cell).join('')}</div>`;
  return `<div class="si-marks">${cell('X')}${cell('O')}</div>`;
}

function itemHTML(type, it) {
  const d = save.data;
  const owned = !it.consumable && d.owned[type].includes(it.id);
  const equipped = owned && d.equipped[type] === it.id;
  const need = needText(it.price, it.currency), icon = CURRENCY_ICON[it.currency];
  let btn, msg = '';
  if (equipped) btn = '<button class="btn3d small ghost" disabled>Equipped</button>';
  else if (owned) btn = `<button class="btn3d small" data-act="equip" data-type="${type}" data-id="${it.id}">Equip</button>`;
  else {
    const cls = it.currency === 'diamonds' ? 'gem' : 'gold';
    btn = `<button class="btn3d small ${cls}" data-act="buy" data-type="${type}" data-id="${it.id}" ${need ? 'disabled' : ''} aria-label="Buy ${it.name} for ${it.price} ${it.currency}"><i data-lucide="${icon}"></i>${it.price}</button>`;
    msg = need;
  }
  const desc = it.consumable ? `${it.desc} · you have ${d.inventory[it.id]}` : it.animated ? 'Animated' : it.legendary ? 'Legendary' : '';
  return `<div class="shop-item glass ${equipped ? 'equipped' : ''}${it.premium ? ' premium' : ''}">
    ${!owned && !it.consumable ? '<span class="si-lock" aria-label="Locked"><i data-lucide="lock"></i></span>' : ''}
    ${preview(type, it)}
    <span class="si-name">${it.name}</span>${desc ? `<span class="si-desc">${desc}</span>` : ''}
    ${btn}<span class="si-msg">${msg}</span>
  </div>`;
}

/** Exchange card (Diamonds tab): 1 diamond -> EXCHANGE_RATE coins, one way only. */
function exchangeHTML() {
  const need = needText(1, 'diamonds');
  return `<section class="exchange-card glass">
    <div class="ex-rate"><span class="ex-gem"><i data-lucide="gem"></i>1</span><i data-lucide="arrow-right"></i><span class="ex-coin"><i data-lucide="coins"></i>${EXCHANGE_RATE}</span></div>
    <p class="ex-note">Swap diamonds for coins. One way only: coins can't buy diamonds.</p>
    <button class="btn3d gem" data-act="exchange" ${need ? 'disabled' : ''}><i data-lucide="arrow-left-right"></i>Exchange 1 diamond</button>
    <span class="si-msg">${need}</span>
  </section>`;
}

function render() {
  if (!root) return;
  setSeg($('.seg[data-group="shop"]', root), tab);
  const body = $('.shop-body', root);
  body.innerHTML = (tab === 'diamonds' ? exchangeHTML() : '') + SHOP_SECTIONS[tab].map(sec => `
    <section class="shop-section" data-section="${sec.type}">
      <h3 class="shop-heading">${sec.label}</h3>
      <div class="shop-grid">${itemsFor(sec.type, tab).map(it => itemHTML(sec.type, it)).join('')}</div>
    </section>`).join('');
  renderIcons(root);
  if (focusType) {
    const sec = $(`[data-section="${focusType}"]`, body);
    focusType = '';
    if (sec) requestAnimationFrame(() => sec.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
}

function buy(type, it, btn) {
  const fail = buyItem(type, it.id);
  if (fail) { showToast(fail, CURRENCY_ICON[it.currency]); sound.error(); return; }
  haptic([10, 30, 10]);
  showToast(it.consumable ? `Bought 1 ${it.name}` : `Unlocked ${it.name}!`, 'shopping-bag');
  if (!it.consumable) equipItem(type, it.id);
  if (btn) btn.blur();
}

function onClick(e) {
  const segBtn = e.target.closest('.seg[data-group="shop"] button');
  if (segBtn) {
    if (segBtn.dataset.val === tab) return;
    tab = segBtn.dataset.val;
    sound.click(); haptic(8);
    render();
    return;
  }
  const b = e.target.closest('button[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === 'exchange') {
    confirmSpend({
      title: 'Exchange 1 diamond?', text: `You get ${EXCHANGE_RATE} coins. Coins can't be turned back into diamonds.`,
      price: 1, currency: 'diamonds', confirmLabel: 'Exchange',
      onConfirm: () => {
        const got = exchangeDiamonds(1);
        if (!got) { sound.error(); return; }
        showToast(`+${got} coins`, 'coins');
        const card = root && $('.exchange-card', root);
        if (card) flyCurrency('coins', card, got);
      },
    });
    return;
  }
  const type = b.dataset.type, it = shopItem(type, b.dataset.id);
  if (!it) return;
  if (act === 'buy') {
    // Diamond items are confirmed first; coin items are bought right away (as before)
    if (it.currency === 'diamonds') {
      confirmSpend({
        title: `Buy ${it.name}?`, text: it.legendary ? 'A legendary avatar.' : it.animated ? 'An animated X/O skin.' : 'A premium board theme.',
        price: it.price, currency: 'diamonds', confirmLabel: 'Buy',
        onConfirm: () => buy(type, it),
      });
    } else buy(type, it, b);
  } else {
    equipItem(type, it.id);
    sound.click(); haptic(8);
  }
}
