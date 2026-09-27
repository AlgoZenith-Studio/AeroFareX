import React, { memo, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PlaneModelCanvas } from './PlaneModelCanvas';
import { WorkflowCard, WORKFLOW_STEPS } from './WorkflowCard';

/**
 * Scroll-scrubbed transition between the hero and the manifesto.
 *
 * The section is three screens tall and its stage sticks to the viewport:
 *   screen 0 -> 1  the stage slides in over the hero
 *   screen 1 -> 2  pinned and fully visible: the workflow card plays
 *                  Collect -> Unbundle -> Index -> Publish
 *   screen 2 -> 3  the manifesto slides up over it (margin-bottom: -100vh)
 * A plane flies bottom-left to top-right across the whole run, leaving a
 * contrail, while clouds drift the opposite way. Scrolling up is the exact reverse.
 *
 * VIDEO MODE: drop a file at public/TRANSITION_VIDEO.mp4 and it is scrubbed
 * frame-by-frame by scroll; the workflow card stays on top of it.
 *
 * Performance: one rAF loop, running only while the section is near the
 * viewport and only writing when the scroll position actually moved. Every
 * per-frame write is a transform or opacity set directly on the element that
 * needs it (no inherited custom properties, no layout, no filters). The
 * contrail is drawn on canvas; its soft haze comes from a quarter-resolution
 * canvas upscaled by the compositor, instead of a live blur filter.
 */

const TRANSITION_SRC = '/TRANSITION_VIDEO.mp4';
/** Per-second damping toward the scroll position. Lenis already smooths the
 *  wheel; this only rounds off scrollbar drags and keyboard jumps. */
const DAMPING = 22;
const HAZE_SCALE = 0.25;
const MAX_DPR = 1.5;

// All timings are in screens scrolled since the section's top entered the viewport.
const T = {
  fadeInEnd: 0.35,
  route: [0.55, 2.5],
  planeIn: [0.55, 0.75], planeOut: [2.3, 2.6],
  trailIn: [0.65, 0.9], trailOut: [2.35, 2.75],
  cardIn: [0.5, 0.85],
  flow: [0.9, 2.05],
  fadeOut: [2.35, 2.85],
} as const;

// Kept to the right of the workflow card on wide screens.
const ROUTE = {
  start: { x: 36, y: 110 },
  control1: { x: 50, y: 96 },
  control2: { x: 52, y: 44 },
  end: { x: 97, y: -14 },
};
const ENGINE_X = [34, 66] as const;
const ENGINE_Y = 56;
const ROUTE_SAMPLES = 160;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smoothstep = ([from, to]: readonly [number, number], value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const range = ([from, to]: readonly [number, number], value: number) => clamp01((value - from) / (to - from));

type Point = { x: number; y: number };
const routePoint = (t: number) => {
  const { start: a, control1: b, control2: c, end: d } = ROUTE;
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
    dx: 3 * u ** 2 * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t ** 2 * (d.x - c.x),
    dy: 3 * u ** 2 * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t ** 2 * (d.y - c.y),
  };
};
const routeAngle = (point: ReturnType<typeof routePoint>, width: number, height: number) =>
  Math.atan2(point.dx * width, -point.dy * height);
const planeScale = (t: number) => 0.86 + t * 0.16;

/** Engine exhaust positions along the whole route, in stage pixels. */
const makeWake = (engineX: number, width: number, height: number, planeWidth: number): Point[] =>
  Array.from({ length: ROUTE_SAMPLES + 1 }, (_, i) => {
    const t = i / ROUTE_SAMPLES;
    const point = routePoint(t);
    const angle = routeAngle(point, width, height);
    const localX = ((engineX - 50) * planeWidth) / 100;
    const localY = ((ENGINE_Y - 50) * planeWidth * 1.2) / 100;
    const scale = planeScale(t);
    return {
      x: (point.x * width) / 100 + (Math.cos(angle) * localX - Math.sin(angle) * localY) * scale,
      y: (point.y * height) / 100 + (Math.sin(angle) * localX + Math.cos(angle) * localY) * scale,
    };
  });

interface Cloud {
  top: number; // vh
  left: number; // %
  width: number; // vmin
  opacity: number;
  depth: number; // fraction of the plane's opposite movement
}

// Deterministic layout (no randomness at render time)
const CLOUDS: Cloud[] = [
  { top: -20, left: 53, width: 38, opacity: 0.82, depth: 0.45 },
  { top: 5, left: 62, width: 46, opacity: 0.78, depth: 0.68 },
  { top: 30, left: -6, width: 30, opacity: 0.65, depth: 0.32 },
  { top: 48, left: 70, width: 34, opacity: 0.78, depth: 0.8 },
  { top: 62, left: 22, width: 52, opacity: 0.8, depth: 0.58 },
  { top: 85, left: 55, width: 40, opacity: 0.72, depth: 0.5 },
  { top: 100, left: -10, width: 48, opacity: 0.75, depth: 0.72 },
  { top: 120, left: 40, width: 60, opacity: 0.8, depth: 0.88 },
  { top: -42, left: 116, width: 49, opacity: 0.82, depth: 0.72 },
  { top: -45, left: 125, width: 40, opacity: 0.76, depth: 0.98 },
];

/** Static layers; memoised so step changes don't touch them. */
const Scenery = memo(() => (
  <>
    <div className="fly-clouds">
      {CLOUDS.map((cloud, index) => (
        <img
          key={index}
          className="fly-cloud"
          src="/hero-cloud-bank.webp"
          alt=""
          decoding="async"
          draggable={false}
          style={{ top: `${cloud.top}vh`, left: `${cloud.left}%`, width: `${cloud.width}vmin`, opacity: cloud.opacity }}
        />
      ))}
    </div>
    <div className="fly-plane">
      <PlaneModelCanvas />
    </div>
  </>
));
Scenery.displayName = 'Scenery';

type Mode = 'css' | 'video';

export const FlyThrough: React.FC = () => {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>('css');
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const q = <T extends Element>(selector: string) => section?.querySelector<T>(selector) ?? null;
    const stage = q<HTMLElement>('.fly-stage');
    const plane = q<HTMLElement>('.fly-plane');
    const card = q<HTMLElement>('.wf');
    const fadeIn = q<HTMLElement>('.fly-fade--in');
    const fadeOut = q<HTMLElement>('.fly-fade--out');
    const trail = q<HTMLCanvasElement>('.fly-trail');
    const haze = q<HTMLCanvasElement>('.fly-haze');
    if (!section || !stage || !plane || !card || !fadeIn || !fadeOut || !trail || !haze) return;
    const trailCtx = trail.getContext('2d');
    const hazeCtx = haze.getContext('2d');
    if (!trailCtx || !hazeCtx) return;
    const clouds = Array.from(section.querySelectorAll<HTMLElement>('.fly-cloud'));
    const fills = Array.from(section.querySelectorAll<HTMLElement>('[data-wf-fill]'));

    let width = 0;
    let height = 0;
    let screens = 3;
    let wakes: [Point[], Point[]] = [[], []];
    let tint = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;

    const measure = () => {
      width = stage.clientWidth;
      height = stage.clientHeight;
      screens = section.offsetHeight / (stage.clientHeight || window.innerHeight) || 3;
      const planeWidth = plane.offsetWidth;
      if (!width || !height || !planeWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      trail.width = Math.round(width * dpr);
      trail.height = Math.round(height * dpr);
      trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      haze.width = Math.round(width * HAZE_SCALE);
      haze.height = Math.round(height * HAZE_SCALE);
      hazeCtx.setTransform(HAZE_SCALE, 0, 0, HAZE_SCALE, 0, 0);
      wakes = [makeWake(ENGINE_X[0], width, height, planeWidth), makeWake(ENGINE_X[1], width, height, planeWidth)];
      // Trail colour comes from the stylesheet (color: var(--white)), not a literal.
      const rgb = getComputedStyle(trail).color.match(/\d+(\.\d+)?/g)?.slice(0, 3).join(', ');
      if (rgb) tint = (alpha: number) => `rgba(${rgb}, ${alpha})`;
    };

    const drawTrail = (t: number) => {
      trailCtx.clearRect(0, 0, width, height);
      hazeCtx.clearRect(0, 0, width, height);
      if (t <= 0 || !wakes[0].length) return;
      const position = t * ROUTE_SAMPLES;
      const last = Math.floor(position);
      const frac = position - last;
      wakes.forEach((points) => {
        const path = new Path2D();
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= last; i++) path.lineTo(points[i].x, points[i].y);
        const next = points[Math.min(last + 1, ROUTE_SAMPLES)];
        const head = {
          x: points[last].x + (next.x - points[last].x) * frac,
          y: points[last].y + (next.y - points[last].y) * frac,
        };
        path.lineTo(head.x, head.y);
        // Faint at the old end, strongest just behind the engines, with the small
        // clear gap real contrails have before the vapour condenses.
        const vapour = (ctx: CanvasRenderingContext2D) => {
          const gradient = ctx.createLinearGradient(points[0].x, points[0].y, head.x, head.y);
          gradient.addColorStop(0, tint(0.12));
          gradient.addColorStop(0.55, tint(0.7));
          gradient.addColorStop(0.95, tint(1));
          gradient.addColorStop(1, tint(0));
          return gradient;
        };
        trailCtx.strokeStyle = vapour(trailCtx);
        hazeCtx.strokeStyle = vapour(hazeCtx);
        trailCtx.globalAlpha = 0.22;
        trailCtx.lineWidth = 7;
        trailCtx.stroke(path);
        trailCtx.globalAlpha = 0.7;
        trailCtx.lineWidth = 2.2;
        trailCtx.stroke(path);
        hazeCtx.globalAlpha = 0.34;
        hazeCtx.lineWidth = 30;
        hazeCtx.stroke(path);
      });
    };

    // Fully transparent layers are hidden so the compositor drops their tiles.
    const setOpacity = (el: HTMLElement, value: number) => {
      el.style.opacity = value.toFixed(3);
      el.style.visibility = value > 0 ? 'visible' : 'hidden';
    };

    let lastStep = -2;
    let lastWritten = -1;
    const render = (s: number) => {
      const p = s / screens;
      setOpacity(fadeIn, clamp01(1 - s / T.fadeInEnd));
      setOpacity(fadeOut, smoothstep(T.fadeOut, s));

      const routeT = range(T.route, s);
      const point = routePoint(routeT);
      const cloudX = ROUTE.start.x - point.x;
      const cloudY = ROUTE.start.y - point.y;
      clouds.forEach((cloud, index) => {
        const depth = CLOUDS[index].depth;
        cloud.style.transform = `translate3d(${(cloudX * depth).toFixed(2)}vw, ${(cloudY * depth).toFixed(2)}vh, 0)`;
      });

      const angle = (routeAngle(point, width, height) * 180) / Math.PI;
      plane.style.transform = `translate3d(${((point.x * width) / 100).toFixed(1)}px, ${((point.y * height) / 100).toFixed(1)}px, 0) `
        + `translate(-50%, -50%) rotate(${angle.toFixed(2)}deg) scale(${planeScale(routeT).toFixed(3)})`;
      setOpacity(plane, smoothstep(T.planeIn, s) * (1 - smoothstep(T.planeOut, s)));

      const trailOpacity = smoothstep(T.trailIn, s) * (1 - smoothstep(T.trailOut, s));
      setOpacity(trail, trailOpacity);
      setOpacity(haze, trailOpacity);
      if (trailOpacity > 0) drawTrail(routeT);

      const cardIn = smoothstep(T.cardIn, s);
      setOpacity(card, cardIn);
      card.style.transform = `translate3d(0, ${((1 - cardIn) * 56).toFixed(1)}px, 0) scale(${(0.94 + cardIn * 0.06).toFixed(4)})`;

      const flow = range(T.flow, s) * WORKFLOW_STEPS.length;
      fills.forEach((fill, i) => { fill.style.transform = `scaleX(${clamp01(flow - i).toFixed(4)})`; });
      const nextStep = s < T.flow[0] ? -1 : Math.min(WORKFLOW_STEPS.length - 1, Math.floor(flow));
      if (nextStep !== lastStep) { lastStep = nextStep; setStep(nextStep); }

      const v = videoRef.current;
      if (v && v.readyState >= 1 && Number.isFinite(v.duration) && !v.seeking) {
        const time = p * Math.max(0, v.duration - 0.04);
        if (Math.abs(v.currentTime - time) > 1 / 90) v.currentTime = time;
      }
    };

    const targetScreens = (): number => {
      // One "screen" = the stage height (100svh), which doesn't change while the
      // mobile URL bar slides in and out, so progress never jumps mid-scroll.
      const unit = stage.clientHeight || window.innerHeight;
      const top = section.getBoundingClientRect().top;
      return Math.min(screens, Math.max(0, (unit - top) / unit));
    };

    let raf = 0;
    let running = false;
    let current = 0;
    let lastTime = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000 || 0.016);
      lastTime = now;
      const target = targetScreens();
      current += (target - current) * (1 - Math.exp(-DAMPING * dt));
      if (Math.abs(target - current) < 0.0008) current = target;
      if (current !== lastWritten) {
        lastWritten = current;
        render(current);
      }
      raf = running ? requestAnimationFrame(tick) : 0;
    };

    const onResize = () => { measure(); lastWritten = -1; };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(stage);
    measure();

    // Only animate while the section is on (or near) screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running && !raf) {
          current = targetScreens(); // no catch-up sweep when re-entering
          lastWritten = -1;
          lastTime = performance.now();
          raf = requestAnimationFrame(tick);
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(section);

    return () => {
      running = false;
      resizeObserver.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <section ref={sectionRef} className="fly" aria-hidden="true" data-mode={mode}>
      <div className="fly-stage">
        <div className="fly-sky" />
        <canvas className="fly-haze" />
        <canvas className="fly-trail" />

        <video
          ref={videoRef}
          className="fly-video"
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={() => setMode('video')}
          onError={() => setMode('css')}
        >
          <source src={TRANSITION_SRC} type="video/mp4" onError={() => setMode('css')} />
        </video>

        <Scenery />

        <div className="fly-card">
          <WorkflowCard step={step} />
        </div>

        <div className="fly-fade fly-fade--in" />
        <div className="fly-fade fly-fade--out" />
      </div>
    </section>
  );
};
