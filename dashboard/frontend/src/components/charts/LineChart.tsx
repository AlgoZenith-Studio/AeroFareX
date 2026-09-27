'use client';

import React, { useId, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { shortDate } from '@/lib/format';
import { useWidth } from './useSize';
import { HatchDef } from './Hatch';

export interface LineSeries {
  key: string;
  label: string;
  color: string; // a CSS var from tokens, e.g. var(--slot-1)
  points: { date: string; value: number }[];
}

const M = { top: 14, right: 96, bottom: 28, left: 40 };

/**
 * Multi-series line chart on ONE shared y-axis (rule 1: never dual-axis).
 * Direct labels at line ends + legend (identity never colour-only), faint grid,
 * crosshair tooltip, and a hatched SIMULATED span with an explicit provenance
 * boundary rule (rule 6).
 */
export const LineChart: React.FC<{
  series: LineSeries[];
  height?: number;
  provenanceBoundary?: string | null;
  format?: (v: number) => string;
  ariaLabel: string;
}> = ({ series, height = 260, provenanceBoundary, format = (v) => v.toFixed(1), ariaLabel }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hatchId = useId().replace(/:/g, '');

  const dates = series[0]?.points.map((p) => p.date) ?? [];
  const { x, y, yTicks } = useMemo(() => {
    const values = series.flatMap((s) => s.points.map((p) => p.value));
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.12 || 1;
    const yScale = scaleLinear().domain([lo - pad, hi + pad]).nice(5).range([height - M.bottom, M.top]);
    const xScale = scaleLinear().domain([0, Math.max(1, dates.length - 1)]).range([M.left, Math.max(M.left + 10, width - M.right)]);
    return { x: xScale, y: yScale, yTicks: yScale.ticks(5) };
  }, [series, width, height, dates.length]);

  if (!series.length || !dates.length) return null;

  const boundaryIdx = provenanceBoundary ? dates.indexOf(provenanceBoundary) : -1;
  const xTickEvery = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor(width / 90))));
  const path = d3line<{ date: string; value: number }>().x((_, i) => x(i)).y((p) => y(p.value));

  // Direct labels at the right, nudged apart so they never collide.
  const ends = series
    .map((s) => ({ s, y: y(s.points[s.points.length - 1].value) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const idx = Math.round(x.invert(e.clientX - box.left + M.left));
    setHover(Math.min(dates.length - 1, Math.max(0, idx)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="overflow-visible">
          <defs>
            <HatchDef id={hatchId} color="color-mix(in srgb, var(--sky-600) 16%, transparent)" />
          </defs>

          {/* SIMULATED span + provenance boundary */}
          {boundaryIdx > 0 && (
            <g>
              <rect x={M.left} y={M.top} width={x(boundaryIdx) - M.left} height={height - M.top - M.bottom} fill={`url(#${hatchId})`} />
              <line x1={x(boundaryIdx)} x2={x(boundaryIdx)} y1={M.top - 6} y2={height - M.bottom} stroke="var(--text-3)" strokeDasharray="3 3" />
              <text x={x(boundaryIdx) - 6} y={M.top + 4} textAnchor="end" className="fill-text-3 text-[11px]">Simulated</text>
              <text x={x(boundaryIdx) + 6} y={M.top + 4} className="fill-text-3 text-[11px]">Real</text>
            </g>
          )}

          {/* recessive grid + axes */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-text-3 text-[11px]">{t}</text>
            </g>
          ))}
          {dates.map((d, i) => ((i % xTickEvery === 0 && dates.length - 1 - i >= xTickEvery * 0.6) || i === dates.length - 1) && (
            <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="fill-text-3 text-[11px]">{shortDate(d)}</text>
          ))}

          {series.map((s) => (
            <path key={s.key} d={path(s.points) ?? ''} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* end markers + direct labels (text in ink, colour only on the mark) */}
          {ends.map(({ s, y: ly }) => {
            const last = s.points[s.points.length - 1];
            return (
              <g key={s.key}>
                <circle cx={x(dates.length - 1)} cy={y(last.value)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                <rect x={x(dates.length - 1) + 10} y={ly - 4} width={8} height={8} rx={2} fill={s.color} />
                <text x={x(dates.length - 1) + 22} y={ly} dy="0.32em" className="fill-text-1 text-[12px] font-medium">
                  {s.label} <tspan className="num fill-text-2 font-normal">{format(last.value)}</tspan>
                </text>
              </g>
            );
          })}

          {/* crosshair */}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={height - M.bottom} stroke="var(--axis)" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.points[hover].value)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={M.left} y={M.top} width={Math.max(0, width - M.left - M.right)} height={height - M.top - M.bottom}
            fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}

      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-40 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-e2"
          style={{ left: Math.min(x(hover) + 12, width - 170), top: 8 }}
        >
          <p className="font-medium">
            {shortDate(dates[hover])}
            {boundaryIdx > 0 && <span className="ml-1.5 font-normal text-text-3">{hover < boundaryIdx ? 'Simulated' : 'Real'}</span>}
          </p>
          {series.map((s) => (
            <p key={s.key} className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-text-2">
                <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />{s.label}
              </span>
              <span className="num font-medium">{format(s.points[hover].value)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
