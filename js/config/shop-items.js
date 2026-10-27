/**
 * Shop catalog. Prices are in coins. The first item of each cosmetic
 * type is free and owned by default.
 */
import { PRICES } from './constants.js';

export const SHOP_ITEMS = {
  boost: [
    { id: 'hint', name: 'Hint', desc: 'Shows a good move', icon: 'lightbulb', price: PRICES.hint, consumable: true },
    { id: 'undo', name: 'Undo', desc: 'Take back a move in a level', icon: 'undo-2', price: PRICES.undo, consumable: true },
  ],
  board: [
    { id: 'classic', name: 'Classic', price: 0 },
    { id: 'neon', name: 'Neon', price: 100 },
    { id: 'pastel', name: 'Pastel', price: 150 },
    { id: 'wood', name: 'Wood', price: 200 },
    { id: 'galaxy', name: 'Galaxy', price: 300 },
  ],
  skin: [
    { id: 'classic', name: 'Classic', price: 0 },
    { id: 'emoji', name: 'Emoji', price: 100 },
    { id: 'glow', name: 'Glow', price: 150 },
    { id: 'pixel', name: 'Pixel', price: 300 },
  ],
  avatar: [
    { id: 'user', name: 'Player', price: 0 },
    { id: 'cat', name: 'Cat', price: 50 },
    { id: 'dog', name: 'Dog', price: 75 },
    { id: 'bird', name: 'Bird', price: 75 },
    { id: 'ghost', name: 'Ghost', price: 100 },
    { id: 'rocket', name: 'Rocket', price: 120 },
    { id: 'crown', name: 'Crown', price: 150 },
  ],
};

export const SHOP_TABS = [
  { id: 'boost', label: 'Boosts' },
  { id: 'board', label: 'Boards' },
  { id: 'skin', label: 'Skins' },
  { id: 'avatar', label: 'Avatars' },
];

export const shopItem = (type, id) => SHOP_ITEMS[type].find(i => i.id === id);
export const shopIds = type => SHOP_ITEMS[type].map(i => i.id);
