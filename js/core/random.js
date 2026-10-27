/**
 * One random source for the AI (both the classic AI and the twist AI).
 * The game uses Math.random; tests inject a seeded generator with
 * setRandom() so their results never change between runs.
 */
let src = Math.random;

export const random = () => src();
export function setRandom(fn) { src = typeof fn === 'function' ? fn : Math.random; }
