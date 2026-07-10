import { useEffect, useRef, type RefObject } from "react";

/**
 * SpaceX-style thin irregular orbits + angled strokes.
 * Strong per-orbit mouse parallax for layered depth.
 */

type Orbit = {
  ox: number;
  oy: number;
  r: number;
  aspect: number;
  rot: number;
  opacity: number;
  spinSec: number;
  reverse?: boolean;
  phase: number;
  node: number;
  /** Far ≈ 0.15 … near ≈ 2.4 — wide gap = strong layer feel. */
  parallax: number;
};

type Slash = {
  x: number;
  y: number;
  angle: number;
  opacity: number;
  dashed?: boolean;
  parallax: number;
};

const ORBITS: Orbit[] = [
  { ox: 0.04, oy: -0.06, r: 0.78, aspect: 0.97, rot: -0.18, opacity: 0.24, spinSec: 52, phase: 0.4, node: 3, parallax: 0.18 },
  { ox: -0.08, oy: 0.04, r: 0.62, aspect: 1.04, rot: 0.28, opacity: 0.34, spinSec: 44, reverse: true, phase: 1.8, node: 0, parallax: 0.42 },
  { ox: 0.1, oy: 0.01, r: 0.52, aspect: 0.94, rot: -0.42, opacity: 0.44, spinSec: 36, phase: 2.5, node: 3.5, parallax: 0.95 },
  { ox: -0.04, oy: -0.09, r: 0.4, aspect: 1.08, rot: 0.55, opacity: 0.32, spinSec: 40, reverse: true, phase: 0.9, node: 0, parallax: 0.55 },
  { ox: 0.12, oy: 0.07, r: 0.33, aspect: 0.99, rot: -0.15, opacity: 0.5, spinSec: 30, phase: 3.2, node: 3, parallax: 1.45 },
  { ox: -0.11, oy: 0.02, r: 0.26, aspect: 1.06, rot: 0.12, opacity: 0.42, spinSec: 26, reverse: true, phase: 1.4, node: 3.5, parallax: 1.9 },
  { ox: 0.06, oy: -0.12, r: 0.18, aspect: 0.95, rot: -0.62, opacity: 0.38, spinSec: 34, phase: 2.1, node: 0, parallax: 1.15 },
  { ox: 0.14, oy: 0.1, r: 0.92, aspect: 0.93, rot: 0.2, opacity: 0.15, spinSec: 58, reverse: true, phase: 0.6, node: 2.5, parallax: 0.12 },
  { ox: -0.15, oy: -0.03, r: 0.14, aspect: 1.02, rot: 0.38, opacity: 0.46, spinSec: 22, phase: 4.1, node: 2.5, parallax: 2.35 }
];

const SLASHES: Slash[] = [
  { x: 0.42, y: 0.28, angle: -0.32, opacity: 0.16, parallax: 0.25 },
  { x: 0.55, y: 0.58, angle: 0.48, opacity: 0.12, dashed: true, parallax: 1.1 },
  { x: 0.38, y: 0.72, angle: -0.18, opacity: 0.1, parallax: 1.85 }
];

function readThemeInk(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--hero-ink").trim() || "#f4f4f0";
}

function parseCssColor(color: string): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return [244, 244, 240];
  g.fillStyle = color;
  g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return [d[0] ?? 244, d[1] ?? 244, d[2] ?? 240];
}

export function HeroOrbitsCanvas({ motionRoot }: { motionRoot: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = motionRoot.current;
    if (!canvas || !root) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let ink: [number, number, number] = [244, 244, 240];
    const t0 = performance.now();

    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const rgba = (a: number) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const refreshColors = () => {
      ink = parseCssColor(readThemeInk());
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
    };
    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const drawSlash = (px: number, py: number, angle: number, opacity: number, dashed?: boolean) => {
      const len = Math.hypot(w, h) * 1.35;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(px - cos * len, py - sin * len);
      ctx.lineTo(px + cos * len, py + sin * len);
      ctx.strokeStyle = rgba(opacity);
      ctx.lineWidth = 1;
      if (dashed) ctx.setLineDash([3, 11]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const frame = (now: number) => {
      if (!running) return;
      if (document.hidden) {
        raf = 0;
        return;
      }

      const t = (now - t0) / 1000;
      curX += (targetX - curX) * 0.07;
      curY += (targetY - curY) * 0.07;
      root.style.setProperty("--mx", curX.toFixed(4));
      root.style.setProperty("--my", curY.toFixed(4));

      ctx.clearRect(0, 0, w, h);

      const minDim = Math.min(w, h);
      const baseFx = w * 0.7;
      const baseFy = h * 0.38;
      // Wide pan unit so parallax gaps read clearly.
      const panUnitX = 48;
      const panUnitY = 36;

      for (const s of SLASHES) {
        const px = w * s.x + curX * panUnitX * s.parallax;
        const py = h * s.y + curY * panUnitY * s.parallax;
        drawSlash(px, py, s.angle, s.opacity, s.dashed);
      }

      for (const o of ORBITS) {
        const fx = baseFx + curX * panUnitX * o.parallax;
        const fy = baseFy + curY * panUnitY * o.parallax;
        const cx = fx + o.ox * minDim;
        const cy = fy + o.oy * minDim;
        const rx = o.r * minDim;
        const ry = rx * o.aspect;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(o.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(o.opacity);
        ctx.lineWidth = 1;
        ctx.stroke();

        if (o.node > 0) {
          const dir = o.reverse ? -1 : 1;
          const a = o.phase + dir * ((t / o.spinSec) * Math.PI * 2);
          const px = Math.cos(a) * rx;
          const py = Math.sin(a) * ry;
          ctx.beginPath();
          ctx.arc(px, py, o.node, 0, Math.PI * 2);
          ctx.fillStyle = rgba(0.9);
          ctx.fill();
        }
        ctx.restore();
      }

      raf = window.requestAnimationFrame(frame);
    };

    resize();
    refreshColors();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const mo = new MutationObserver(refreshColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const onVisibility = () => {
      if (document.hidden || !running) return;
      if (!raf) raf = window.requestAnimationFrame(frame);
    };

    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    raf = window.requestAnimationFrame(frame);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [motionRoot]);

  return <canvas ref={canvasRef} className="orbit-canvas" aria-hidden="true" />;
}
