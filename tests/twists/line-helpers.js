/** Helpers for the line rule tests. */
import { createState as cs, lineWindows } from '../../js/core/twists/index.js';
export { createState, applyMove, seed, playOut, playAll } from './helpers.js';

/** Number of winning lines on an empty board under a line rule. */
export const lineCount = (size, rule) => lineWindows(cs(size, { twists: ['lines'], rule })).length;
