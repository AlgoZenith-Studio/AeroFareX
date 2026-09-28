'use client';

import React, { useId, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { useWidth } from './useSize';
import { HatchDef } from './Hatch';

export interface PillBar {
  key: string;
  label: string; // axis label under the bar
  title: string; // tooltip heading
  value: number;
  hatched?: boolean; // SIMULATED (rule 6)
}

/**
 * Zero-based pill bars (the reference layout's "analytics" chart). Solid = real,
 * hatched = simulated; the selected bar is the deepest tone and carries its
 * value chip. Magnitude only, so bars always start at zero.
 */
export const PillBars: React.FC<{
  bars: PillBar[];
  height?: number;
  format: (v: number) => string;
  ariaLabel: string;
}> = ({ bars, height = 200, format, ariaLabel }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hatchId = useId().replace(/:/g, '');
  const selected = hover ?? bars.length - 1;
  const bottom = 22;
  const top = 30;

  const x = scaleBand<string>().domain(bars.map((b) => b.key)).range([0, width]).paddingInner(0.28).paddingOuter(0.05);
  const y = scaleLinear().domain([0, Math.max(...bars.map((b) => b.value)) * 1.05]).range([height - bottom, top]);
  const bw = x.bandwidth();
  const barW = Math.min(44, Math.max(16, bw));

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="overflow-hidden text-sky-600">
          <defs>
            <HatchDef id={hatchId} color="color-mix(in srgb, var(--sky-600) 70%, transparent)" background="var(--surface)" />
          </defs>
          {bars.map((b, i) => {
            const rawBx = x(b.key) ?? 0;
            const bx = rawBx + (bw - barW) / 2;
            const by = y(b.value);
            const rawH = height - bottom - by;
            const h = Math.max(12, Math.min(height - top - bottom, rawH));
            const isSel = i === selected;
            const fill = b.hatched ? `url(#${hatchId})` : isSel ? 'var(--sky-600)' : i >= bars.length - 3 ? 'var(--sky-500)' : 'var(--sky-400)';
            return (
              <g key={b.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                {/* hit target larger than the mark */}
                <rect x={rawBx} y={top - 10} width={bw} height={height - top + 10} fill="transparent" />
                <rect
                  x={bx} y={by} width={barW} height={h} rx={barW / 2}
                  fill={fill}
                  stroke={b.hatched ? 'color-mix(in srgb, var(--sky-600) 45%, transparent)' : 'none'}
                  strokeWidth={b.hatched ? 1 : 0}
                />
                <text x={rawBx + bw / 2} y={height - 5} textAnchor="middle" className={isSel ? 'fill-text-1 text-[11px] font-medium' : 'fill-text-3 text-[11px]'}>
                  {b.label}
                </text>
                {isSel && (
                  <g pointerEvents="none">
                    <rect x={rawBx + bw / 2 - 32} y={Math.max(2, by - 26)} width={64} height={20} rx={10} fill="var(--surface)" stroke="var(--line-sky)" />
                    <text x={rawBx + bw / 2} y={Math.max(12, by - 16)} dy="0.32em" textAnchor="middle" className="num fill-text-1 text-[11px] font-bold">
                      {format(b.value)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div className="pointer-events-none absolute left-0 top-0 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs shadow-e2 z-10">
          <span className="font-medium">{bars[hover].title}</span>
          <span className="ml-2 text-text-3">{bars[hover].hatched ? 'Simulated' : 'Real'}</span>
        </div>
      )}
    </div>
  );
};
