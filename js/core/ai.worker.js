/**
 * Web Worker (module) that runs the AI off the main thread.
 * Used for 9x9 boards and up so the UI never freezes.
 * Message in:  { id, state, ai, level }   (a core/twists game state)
 * Message out: { id, move }
 */
import { chooseStateMove } from './twist-ai.js';

self.onmessage = e => {
  const { id, state, ai, level } = e.data;
  self.postMessage({ id, move: chooseStateMove(state, ai, level) });
};
