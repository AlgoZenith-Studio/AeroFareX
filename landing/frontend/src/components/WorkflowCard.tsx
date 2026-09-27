import React, { memo, useEffect, useRef } from 'react';
import { Check, FileSpreadsheet, Database, Link2, ScanLine } from 'lucide-react';
import { FARE_BREAKDOWN, HEADLINE, ROUTES } from '../data/mockData';
import { paiseToINR } from '../lib/format';

/**
 * The AeroFareX pipeline in four beats, played inside the scroll transition:
 * Collect -> Unbundle -> Index -> Publish.
 *
 * FlyThrough owns the scroll maths. It passes the active `step` (a handful of
 * re-renders per pass) and scrubs the segment bars directly through
 * `data-wf-fill` elements, so nothing here re-renders while scrolling.
 * Everything inside animates with CSS transitions on transform/opacity only,
 * keyed off data-state, so the motion reverses cleanly when scrolling back up.
 */

export const WORKFLOW_STEPS = ['Collect', 'Unbundle', 'Index', 'Publish'] as const;

const fareBase = FARE_BREAKDOWN[0].paise;
const fareTotal = FARE_BREAKDOWN.reduce((sum, part) => sum + part.paise, 0);
const FEES = FARE_BREAKDOWN.slice(1);

// Deterministic 12-day series ending on today's headline values.
const FARE_SERIES = [100, 100.6, 99.8, 101.2, 100.9, 102.1, 101.6, 102.8, 103.1, 102.7, 103.6, HEADLINE.afi];
const PAID_SERIES = [100, 101.9, 102.4, 104.8, 105.6, 107.9, 108.4, 110.6, 112.2, 112.9, 114.9, HEADLINE.tctAfi];
const CHART = { w: 280, h: 84, min: 98, max: 125 };
const toPath = (series: number[]) => series
  .map((value, i) => {
    const x = (i / (series.length - 1)) * CHART.w;
    const y = CHART.h - ((value - CHART.min) / (CHART.max - CHART.min)) * CHART.h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  })
  .join(' ');
const FARE_PATH = toPath(FARE_SERIES);
const PAID_PATH = toPath(PAID_SERIES);
const PAID_AREA = `${PAID_PATH} L${CHART.w} ${CHART.h} L0 ${CHART.h} Z`;
const endTop = (series: number[]) =>
  100 - ((series[series.length - 1] - CHART.min) / (CHART.max - CHART.min)) * 100;
const PAID_TOP = endTop(PAID_SERIES);
const FARE_TOP = endTop(FARE_SERIES);

const ENDPOINT = 'GET /api/v1/public/index';

type PanelState = 'before' | 'active' | 'after';
const panelState = (index: number, step: number): PanelState =>
  index === step ? 'active' : index < step ? 'after' : 'before';

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Counts a number up when `active` turns on; writes textContent, never re-renders. */
const CountUp: React.FC<{
  from: number; to: number; active: boolean; format: (value: number) => string;
  delay?: number; duration?: number;
}> = ({ from, to, active, format, delay = 0, duration = 1100 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active) { el.textContent = format(from); return; }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, (now - start) / duration);
      el.textContent = format(from + (to - from) * easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, from, to, format, delay, duration]);
  return <span ref={ref} className="num">{format(from)}</span>;
};

const rupees = (paise: number) => paiseToINR(Math.round(paise / 100) * 100);
const points = (value: number) => value.toFixed(1);

export const WorkflowCard: React.FC<{ step: number }> = memo(({ step }) => {
  const shown = Math.max(0, step);
  return (
    <div className="wf" data-step={step}>
      <header className="wf-head">
        <span className="wf-kicker"><i className="wf-live" />How AeroFareX works</span>
        <span className="wf-count num">
          <span className="wf-count-roll">
            <span className="wf-count-col" style={{ transform: `translate3d(0, ${-shown * 25}%, 0)` }}>
              {WORKFLOW_STEPS.map((_, i) => <span key={i}>0{i + 1}</span>)}
            </span>
          </span>
          <span className="wf-count-total">/ 04</span>
        </span>
      </header>

      <ol className="wf-rail">
        {WORKFLOW_STEPS.map((label, i) => (
          <li key={label} className="wf-seg" data-state={panelState(i, step)}>
            <span className="wf-seg-track"><span className="wf-seg-fill" data-wf-fill={i} /></span>
            <span className="wf-seg-label">{label}</span>
          </li>
        ))}
      </ol>

      <div className="wf-stage">
        {/* 01 Collect */}
        <section className="wf-panel wf-collect" data-state={panelState(0, step)}>
          <h3 className="wf-title">We scan real fares</h3>
          <p className="wf-sub">4× a day · India’s 5 busiest routes · every major airline</p>
          <div className="wf-scan">
            <span className="wf-scanline" />
            {ROUTES.slice(0, 3).map((route, i) => (
              <div className="wf-row wf-in" key={route.id} style={{ '--i': i } as React.CSSProperties}>
                <span className="wf-route">{route.id.replace('-', ' → ')}</span>
                <span className="wf-time num">{String(6 + i * 6).padStart(2, '0')}:00</span>
                <span className="wf-price num">{paiseToINR(route.baseFarePaise)}</span>
                <span className="wf-tick"><Check size={12} strokeWidth={3} /></span>
              </div>
            ))}
          </div>
          <span className="wf-chip wf-in" style={{ '--i': 3 } as React.CSSProperties}>
            <ScanLine size={13} /> Trips tomorrow to a month out
          </span>
        </section>

        {/* 02 Unbundle */}
        <section className="wf-panel wf-unbundle" data-state={panelState(1, step)}>
          <h3 className="wf-title">We add back every fee</h3>
          <div className="wf-totals">
            <span className="wf-was wf-in">
              <small>Advertised</small>
              <s className="num">{paiseToINR(fareBase)}</s>
            </span>
            <span className="wf-arrow wf-in" style={{ '--i': 1 } as React.CSSProperties} />
            <span className="wf-now wf-in" style={{ '--i': 1 } as React.CSSProperties}>
              <small>At checkout</small>
              <strong><CountUp from={fareBase} to={fareTotal} active={step === 1} format={rupees} delay={250} /></strong>
            </span>
          </div>
          <div className="wf-fees">
            {FEES.map((fee, i) => (
              <span className="wf-fee wf-pop" key={fee.key} style={{ '--i': i + 2 } as React.CSSProperties}>
                <i className={`wf-dot wf-dot--${fee.seg}`} />
                {fee.label}
                <b className="num">+{paiseToINR(fee.paise)}</b>
              </span>
            ))}
          </div>
          <p className="wf-note wf-in" style={{ '--i': 6 } as React.CSSProperties}>
            <b className="num">{paiseToINR(fareTotal - fareBase)}</b> more than the price shown first
          </p>
        </section>

        {/* 03 Index */}
        <section className="wf-panel wf-index" data-state={panelState(2, step)}>
          <h3 className="wf-title">One honest daily number</h3>
          <div className="wf-stats">
            <span className="wf-stat wf-in">
              <small>Fare index</small>
              <strong><CountUp from={100} to={HEADLINE.afi} active={step === 2} format={points} delay={150} /></strong>
            </span>
            <span className="wf-stat wf-stat--hot wf-in" style={{ '--i': 1 } as React.CSSProperties}>
              <small>You-pay index</small>
              <strong><CountUp from={100} to={HEADLINE.tctAfi} active={step === 2} format={points} delay={250} /></strong>
            </span>
          </div>
          <div className="wf-chart">
            <div className="wf-wipe">
              <div className="wf-wipe-inner">
                <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="wf-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="wf-area" d={PAID_AREA} fill="url(#wf-area)" />
                  <path className="wf-line wf-line--fare" d={FARE_PATH} />
                  <path className="wf-line wf-line--paid" d={PAID_PATH} />
                </svg>
              </div>
            </div>
            <span
              className="wf-end wf-pop"
              style={{ '--i': 5, top: `${PAID_TOP}%` } as React.CSSProperties}
            />
            <span className="wf-bracket" style={{ top: `${PAID_TOP}%`, height: `${FARE_TOP - PAID_TOP}%` }} />
            <span
              className="wf-gap wf-pop"
              style={{ '--i': 5, top: `${(PAID_TOP + FARE_TOP) / 2}%` } as React.CSSProperties}
            >
              {HEADLINE.dripGap} hidden
            </span>
          </div>
        </section>

        {/* 04 Publish */}
        <section className="wf-panel wf-publish" data-state={panelState(3, step)}>
          <h3 className="wf-title">Live by 7 PM, open to all</h3>
          <div className="wf-release wf-in">
            <span className="wf-pulse" />
            <span>
              <b>Published</b>
              <small>{HEADLINE.asOf} · 7:00 PM IST</small>
            </span>
            <span className="wf-stamp wf-pop" style={{ '--i': 2 } as React.CSSProperties}>
              <Check size={14} strokeWidth={3} />
            </span>
          </div>
          <div className="wf-formats">
            {[
              { icon: FileSpreadsheet, label: 'CSV' },
              { icon: Database, label: 'SDMX' },
              { icon: Link2, label: 'Traceable' },
            ].map(({ icon: Icon, label }, i) => (
              <span className="wf-fee wf-pop" key={label} style={{ '--i': i + 3 } as React.CSSProperties}>
                <Icon size={13} /> {label}
              </span>
            ))}
          </div>
          <code className="wf-code wf-in" style={{ '--i': 6, '--chars': ENDPOINT.length } as React.CSSProperties}>
            <span className="wf-type">{ENDPOINT}</span><i className="wf-caret" />
          </code>
        </section>
      </div>
    </div>
  );
});
WorkflowCard.displayName = 'WorkflowCard';
