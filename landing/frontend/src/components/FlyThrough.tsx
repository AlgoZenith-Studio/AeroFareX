import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PlaneModelCanvas } from './PlaneModelCanvas';

/**
 * Scroll-scrubbed transition between the hero and the next section.
 *
 * The section is taller than the screen; its inner "stage" sticks to the viewport
 * while you scroll through it. Scroll progress (0 -> 1) drives the scene:
 *   - scrolling down: a plane leaves a soft vapor trail while fare components
 *     combine into the total paid; the sky shifts to the next section's blue
 *   - scrolling up:   the exact reverse, frame for frame
 *
 * VIDEO MODE: drop a file at public/TRANSITION_VIDEO.mp4 and it is scrubbed
 * frame-by-frame by scroll (currentTime = progress x duration).
 * CSS MODE (fallback, no file): a built-in plane/clouds/sky scene driven by the
 * same progress value.
 *
 * Smoothness: progress is eased toward the scroll position every animation frame
 * (lerp), written to a CSS variable (--p) so React never re-renders mid-scroll.
 * Both ends fade to solid colours matching the neighbouring sections, so the
 * joins are seamless in either direction.
 */

const TRANSITION_SRC = '/TRANSITION_VIDEO.mp4';
// Seconds for progress to close ~63% of the gap to the scroll position.
// Touch scrolling is already smooth, so it follows the finger more tightly.
const SMOOTHING = 0.13;
const SMOOTHING_TOUCH = 0.06;
const ROUTE = {
  start: { x: -8, y: 102 },
  control1: { x: 19, y: 98 },
  control2: { x: 24, y: 39 },
  end: { x: 91, y: -12 },
};
const ENGINE_X = [34, 66] as const;
// Illustrative fare for the receipt (labelled "Example fare" on screen).
const FARE = [
  { key: 'base', label: 'Base fare', amount: 4200 },
  { key: 'tax', label: '+ Taxes & GST', amount: 780 },
  { key: 'fee', label: '+ Airline & airport fees', amount: 1150 },
] as const;
const FARE_TOTAL = FARE.reduce((sum, line) => sum + line.amount, 0);
const FARE_MARKUP = Math.round((FARE_TOTAL / FARE[0].amount - 1) * 100);
// Section-progress timeline per layout. Desktop: the ticket sits lower right,
// off the plane's path, so both play together. Mobile: the ticket spans the
// width, so the plane flies earlier and the ticket rises once its tail is clear.
const TIMELINE = {
  desktop: { route: [0.2, 0.9], wakeOut: [0.86, 1], receipt: 0.34 },
  mobile: { route: [0.12, 0.52], wakeOut: [0.55, 0.8], receipt: 0.4 },
} as const;
const MOBILE_MAX_WIDTH = 760;
// Receipt beats, as offsets from the timeline's receipt start.
const RECEIPT_RISE = 0.05;
const RECEIPT_ROW = 0.05;
const RECEIPT_TOTAL = [0.22, 0.26] as const;
const RECEIPT_HIGHLIGHT_SETTLE = [0.26, 0.32] as const;
// Held until the sky starts blending into the next section.
const RECEIPT_OUT = [0.82, 0.88] as const;
const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;
const ENGINE_Y = 56;
const ROUTE_SAMPLES = 160;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const bezierPoint = (
  t: number,
  start: { x: number; y: number },
  control1: { x: number; y: number },
  control2: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const inverse = 1 - t;
  const x = inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x
    + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x;
  const y = inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y
    + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y;
  const dx = 3 * inverse ** 2 * (control1.x - start.x)
    + 6 * inverse * t * (control2.x - control1.x)
    + 3 * t ** 2 * (end.x - control2.x);
  const dy = 3 * inverse ** 2 * (control1.y - start.y)
    + 6 * inverse * t * (control2.y - control1.y)
    + 3 * t ** 2 * (end.y - control2.y);
  return { x, y, dx, dy };
};

const routePoint = (t: number) => bezierPoint(
  clamp01(t), ROUTE.start, ROUTE.control1, ROUTE.control2, ROUTE.end,
);

const routeAngle = (point: ReturnType<typeof routePoint>, width: number, height: number) =>
  Math.atan2(point.dx * width, -point.dy * height);

const wakePoint = (t: number, engineX: number, width: number, height: number, planeWidth: number) => {
  const point = routePoint(t);
  const angle = routeAngle(point, width, height);
  const scale = 0.86 + t * 0.16;
  const localX = (engineX - 50) * planeWidth / 100;
  const localY = (ENGINE_Y - 50) * planeWidth * 1.2 / 100;
  return {
    x: point.x + (Math.cos(angle) * localX - Math.sin(angle) * localY) * scale * 100 / width,
    y: point.y + (Math.sin(angle) * localX + Math.cos(angle) * localY) * scale * 100 / height,
  };
};

const makeWakePath = (engineX: number, width: number, height: number, planeWidth: number) => {
  const points = Array.from({ length: ROUTE_SAMPLES + 1 }, (_, i) =>
    wakePoint(i / ROUTE_SAMPLES, engineX, width, height, planeWidth));
  const lengths = [0];
  for (let i = 1; i <= ROUTE_SAMPLES; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return {
    d: points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(' '),
    fractions: lengths.map((length) => length / lengths[ROUTE_SAMPLES]),
  };
};

const wakeArcFraction = (t: number, fractions: number[]): number => {
  if (!fractions.length) return 0;
  const position = clamp01(t) * ROUTE_SAMPLES;
  const index = Math.floor(position);
  if (index === ROUTE_SAMPLES) return 1;
  return fractions[index]
    + (fractions[index + 1] - fractions[index]) * (position - index);
};

type Mode = 'css' | 'video';

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
  { top: 48, left: 70, width: 26, opacity: 0.5, depth: 0.5 }, // far back: sits behind the ticket
  { top: 62, left: 22, width: 52, opacity: 0.8, depth: 0.58 },
  { top: 85, left: 55, width: 40, opacity: 0.72, depth: 0.5 },
  { top: 100, left: -10, width: 48, opacity: 0.75, depth: 0.72 },
  { top: 120, left: 40, width: 60, opacity: 0.8, depth: 0.88 },
  { top: -42, left: 116, width: 49, opacity: 0.82, depth: 0.72 },
  { top: -45, left: 125, width: 40, opacity: 0.76, depth: 0.98 },
];

export const FlyThrough: React.FC = () => {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wakeFractions = useRef<[number[], number[]]>([[], []]);
  const [mode, setMode] = useState<Mode>('css');
  const [wakePaths, setWakePaths] = useState<[string, string]>(['', '']);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    if (!section) return;
    const stage = section.querySelector<HTMLElement>('.fly-stage');
    const plane = section.querySelector<HTMLElement>('.fly-plane');
    if (!stage || !plane) return;
    const clouds = section.querySelectorAll<HTMLImageElement>('.fly-cloud');
    const totalValue = section.querySelector<HTMLElement>('.fr-total-value');
    let shownTotal = -1;

    let raf = 0;
    let running = false;
    let current = 0;
    let lastTime = 0;
    let stageWidth = 0;
    let stageHeight = 0;
    const smoothing = window.matchMedia('(pointer: coarse)').matches ? SMOOTHING_TOUCH : SMOOTHING;

    const updateWakeGeometry = () => {
      const rect = stage.getBoundingClientRect();
      const planeWidth = parseFloat(getComputedStyle(plane).width);
      if (!rect.width || !rect.height || !planeWidth) return;
      // Mobile browsers fire resize while the URL bar slides; the svh stage keeps
      // its size then, so skip the re-render mid-scroll.
      if (rect.width === stageWidth && rect.height === stageHeight) return;
      stageWidth = rect.width;
      stageHeight = rect.height;
      const left = makeWakePath(ENGINE_X[0], stageWidth, stageHeight, planeWidth);
      const right = makeWakePath(ENGINE_X[1], stageWidth, stageHeight, planeWidth);
      wakeFractions.current = [left.fractions, right.fractions];
      setWakePaths([left.d, right.d]);
    };
    updateWakeGeometry();
    window.addEventListener('resize', updateWakeGeometry);

    // Progress starts the moment the section's top enters the bottom of the
    // viewport (no dead scroll while it slides in) and ends when its bottom
    // reaches the bottom of the viewport, i.e. just as the stage un-pins.
    const targetProgress = (): number => {
      const r = section.getBoundingClientRect();
      const travel = r.height;
      const viewport = stageHeight || window.innerHeight;
      return travel > 0 ? Math.min(1, Math.max(0, (viewport - r.top) / travel)) : 0;
    };

    const tick = (time: number) => {
      const target = targetProgress();
      // Frame-rate independent easing: same feel at 60, 90 or 120 Hz, and no
      // stall when a phone drops frames.
      const dt = lastTime ? Math.min(0.1, (time - lastTime) / 1000) : 1 / 60;
      lastTime = time;
      current += (target - current) * (1 - Math.exp(-dt / smoothing));
      if (Math.abs(target - current) < 0.0005) current = target;
      section.style.setProperty('--p', current.toFixed(4));

      const timeline = stageWidth < MOBILE_MAX_WIDTH ? TIMELINE.mobile : TIMELINE.desktop;
      const [routeFrom, routeTo] = timeline.route;
      const routeProgress = clamp01((current - routeFrom) / (routeTo - routeFrom));
      const point = routePoint(routeProgress);
      const cloudX = ROUTE.start.x - point.x;
      const cloudY = ROUTE.start.y - point.y;
      clouds.forEach((cloud, index) => {
        const depth = CLOUDS[index].depth;
        cloud.style.transform = `translate3d(${(cloudX * depth).toFixed(2)}vw, ${(cloudY * depth).toFixed(2)}vh, 0)`;
      });
      const angle = routeAngle(point, stageWidth, stageHeight);
      section.style.setProperty('--plane-tx', `${(point.x * stageWidth / 100).toFixed(1)}px`);
      section.style.setProperty('--plane-ty', `${(point.y * stageHeight / 100).toFixed(1)}px`);
      section.style.setProperty('--plane-angle', `${(angle * 180 / Math.PI).toFixed(2)}deg`);
      section.style.setProperty('--plane-scale', (0.86 + routeProgress * 0.16).toFixed(3));
      section.style.setProperty('--plane-opacity', (
        smoothstep(routeFrom, routeFrom + 0.08, current) * (1 - smoothstep(0.84, 1, routeProgress))
      ).toFixed(3));
      section.style.setProperty('--route-progress-left', wakeArcFraction(routeProgress, wakeFractions.current[0]).toFixed(4));
      section.style.setProperty('--route-progress-right', wakeArcFraction(routeProgress, wakeFractions.current[1]).toFixed(4));
      section.style.setProperty('--route-opacity', (
        smoothstep(0.1, 0.23, routeProgress) * (1 - smoothstep(timeline.wakeOut[0], timeline.wakeOut[1], routeProgress))
      ).toFixed(3));

      // Receipt: lift in, print each row, then the total locks in with one brief
      // highlight and holds until the sky hands over to the next section.
      const start = timeline.receipt;
      section.style.setProperty('--receipt-in', (
        smoothstep(start, start + RECEIPT_RISE, current) * (1 - smoothstep(RECEIPT_OUT[0], RECEIPT_OUT[1], current))
      ).toFixed(3));
      // The total steps one charge at a time: only real subtotals, never in-between prices.
      let subtotal = 0;
      FARE.forEach((line, index) => {
        const from = start + RECEIPT_RISE + RECEIPT_ROW * index;
        const printed = smoothstep(from, from + RECEIPT_ROW, current);
        if (printed >= 0.5) subtotal += line.amount;
        section.style.setProperty(`--line-${line.key}`, printed.toFixed(3));
      });
      const done = smoothstep(start + RECEIPT_TOTAL[0], start + RECEIPT_TOTAL[1], current);
      const settle = smoothstep(start + RECEIPT_HIGHLIGHT_SETTLE[0], start + RECEIPT_HIGHLIGHT_SETTLE[1], current);
      section.style.setProperty('--total-done', done.toFixed(3));
      section.style.setProperty('--total-highlight', (done * (1 - settle * 0.7)).toFixed(3));
      if (totalValue && subtotal !== shownTotal) {
        shownTotal = subtotal;
        totalValue.textContent = rupees(subtotal);
      }

      const v = videoRef.current;
      if (v && v.readyState >= 1 && Number.isFinite(v.duration) && !v.seeking) {
        const t = current * Math.max(0, v.duration - 0.04);
        if (Math.abs(v.currentTime - t) > 1 / 90) v.currentTime = t;
      }
      raf = running ? requestAnimationFrame(tick) : 0;
    };

    // Only animate while the section is on (or near) screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running && !raf) {
          current = targetProgress(); // no catch-up jump when re-entering
          lastTime = 0;
          raf = requestAnimationFrame(tick);
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(section);

    return () => {
      running = false;
      window.removeEventListener('resize', updateWakeGeometry);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <section ref={sectionRef} className="fly" aria-hidden="true" data-mode={mode}>
      <div className="fly-stage">
        <div className="fly-sky" />

        <svg className="fly-route" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fly-vapor-fade" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="white" stopOpacity="0.18" />
              <stop offset="40%" stopColor="white" stopOpacity="0.85" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
            <filter id="fly-vapor-texture" x="-20%" y="-30%" width="140%" height="160%">
              <feTurbulence type="fractalNoise" baseFrequency="0.24 0.4" numOctaves="2" seed="7" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -0.25" result="grain" />
              <feComposite in="SourceGraphic" in2="grain" operator="in" result="broken" />
              <feDisplacementMap in="broken" in2="noise" scale="0.45" xChannelSelector="R" yChannelSelector="G" />
              <feGaussianBlur stdDeviation="0.5" />
            </filter>
          </defs>
          {wakePaths.map((path, index) => (
            <g key={ENGINE_X[index]} className={`fly-route-track fly-route-track--${index === 0 ? 'left' : 'right'}`}>
              <path className="fly-vapor-haze" d={path} pathLength="1" />
              <path className="fly-vapor-body" d={path} pathLength="1" />
            </g>
          ))}
        </svg>

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

        <div className="fly-clouds">
          {CLOUDS.map((cloud, index) => (
            <img
              key={index}
              className="fly-cloud"
              src="/hero-cloud-bank.webp"
              alt=""
              draggable={false}
              style={{
                top: `${cloud.top}vh`,
                left: `${cloud.left}%`,
                width: `${cloud.width}vmin`,
                opacity: cloud.opacity,
              }}
            />
          ))}
        </div>

        <div className="fly-plane">
          <PlaneModelCanvas />
        </div>

        <div className="fly-receipt">
          <div className="fr-card">
            <div className="fr-head">
              <span className="fr-route">DEL <span className="fr-route-line" /> BOM</span>
              <span className="fr-tag">Example fare</span>
            </div>
            <dl className="fr-lines">
              {FARE.map((line) => (
                <div key={line.key} className={`fr-line fr-line--${line.key}`}>
                  <dt>{line.label}</dt>
                  <dd className="num">{rupees(line.amount)}</dd>
                </div>
              ))}
            </dl>
            <div className="fr-total">
              <span>You actually pay</span>
              <strong className="fr-total-value num">{rupees(0)}</strong>
            </div>
            <p className="fr-note">+{FARE_MARKUP}% over the base fare</p>
          </div>
        </div>

        <div className="fly-fade fly-fade--in" />
        <div className="fly-fade fly-fade--out" />
      </div>
    </section>
  );
};
