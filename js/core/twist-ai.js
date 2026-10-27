/**
 * AI for levels whose twists change the rules (ice, line rule, wrap,
 * gravity, vanishing, shrinking). Pure logic, no DOM.
 *
 * It plays through the same twist hooks as the game (core/twists), so it
 * can never make an illegal move and it "sees" every rule:
 *  - gravity: the candidate moves are the columns (their landing cells)
 *  - vanishing: a move is judged after the oldest mark has vanished
 *  - shrinking: marks near the centre score more as the rings close
 *  - wrap / line rule: only lines that can win under the rule are scored
 *  - coin cells: a tiny bonus, far below any blocking or winning move
 * Levels with only blocked cells, preset marks or coin cells keep the
 * classic AI (core/ai.js), which already handles those.
 *
 * Search: alpha-beta (negamax) with a beam of the best candidates,
 * iterative deepening and the same 200ms time budget as the classic AI.
 */
import { chooseMove } from './ai.js';
import { random } from './random.js';
import { BLOCKED } from './board.js';
import { applyMove, cloneState, legalMoves, lineWindows, other } from './twists/index.js';
import { nextToVanish } from './twists/vanishing.js';
import { collectedBy } from './twists/coin-cells.js';

const WIN = 1e9;
const DEFENSE = 1.15;     // the opponent's lines weigh a bit more
const ROOT_CAP = 14;
const NODE_CAP = 7;
const TIME_BUDGET = 200;  // ms
const COIN_BONUS = 0.5;   // tiny: a coin never beats a real line
const CLASSIC = new Set(['blocked', 'puzzle', 'coins']);

let deadline = 0, aborted = false, nodes = 0;

/** True if this state needs the twist AI (rules differ from the classic game). */
export const needsTwistAI = s => s.twists.some(t => !CLASSIC.has(t));

/** Entry point for every game: picks the classic AI or the twist AI. Returns the landing cell. */
export function chooseStateMove(s, aiMark, level) {
  if (!needsTwistAI(s)) return chooseMove(s.board, s.size, aiMark, level);
  return chooseTwistMove(s, aiMark, level);
}

const pick = arr => arr[(random() * arr.length) | 0];

/** Legal moves near the action (radius 2 around any mark); all legal moves on an empty board or with gravity. */
function candidates(s) {
  const legal = legalMoves(s);
  if (s.gravity || legal.length <= 12) return legal;
  const n = s.size, near = legal.filter(i => {
    const r0 = (i / n) | 0, c0 = i % n;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const r = r0 + dr, c = c0 + dc;
      if (r >= 0 && r < n && c >= 0 && c < n && (s.board[r * n + c] === 'X' || s.board[r * n + c] === 'O')) return true;
    }
    return false;
  });
  if (near.length) return near;
  const mid = (n - 1) / 2; // no marks yet: the cells closest to the centre
  const d = i => Math.abs(((i / n) | 0) - mid) + Math.abs((i % n) - mid);
  const best = Math.min(...legal.map(d));
  return legal.filter(i => d(i) <= best + 1);
}

/** Moves where `mark` wins at once (played through the hooks). */
function winningMoves(s, mark, moves = candidates(s)) {
  const out = [];
  for (const m of moves) {
    const c = cloneState(s), r = applyMove(c, m, mark);
    if (r && r.line) out.push(m);
  }
  return out;
}

/**
 * Board score for `me`: every line that can still win under the rules,
 * by how many marks each side has in it (a mark about to vanish counts
 * half), plus a pull to the centre while the board shrinks and a tiny
 * coin bonus. O(windows * k).
 */
function evaluate(s, me) {
  const opp = other(me), k = s.k, fading = s.vanish ? new Set(nextToVanish(s)) : null;
  let score = 0;
  for (const w of lineWindows(s)) {
    let a = 0, b = 0, dead = false;
    for (const i of w) {
      const v = s.board[i];
      if (v === BLOCKED) { dead = true; break; }
      if (v === me) a += fading && fading.has(i) ? 0.5 : 1;
      else if (v === opp) b += fading && fading.has(i) ? 0.5 : 1;
    }
    if (dead || (a && b)) continue;
    if (a) score += Math.pow(10, (4 * a) / k) - 1;
    else if (b) score -= DEFENSE * (Math.pow(10, (4 * b) / k) - 1);
  }
  if (s.shrink) { // as the ring closes, the centre is where lines survive
    const n = s.size, mid = (n - 1) / 2, weight = 2 + 3 * s.shrink.rings;
    for (const m of ['X', 'O']) for (const i of s.order[m]) {
      if (s.board[i] !== m) continue;
      const near = mid - Math.max(Math.abs(((i / n) | 0) - mid), Math.abs((i % n) - mid));
      score += (m === me ? 1 : -1) * weight * near;
    }
  }
  if (s.coins) score += COIN_BONUS * (collectedBy(s, me).coins + collectedBy(s, me).diamonds - collectedBy(s, opp).coins - collectedBy(s, opp).diamonds);
  return score;
}

/** Candidates sorted by the score right after playing them (best first). */
function ordered(s, mark, cap) {
  return candidates(s).map(m => {
    const c = cloneState(s), r = applyMove(c, m, mark);
    return { m, v: !r ? -Infinity : r.line ? WIN : evaluate(c, mark) };
  }).sort((x, y) => y.v - x.v).slice(0, cap).map(o => o.m);
}

function negamax(s, depth, alpha, beta, mark, ply) {
  if ((++nodes & 63) === 0 && performance.now() > deadline) { aborted = true; return 0; }
  if (depth === 0) return evaluate(s, mark);
  const moves = ordered(s, mark, NODE_CAP);
  if (!moves.length) return 0;
  let best = -Infinity;
  for (const m of moves) {
    const c = cloneState(s), r = applyMove(c, m, mark);
    let v;
    if (r.line) v = WIN - ply;
    else if (c.vanish && c.moves >= c.vanish.cap) v = 0;
    else v = -negamax(c, depth - 1, -beta, -alpha, other(mark), ply + 1);
    if (aborted) return 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Iterative deepening at the root; keeps the best move of the last complete depth. */
function search(s, me, maxDepth) {
  deadline = performance.now() + TIME_BUDGET;
  aborted = false; nodes = 0;
  let moves = ordered(s, me, ROOT_CAP), best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity, bestHere = moves[0], bestV = -Infinity;
    for (const m of moves) {
      const c = cloneState(s), r = applyMove(c, m, me);
      const v = r.line ? WIN : -negamax(c, depth - 1, -Infinity, -alpha, other(me), 1);
      if (aborted) break;
      if (v > bestV) { bestV = v; bestHere = m; }
      if (v > alpha) alpha = v;
    }
    if (aborted) break;
    best = bestHere;
    moves = [best, ...moves.filter(m => m !== best)];
    if (bestV > WIN / 2) break;
  }
  return best;
}

/** Twist AI move for `aiMark`. `level`: 'easy' | 'medium' | 'hard' or a skill number 0..1. */
export function chooseTwistMove(s, aiMark, level) {
  const legal = legalMoves(s);
  if (!legal.length) return -1;
  if (typeof level === 'number') level = random() < level ? 'hard' : 'easy';
  const opp = other(aiMark), cands = candidates(s);

  if (level === 'easy') {
    const block = winningMoves(s, opp, cands);
    if (block.length && random() < 0.3) return block[0];
    return pick(cands);
  }
  const win = winningMoves(s, aiMark, cands);
  if (win.length) return win[0];
  const block = winningMoves(s, opp, legal);
  if (block.length) return block[0];

  if (level === 'medium') {
    let top = -Infinity, picks = [];
    for (const m of cands) {
      const c = cloneState(s);
      applyMove(c, m, aiMark);
      const v = evaluate(c, aiMark);
      if (v > top + 1e-9) { top = v; picks = [m]; } else if (Math.abs(v - top) <= 1e-9) picks.push(m);
    }
    return pick(picks);
  }
  return search(s, aiMark, s.size <= 6 ? 3 : 2);
}
