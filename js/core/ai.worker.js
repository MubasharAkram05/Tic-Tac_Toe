/**
 * Web Worker (module) that runs the AI off the main thread.
 * Used for 9x9 boards and up so the UI never freezes.
 * Message in:  { id, board, size, ai, level }
 * Message out: { id, move }
 */
import { chooseMove } from './ai.js';

self.onmessage = e => {
  const { id, board, size, ai, level } = e.data;
  self.postMessage({ id, move: chooseMove(board, size, ai, level) });
};
