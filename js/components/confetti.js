/**
 * Short confetti burst on a canvas (skipped with reduced motion).
 */
import { $, reduceMotion } from '../utils/dom.js';

let parts = [], raf = 0, end = 0, cv = null, ctx = null;

export function fireConfetti() {
  if (reduceMotion()) return;
  cv = cv || $('#confetti');
  ctx = ctx || cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#22d3ee', '#f472b6', '#fbbf24', '#7c5cff', '#34d399', '#ff8b7b'];
  parts = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.38,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 10 - 4,
    w: 6 + Math.random() * 5, h: 4 + Math.random() * 4,
    rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  end = performance.now() + 1500;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

function tick(t) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalAlpha = Math.max(0, Math.min(1, (end - t) / 400));
  for (const p of parts) {
    p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  if (t < end) raf = requestAnimationFrame(tick);
  else ctx.clearRect(0, 0, innerWidth, innerHeight);
}
