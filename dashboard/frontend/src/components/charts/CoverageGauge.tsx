'use client';

import React, { useId } from 'react';
import { arc as d3arc } from 'd3-shape';
import { HatchDef } from './Hatch';

export interface GaugePart { key: string; label: string; value: number; tone: 'solid' | 'mid' | 'hatched' }

/**
 * Half-donut part-to-whole of today's expected observations: observed, imputed,
 * missing/excluded (hatched). 2px surface gaps between segments.
 */
export const CoverageGauge: React.FC<{ parts: GaugePart[]; centerValue: string; centerLabel: string }> = ({
  parts, centerValue, centerLabel,
}) => {
  const hatchId = useId().replace(/:/g, '');
  const w = 240;
  const h = 132;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const arc = d3arc<{ start: number; end: number }>()
    .innerRadius(74).outerRadius(112).cornerRadius(10).padAngle(0.03)
    .startAngle((d) => d.start).endAngle((d) => d.end);

  let angle = -Math.PI / 2;
  const segs = parts.map((p) => {
    const start = angle;
    angle += (p.value / total) * Math.PI;
    return { ...p, start, end: angle };
  });
  const fill = (tone: GaugePart['tone']) =>
    tone === 'solid' ? 'var(--sky-500)' : tone === 'mid' ? 'var(--sky-300)' : `url(#${hatchId})`;

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[280px]" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <defs><HatchDef id={hatchId} color="color-mix(in srgb, var(--sky-600) 60%, transparent)" background="var(--surface)" /></defs>
        <g transform={`translate(${w / 2}, ${h - 8})`}>
          {segs.filter((s) => s.value > 0).map((s) => (
            <path
              key={s.key}
              d={arc(s) ?? ''}
              fill={fill(s.tone)}
              stroke={s.tone === 'hatched' ? 'color-mix(in srgb, var(--sky-600) 40%, transparent)' : 'none'}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </path>
          ))}
          <text y={-26} textAnchor="middle" className="num font-bold fill-text-1 text-[32px]">{centerValue}</text>
          <text y={-6} textAnchor="middle" className="fill-text-3 text-[11px]">{centerLabel}</text>
        </g>
      </svg>
      <figcaption className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-2">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span
              className={p.tone === 'hatched' ? 'hatch size-3 rounded-full border border-sky-600/40 text-sky-600' : 'size-3 rounded-full'}
              style={p.tone === 'hatched' ? undefined : { background: fill(p.tone) }}
              aria-hidden
            />
            {p.label} <span className="num text-text-3">{p.value}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
};
