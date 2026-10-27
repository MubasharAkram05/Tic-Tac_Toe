/**
 * Runs the AI for a game state (core/twists): on the main thread for small
 * boards, in a module Web Worker for 9x9 and up so the UI never freezes.
 * Falls back to the main thread if a worker can't be created.
 * Classic games and twist levels go through the same call; the AI picks
 * the right engine (core/twist-ai.js).
 */
import { chooseStateMove } from '../core/twist-ai.js';
import { cloneState } from '../core/twists/index.js';

let worker = null, broken = false, seq = 0, pending = null;

function getWorker() {
  if (worker || broken) return worker;
  try {
    worker = new Worker(new URL('../core/ai.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => {
      if (pending && pending.id === e.data.id) { const cb = pending.cb; pending = null; cb(e.data.move); }
    };
    worker.onerror = () => {
      broken = true; worker = null;
      if (pending) { const p = pending; pending = null; p.cb(chooseStateMove(...p.args)); }
    };
  } catch (err) {
    broken = true; worker = null;
  }
  return worker;
}

/** Calls cb(cell) once the AI has decided where `aiMark` plays. */
export function runAI(state, aiMark, level, cb) {
  const snap = cloneState(state); // the game may change while the worker thinks
  if (state.size >= 9 && getWorker()) {
    const id = ++seq;
    pending = { id, cb, args: [snap, aiMark, level] };
    worker.postMessage({ id, state: snap, ai: aiMark, level });
    return;
  }
  cb(chooseStateMove(snap, aiMark, level));
}

/** Drops the answer of a running search (e.g. after undo or leaving the game). */
export const cancelAI = () => { pending = null; };
export const usingWorker = () => !!worker;
