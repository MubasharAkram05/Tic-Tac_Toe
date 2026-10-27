/**
 * Board view: builds the cell grid, sizes it to the screen, draws marks,
 * the win line and the last-move ring. Boards 9x9 and up get pinch zoom,
 * one-finger pan and double-tap reset, all snapped to whole cells.
 *
 *   const view = new BoardView({ area, onCellTap });
 *   view.build(size); view.paint(i, 'X', true); view.destroy();
 */
import { BOARD_GAPS, ZOOM_FROM, MAX_ZOOM } from '../config/constants.js';
import { save } from '../services/storage.js';
import { clamp } from '../utils/validate.js';

/* ---------- Marks (X / O) and skins ---------- */
export function markSVG(mark, cls = '') {
  return mark === 'X'
    ? `<svg viewBox="0 0 100 100" class="${cls} x" aria-hidden="true"><path class="stroke" pathLength="100" d="M24 24 L76 76"/><path class="stroke second" pathLength="100" d="M76 24 L24 76"/></svg>`
    : `<svg viewBox="0 0 100 100" class="${cls} o" aria-hidden="true"><circle class="stroke" pathLength="100" cx="50" cy="50" r="28"/></svg>`;
}
export const miniMark = mark => markSVG(mark, 'mini-mark');

function pixelSVG(mark) {
  const px = [];
  if (mark === 'X') for (let i = 1; i <= 5; i++) px.push([i, i], [6 - i, i]);
  else for (let i = 2; i <= 4; i++) px.push([i, 1], [i, 5], [1, i], [5, i]);
  return `<svg viewBox="0 0 7 7" class="pixel pop" aria-hidden="true">${px.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('')}</svg>`;
}

/** Mark drawn with a given X/O skin. */
export function skinMark(skin, mark) {
  if (skin === 'glow') return markSVG(mark, 'skin-glow');
  if (skin === 'emoji') return `<span class="emoji-mark pop" aria-hidden="true">${mark === 'X' ? '❌' : '⭕'}</span>`;
  if (skin === 'pixel') return pixelSVG(mark);
  return markSVG(mark);
}
/** Mark drawn with the equipped skin. */
export const cellMark = mark => skinMark(save.data.equipped.skin, mark);

/* ---------- Board view ---------- */
export class BoardView {
  constructor({ area, onCellTap }) {
    this.area = area;
    this.vp = area.querySelector('.viewport');
    this.board = area.querySelector('.board');
    this.onCellTap = onCellTap;
    this.size = 3;
    this.view = { s: 1, tx: 0, ty: 0, cell: 0, gap: 0, step: 0, bw: 0, m: 0, mMin: 0, sMax: 1, zoomable: false };
    this.gesture = { pts: new Map(), start: null, origin: null, moved: false, pinched: false, suppress: false };
    this.lastTap = null;
    this.lastWin = null;
    this.cleanups = [];
    this.wireEvents();
  }

  listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn, opts));
  }

  /** Builds an empty board of the given size. */
  build(size) {
    this.size = size;
    let html = '';
    for (let i = 0; i < size * size; i++) {
      html += `<button class="cell" role="gridcell" data-i="${i}" aria-label="Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}, empty"></button>`;
    }
    html += '<svg class="win-line" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"/></svg>';
    this.board.innerHTML = html;
    this.board.classList.remove('done', 'enter', 'locked');
    void this.board.offsetWidth; // restart the fade-in
    this.board.classList.add('enter');
    this.lastWin = null;
    this.layout();
  }

  cellEl(i) { return this.board.children[i]; }

  paint(i, mark, animate) {
    const cell = this.cellEl(i), n = this.size;
    if (!cell) return;
    cell.className = 'cell' + (mark ? ` filled ${mark.toLowerCase()}` : '') + (animate ? '' : ' instant');
    cell.innerHTML = mark ? cellMark(mark) : '';
    cell.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${mark || 'empty'}`);
  }

  /** Ring around the last move, easy to spot on big boards. */
  markLast(i) {
    const prev = this.board.querySelector('.cell.last');
    if (prev) prev.classList.remove('last');
    if (i !== undefined && this.cellEl(i)) this.cellEl(i).classList.add('last');
  }

  setLocked(locked) { this.board.classList.toggle('locked', locked); }

  highlight(i) { this.clearHighlight(); if (this.cellEl(i)) this.cellEl(i).classList.add('hint'); }
  clearHighlight() { const c = this.board.querySelector('.cell.hint'); if (c) c.classList.remove('hint'); }

  /** Win: glow on winning cells, others fade, line draws across. */
  showWin(line, mark) {
    this.lastWin = { line, mark };
    line.forEach(i => this.cellEl(i).classList.add('win'));
    this.board.classList.add('done');
    this.drawWinLine(true);
  }

  drawWinLine(animate) {
    if (!this.lastWin) return;
    const { line, mark } = this.lastWin;
    const svg = this.board.querySelector('.win-line'), ln = svg.querySelector('line');
    const center = i => {
      const c = this.cellEl(i);
      return [c.offsetLeft + c.offsetWidth / 2, c.offsetTop + c.offsetHeight / 2];
    };
    let [x1, y1] = center(line[0]), [x2, y2] = center(line[line.length - 1]);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ext = this.view.cell * 0.3;
    x1 -= dx / len * ext; y1 -= dy / len * ext; x2 += dx / len * ext; y2 += dy / len * ext;
    const total = len + ext * 2;
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    ln.style.strokeWidth = Math.max(3, this.view.cell * 0.12);
    svg.setAttribute('class', 'win-line ' + mark.toLowerCase());
    ln.style.strokeDasharray = total;
    if (animate) {
      ln.style.transition = 'none';
      ln.style.strokeDashoffset = total;
      void ln.getBoundingClientRect();
      ln.style.transition = '';
    }
    ln.style.strokeDashoffset = 0;
  }

  /**
   * cellSize = floor((available - total gaps) / size), set as a CSS variable.
   * Spare pixels from rounding go into the gaps; the viewport is sized to
   * exactly n whole cells, so nothing is ever cut. Resets the zoom.
   */
  layout() {
    const n = this.size, v = this.view;
    if (!this.board.children.length) return;
    const W = this.area.clientWidth, H = this.area.clientHeight;
    if (!W || !H) return;
    const avail = Math.min(W, H);
    let gap = BOARD_GAPS[n] || 3;
    const cell = clamp(Math.floor((avail - (n - 1) * gap) / n), 8, 140);
    if (cell < 140) gap += Math.floor((avail - n * cell - (n - 1) * gap) / (n - 1));
    const step = cell + gap, bw = n * cell + (n - 1) * gap;
    Object.assign(v, { cell, gap, step, bw, zoomable: n >= ZOOM_FROM });
    // Zoom levels show m x m whole cells; the smallest m keeps zoom <= 2x
    v.mMin = v.zoomable ? Math.ceil((bw / MAX_ZOOM + gap) / step) : n;
    v.sMax = bw / (v.mMin * step - gap);

    this.vp.style.width = this.vp.style.height = bw + 'px';
    this.vp.style.setProperty('--cr', Math.max(4, Math.round(cell * 0.22)) + 'px');
    this.board.style.setProperty('--n', n);
    this.board.style.setProperty('--cell', cell + 'px');
    this.board.style.setProperty('--gap', gap + 'px');
    this.vp.classList.toggle('zoomable', v.zoomable);
    this.resetView(false);
    this.drawWinLine(false);
  }

  applyView(smooth) {
    const v = this.view;
    this.board.classList.toggle('smooth', !!smooth);
    this.board.style.transform = v.s === 1 && !v.tx && !v.ty ? '' : `translate(${v.tx}px, ${v.ty}px) scale(${v.s})`;
  }
  resetView(smooth) {
    Object.assign(this.view, { s: 1, tx: 0, ty: 0, m: this.size });
    this.applyView(smooth);
  }
  /** Board edges never leave the viewport edges: no empty space past the board. */
  clampPan() {
    const v = this.view, lim = v.bw - v.bw * v.s;
    v.tx = clamp(v.tx, lim, 0);
    v.ty = clamp(v.ty, lim, 0);
  }
  /**
   * After a gesture: pick the nearest zoom where m x m whole cells exactly fill
   * the viewport (s = bw / (m*step - gap)), then snap pan to whole cells.
   */
  snapView(smooth) {
    const v = this.view, n = this.size;
    if (!v.zoomable) return;
    let m = n, best = Infinity;
    for (let k = n; k >= v.mMin; k--) {
      const d = Math.abs(v.bw / (k * v.step - v.gap) - v.s);
      if (d < best) { best = d; m = k; }
    }
    if (m === n) { this.resetView(smooth); return; }
    const cx = (v.bw / 2 - v.tx) / v.s, cy = (v.bw / 2 - v.ty) / v.s;
    const s = v.bw / (m * v.step - v.gap), half = v.bw / (2 * s);
    const j = clamp(Math.round((cx - half) / v.step), 0, n - m);
    const i = clamp(Math.round((cy - half) / v.step), 0, n - m);
    Object.assign(v, { s, m, tx: -j * v.step * s, ty: -i * v.step * s });
    this.applyView(smooth);
  }
  zoomAt(s, cx, cy) {
    const v = this.view, ns = clamp(s, 1, v.sMax);
    const px = (cx - v.tx) / v.s, py = (cy - v.ty) / v.s;
    v.s = ns; v.tx = cx - px * ns; v.ty = cy - py * ns;
    this.clampPan(); this.applyView(false);
  }
  /** When zoomed in, pan by whole cells so cell i is on screen (e.g. the AI's move). */
  ensureVisible(i) {
    const v = this.view;
    if (!v.zoomable || v.s === 1) return;
    const n = this.size, unit = v.step * v.s;
    let j = Math.round(-v.tx / unit), r = Math.round(-v.ty / unit);
    const col = i % n, row = Math.floor(i / n);
    if (col < j) j = col; else if (col > j + v.m - 1) j = col - v.m + 1;
    if (row < r) r = row; else if (row > r + v.m - 1) r = row - v.m + 1;
    v.tx = -j * unit; v.ty = -r * unit;
    this.applyView(true);
  }

  /* ---------- Gestures: drags over 8px are not taps ---------- */
  gestureBase() {
    const G = this.gesture, v = this.view;
    const pts = Array.from(G.pts.values()), rect = this.vp.getBoundingClientRect();
    if (pts.length >= 2) {
      const [a, b] = pts;
      G.start = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - rect.left, my: (a.y + b.y) / 2 - rect.top, s: v.s, tx: v.tx, ty: v.ty };
    } else if (pts.length === 1) {
      G.start = { x: pts[0].x, y: pts[0].y, tx: v.tx, ty: v.ty };
    }
  }

  wireEvents() {
    const G = this.gesture, v = this.view, vp = this.vp;
    this.listen(vp, 'pointerdown', e => {
      if (!G.pts.size) Object.assign(G, { moved: false, pinched: false, suppress: false, origin: { x: e.clientX, y: e.clientY } });
      G.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (G.pts.size === 2 && v.zoomable) { G.pinched = true; G.suppress = true; }
      this.gestureBase();
    });
    this.listen(vp, 'pointermove', e => {
      if (!G.pts.has(e.pointerId)) return;
      G.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = Array.from(G.pts.values()), st = G.start;
      if (!G.moved && pts.length === 1 && Math.hypot(e.clientX - G.origin.x, e.clientY - G.origin.y) > 8) {
        G.moved = true; G.suppress = true;
        if (v.zoomable) vp.setPointerCapture(e.pointerId);
      }
      if (!v.zoomable) return;
      if (pts.length >= 2 && st.dist) {
        const [a, b] = pts, rect = vp.getBoundingClientRect();
        const ns = clamp(st.s * Math.hypot(a.x - b.x, a.y - b.y) / st.dist, 1, v.sMax);
        const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
        const px = (st.mx - st.tx) / st.s, py = (st.my - st.ty) / st.s; // board point under the start midpoint
        v.s = ns; v.tx = mx - px * ns; v.ty = my - py * ns;
        this.clampPan(); this.applyView(false);
      } else if (pts.length === 1 && G.moved && v.s > 1 && st.x !== undefined) {
        v.tx = st.tx + (pts[0].x - st.x); v.ty = st.ty + (pts[0].y - st.y);
        this.clampPan(); this.applyView(false);
      }
    });
    const end = e => {
      if (!G.pts.delete(e.pointerId)) return;
      if (G.pts.size) { this.gestureBase(); return; }
      if (v.zoomable && (G.moved || G.pinched)) this.snapView(true);
    };
    this.listen(vp, 'pointerup', end);
    this.listen(vp, 'pointercancel', end);
    let wheelSnap = 0;
    this.listen(vp, 'wheel', e => {
      if (!v.zoomable) return;
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      this.zoomAt(v.s * Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
      clearTimeout(wheelSnap);
      wheelSnap = setTimeout(() => this.snapView(true), 160);
    }, { passive: false });
    this.cleanups.push(() => clearTimeout(wheelSnap));

    // Taps: a short tap on a cell asks the game to play there; two quick taps elsewhere reset the zoom
    this.listen(this.area, 'click', e => {
      if (G.suppress) return;
      const cell = e.target.closest('.cell');
      if (cell && this.onCellTap(+cell.dataset.i)) { this.lastTap = null; return; }
      if (!v.zoomable) return;
      const now = performance.now(), lt = this.lastTap;
      if (lt && now - lt.t < 350 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 40) {
        this.lastTap = null;
        if (v.s > 1) this.resetView(true);
      } else {
        this.lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.layout());
      ro.observe(this.area);
      this.cleanups.push(() => ro.disconnect());
    } else {
      this.listen(window, 'resize', () => this.layout());
    }
    const onOrient = () => setTimeout(() => this.layout(), 200);
    this.listen(window, 'orientationchange', onOrient);
  }

  /** One-time "Pinch to zoom" hint for 9x9 and up. */
  showZoomHint(text = 'Pinch to zoom, double-tap to reset') {
    const hint = this.area.querySelector('.zoom-hint');
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add('show');
    const id = setTimeout(() => hint.classList.remove('show'), 3000);
    this.cleanups.push(() => clearTimeout(id));
  }

  destroy() {
    while (this.cleanups.length) this.cleanups.pop()();
  }
}
