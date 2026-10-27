/**
 * Runs the AI: on the main thread for small boards, in a module Web Worker
 * for 9x9 and up so the UI never freezes. Falls back to the main thread if
 * a worker can't be created.
 */
import { chooseMove } from '../core/ai.js';

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
      if (pending) { const p = pending; pending = null; p.cb(chooseMove(...p.args)); }
    };
  } catch (err) {
    broken = true; worker = null;
  }
  return worker;
}

/** Calls cb(move) once the AI has decided. */
export function runAI(board, size, aiMark, level, cb) {
  if (size >= 9 && getWorker()) {
    const id = ++seq;
    pending = { id, cb, args: [board.slice(), size, aiMark, level] };
    worker.postMessage({ id, board: board.slice(), size, ai: aiMark, level });
    return;
  }
  cb(chooseMove(board, size, aiMark, level));
}

/** Drops the answer of a running search (e.g. after undo or leaving the game). */
export const cancelAI = () => { pending = null; };
export const usingWorker = () => !!worker;
