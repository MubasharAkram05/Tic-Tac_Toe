/**
 * Shop catalog. Every item has a `currency`: "coins" or "diamonds".
 * The first item of each cosmetic type is free and owned by default.
 * Diamond items are premium: board themes, animated X/O skins and
 * legendary avatars (10-50 diamonds).
 */
import { PRICES } from './constants.js';

const coins = (id, name, price, extra = {}) => ({ id, name, price, currency: 'coins', ...extra });
const gems = (id, name, price, extra = {}) => ({ id, name, price, currency: 'diamonds', premium: true, ...extra });

export const SHOP_ITEMS = {
  boost: [
    coins('hint', 'Hint', PRICES.hint, { desc: 'Shows a good move', icon: 'lightbulb', consumable: true }),
    coins('undo', 'Undo', PRICES.undo, { desc: 'Take back a move in a level', icon: 'undo-2', consumable: true }),
  ],
  board: [
    coins('classic', 'Classic', 0),
    coins('neon', 'Neon', 100),
    coins('pastel', 'Pastel', 150),
    coins('wood', 'Wood', 200),
    coins('galaxy', 'Galaxy', 300),
    gems('aurora', 'Aurora', 15),
    gems('royal', 'Royal Gold', 25),
    gems('crystal', 'Crystal', 40),
  ],
  skin: [
    coins('classic', 'Classic', 0),
    coins('emoji', 'Emoji', 100),
    coins('glow', 'Glow', 150),
    coins('pixel', 'Pixel', 300),
    gems('pulse', 'Pulse', 20, { animated: true }),
    gems('rainbow', 'Rainbow', 35, { animated: true }),
  ],
  avatar: [
    coins('user', 'Player', 0),
    coins('cat', 'Cat', 50),
    coins('dog', 'Dog', 75),
    coins('bird', 'Bird', 75),
    coins('ghost', 'Ghost', 100),
    coins('rocket', 'Rocket', 120),
    coins('crown', 'Crown', 150),
    gems('bot', 'Robot', 10, { legendary: true }),
    gems('wand-sparkles', 'Wizard', 25, { legendary: true }),
    gems('swords', 'Knight', 40, { legendary: true }),
    gems('flame', 'Phoenix', 50, { legendary: true }),
  ],
};

/** Shop tabs, one per currency. Each tab lists these sections in order. */
export const SHOP_TABS = [
  { id: 'coins', label: 'Coins', icon: 'coins' },
  { id: 'diamonds', label: 'Diamonds', icon: 'gem' },
];
export const SHOP_SECTIONS = {
  coins: [
    { type: 'boost', label: 'Boosts' },
    { type: 'board', label: 'Boards' },
    { type: 'skin', label: 'X/O skins' },
    { type: 'avatar', label: 'Avatars' },
  ],
  diamonds: [
    { type: 'board', label: 'Premium boards' },
    { type: 'skin', label: 'Animated skins' },
    { type: 'avatar', label: 'Legendary avatars' },
  ],
};

export const shopItem = (type, id) => SHOP_ITEMS[type].find(i => i.id === id);
export const shopIds = type => SHOP_ITEMS[type].map(i => i.id);
export const itemsFor = (type, currency) => SHOP_ITEMS[type].filter(i => i.currency === currency);
