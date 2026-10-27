/**
 * AI player. Pure logic, no DOM, so it runs on the main thread, in a Web
 * Worker (ai.worker.js) and in Node tests.
 *
 * Internal board: Int8Array, 0 = empty, 1 = AI, 2 = human.
 * Levels: 'easy' | 'medium' | 'hard', or a number 0..1 ("AI skill" = chance
 * of playing the hard move this turn, used by campaign levels).
 */
import { winLength } from '../config/constants.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const WIN = 1e9;
const DEFENSE = 1.15;     // opponent threats weigh a bit more
const ROOT_CAP = 18;      // best N candidate moves searched at the root
const NODE_CAP = 10;      // ...and deeper in the tree (beam pruning)
const TIME_BUDGET = 200;  // ms, hard cap for the search
const geoCache = {};

let g, b, k, size, score, empty, deadline, nodes, aborted;

/**
 * Per-size geometry: neighbour lists (radius 1 and 2) for candidate moves,
 * and the full rows / columns / diagonals ("axes") used by the heuristic.
 * These are whole board lines, not a list of winning lines.
 */
function geometry(sz) {
  if (geoCache[sz]) return geoCache[sz];
  const n = sz * sz, kk = winLength(sz);
  const near1 = [], near2 = [];
  for (let i = 0; i < n; i++) {
    const r = (i / sz) | 0, c = i % sz, a = [], a2 = [];
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= sz || cc < 0 || cc >= sz) continue;
      a2.push(rr * sz + cc);
      if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) a.push(rr * sz + cc);
    }
    near1.push(a); near2.push(a2);
  }
  const axes = [], cellAxes = Array.from({ length: n }, () => []);
  for (const [dr, dc] of DIRS) {
    for (let r = 0; r < sz; r++) for (let c = 0; c < sz; c++) {
      const pr = r - dr, pc = c - dc;
      if (pr >= 0 && pr < sz && pc >= 0 && pc < sz) continue; // not the start of an axis
      const axis = [];
      for (let rr = r, cc = c; rr >= 0 && rr < sz && cc >= 0 && cc < sz; rr += dr, cc += dc) axis.push(rr * sz + cc);
      if (axis.length >= kk) {
        axis.forEach(i => cellAxes[i].push(axes.length));
        axes.push(axis);
      }
    }
  }
  return (geoCache[sz] = { n, near1, near2, axes, cellAxes });
}

/**
 * Value of a run by how many marks it still needs and its open ends.
 * For 5 in a row: open 4 > blocked 4 > open 3 > blocked 3 > open 2.
 * Using "marks still needed" makes the same table work for k = 3, 4, 5.
 */
function runValue(need, open) {
  if (need <= 0) return 1e6;
  if (open === 0) return 0;
  if (need === 1) return open === 2 ? 50000 : 5000;
  if (need === 2) return open === 2 ? 2000 : 300;
  if (need === 3) return open === 2 ? 100 : 15;
  return open === 2 ? 4 : 1;
}

/** Scores every run of player p along one axis. O(axis length). */
function axisValue(axis, p) {
  const opp = 3 - p, len = axis.length;
  let s = 0, segStart = 0;
  for (let j = 0; j <= len; j++) {
    if (j < len && b[axis[j]] !== opp) continue;
    // [segStart, j) holds only p and empty cells; skip it if it can never fit k
    if (j - segStart >= k) {
      let x = segStart;
      while (x < j) {
        if (b[axis[x]] !== p) { x++; continue; }
        const st = x;
        while (x < j && b[axis[x]] === p) x++;
        const open = (st > segStart ? 1 : 0) + (x < j ? 1 : 0);
        s += runValue(k - (x - st), open);
      }
    }
    segStart = j + 1;
  }
  return s;
}

/** Score of the (up to) 4 axes through cell i: AI minus weighted human. */
function cellValue(i) {
  let s = 0;
  for (const id of g.cellAxes[i]) {
    const ax = g.axes[id];
    s += axisValue(ax, 1) - DEFENSE * axisValue(ax, 2);
  }
  return s;
}
function totalValue() {
  let s = 0;
  for (const ax of g.axes) s += axisValue(ax, 1) - DEFENSE * axisValue(ax, 2);
  return s;
}

/** Make / unmake a move, keeping the score up to date incrementally (only 4 axes change). */
function play(i, p) {
  const before = cellValue(i);
  b[i] = p; empty--;
  const d = cellValue(i) - before;
  score += d;
  return d;
}
function unplay(i, d) { b[i] = 0; empty++; score -= d; }

/** True if p has k in a row through cell i. O(k). */
function isWin(i, p) {
  const r0 = (i / size) | 0, c0 = i % size;
  for (const [dr, dc] of DIRS) {
    let cnt = 1;
    for (let s = 1, r = r0 + dr, c = c0 + dc; s < k && r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === p; s++, r += dr, c += dc) cnt++;
    for (let s = 1, r = r0 - dr, c = c0 - dc; s < k && r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === p; s++, r -= dr, c -= dc) cnt++;
    if (cnt >= k) return true;
  }
  return false;
}

/** Candidate moves: empty cells within the neighbour radius of any mark. */
function candidates(near) {
  const out = [];
  for (let i = 0; i < g.n; i++) {
    if (b[i]) continue;
    const nb = near[i];
    for (let j = 0; j < nb.length; j++) if (b[nb[j]]) { out.push(i); break; }
  }
  if (!out.length) out.push((size >> 1) * size + (size >> 1)); // empty board: centre
  return out;
}

/**
 * Fast move priority for side p (attack + defence). Used for move
 * ordering, beam pruning and Medium play. O(k) per cell.
 */
function quick(i, p) {
  const r0 = (i / size) | 0, c0 = i % size;
  let s = 0;
  for (const [dr, dc] of DIRS) {
    for (let v = 1; v <= 2; v++) {
      let cnt = 0, open = 0, r = r0 + dr, c = c0 + dc, st = 0;
      while (st < k && r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === v) { cnt++; r += dr; c += dc; st++; }
      if (r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === 0) open++;
      r = r0 - dr; c = c0 - dc; st = 0;
      while (st < k && r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === v) { cnt++; r -= dr; c -= dc; st++; }
      if (r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === 0) open++;
      if (!cnt) continue;
      const val = cnt + 1 >= k ? 1e6 : runValue(k - cnt - 1, open);
      s += v === p ? val : val * 0.9;
    }
  }
  const mid = (size - 1) / 2; // small pull toward the centre
  return s + 1 - (Math.abs(r0 - mid) + Math.abs(c0 - mid)) / (size * 2);
}

function ordered(moves, p, cap) {
  return moves
    .map(m => ({ m, s: quick(m, p) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, cap)
    .map(o => o.m);
}

const randomOf = arr => arr[(Math.random() * arr.length) | 0];

/** First cell where p wins right now, or -1. A winning cell always touches p's marks. */
function findWin(p) {
  for (const i of candidates(g.near1)) {
    b[i] = p;
    const w = isWin(i, p);
    b[i] = 0;
    if (w) return i;
  }
  return -1;
}

/**
 * Leaf score from p's view, plus a cheap threat check so the search does
 * not miss a win that is only one move past its depth ("horizon"):
 * - p can win right now                     -> win
 * - opponent has 2+ winning cells           -> loss (can only block one)
 * - p can make an open four, opponent has no immediate win -> nearly won
 * Cost: O(candidates * k).
 */
function leafValue(p, ply) {
  let oppWins = 0, myOpenFour = false;
  for (const i of candidates(g.near1)) {
    const r0 = (i / size) | 0, c0 = i % size;
    let oppWinsHere = false; // one cell counts once, even if it wins in 2 directions
    for (const [dr, dc] of DIRS) {
      for (let v = 1; v <= 2; v++) {
        let cnt = 0, open = 0, r = r0 + dr, c = c0 + dc;
        while (cnt < k && r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === v) { cnt++; r += dr; c += dc; }
        if (r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === 0) open++;
        r = r0 - dr; c = c0 - dc;
        while (cnt < k && r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === v) { cnt++; r -= dr; c -= dc; }
        if (r >= 0 && r < size && c >= 0 && c < size && b[r * size + c] === 0) open++;
        if (cnt + 1 >= k) {
          if (v === p) return WIN - ply - 1;
          oppWinsHere = true;
        } else if (v === p && cnt + 2 === k && open === 2) myOpenFour = true;
      }
    }
    if (oppWinsHere) oppWins++;
  }
  if (oppWins >= 2) return -(WIN - ply - 2);
  const s = p === 1 ? score : -score;
  return myOpenFour && !oppWins && k > 3 ? s + 400000 : s;
}

/**
 * Negamax + alpha-beta. `p` is the side to move, `last` the opponent's
 * last move. Returns a score from p's point of view.
 */
function negamax(depth, alpha, beta, p, last, ply) {
  if (isWin(last, 3 - p)) return -(WIN - ply);
  if (!empty) return 0;
  if (!depth) return leafValue(p, ply);
  if ((++nodes & 255) === 0 && performance.now() > deadline) { aborted = true; return 0; }
  let best = -Infinity;
  for (const m of ordered(candidates(g.near1), p, NODE_CAP)) {
    const d = play(m, p);
    const s = -negamax(depth - 1, -beta, -alpha, 3 - p, m, ply + 1);
    unplay(m, d);
    if (aborted) return 0;
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break; // prune
  }
  return best;
}

/** Hard 4x4+: iterative deepening up to maxDepth; stops when the time budget runs out. */
function deepSearch(maxDepth) {
  deadline = performance.now() + TIME_BUDGET;
  aborted = false; nodes = 0;
  score = totalValue();
  let moves = ordered(candidates(size >= 7 ? g.near2 : g.near1), 1, ROOT_CAP);
  let best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity, bestHere = moves[0], bestScore = -Infinity;
    for (const m of moves) {
      const d = play(m, 1);
      const s = -negamax(depth - 1, -Infinity, -alpha, 2, m, 1);
      unplay(m, d);
      if (aborted) break;
      if (s > bestScore) { bestScore = s; bestHere = m; }
      if (s > alpha) alpha = s;
    }
    if (aborted) break;                              // keep the last complete depth
    best = bestHere;
    moves = [best, ...moves.filter(m => m !== best)]; // try best first next round
    if (bestScore > WIN / 2) break;                  // forced win found
  }
  return best;
}

/** Hard 3x3: full minimax with alpha-beta. Unbeatable. */
function solve(p, last, ply, alpha, beta) {
  if (isWin(last, 3 - p)) return -(10 - ply);
  if (!empty) return 0;
  let best = -Infinity;
  for (let m = 0; m < 9; m++) {
    if (b[m]) continue;
    b[m] = p; empty--;
    const s = -solve(3 - p, m, ply + 1, -beta, -alpha);
    b[m] = 0; empty++;
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}
function perfect() {
  let top = -Infinity, picks = [];
  for (let m = 0; m < 9; m++) {
    if (b[m]) continue;
    b[m] = 1; empty--;
    const s = -solve(2, m, 1, -Infinity, Infinity); // full window = exact value
    b[m] = 0; empty++;
    if (s > top) { top = s; picks = [m]; } else if (s === top) picks.push(m);
  }
  return randomOf(picks); // vary play among equally perfect moves
}

/** Public entry: returns the cell index the AI plays. */
export function chooseMove(board, sz, aiMark, level) {
  size = sz; k = winLength(sz); g = geometry(sz);
  b = Int8Array.from(board, v => (v === aiMark ? 1 : v ? 2 : 0));
  const free = [];
  for (let i = 0; i < g.n; i++) if (!b[i]) free.push(i);
  empty = free.length;
  // on big boards "random" means random near the action
  const pool = sz <= 5 ? free : candidates(g.near1);

  // Campaign: a number is "AI skill", the chance of playing its best move this turn
  if (typeof level === 'number') level = Math.random() < level ? 'hard' : 'easy';

  if (level === 'easy') {
    const block = findWin(2);
    if (block >= 0 && Math.random() < 0.3) return block;
    return randomOf(pool);
  }

  const win = findWin(1);
  if (win >= 0) return win;
  const block = findWin(2);
  if (block >= 0) return block;

  if (level === 'medium') {
    let top = -Infinity, picks = [];
    for (const i of pool) {
      const s = quick(i, 1);
      if (s > top + 1e-9) { top = s; picks = [i]; } else if (Math.abs(s - top) <= 1e-9) picks.push(i);
    }
    return randomOf(picks);
  }

  return sz === 3 ? perfect() : deepSearch(3);
}
