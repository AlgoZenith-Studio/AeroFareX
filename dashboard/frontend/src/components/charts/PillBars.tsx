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

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="overflow-visible text-sky-600">
          <defs>
            <HatchDef id={hatchId} color="color-mix(in srgb, var(--sky-600) 70%, transparent)" background="var(--surface)" />
          </defs>
          {bars.map((b, i) => {
            const bx = x(b.key) ?? 0;
            const by = y(b.value);
            const h = height - bottom - by;
            const isSel = i === selected;
            const fill = b.hatched ? `url(#${hatchId})` : isSel ? 'var(--sky-600)' : i >= bars.length - 3 ? 'var(--sky-500)' : 'var(--sky-400)';
            return (
              <g key={b.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                {/* hit target larger than the mark */}
                <rect x={bx - x.step() * 0.14} y={top - 24} width={x.step()} height={height - top + 24} fill="transparent" />
                <rect
                  x={bx} y={by} width={bw} height={Math.max(bw, h)} rx={bw / 2}
                  fill={fill}
                  stroke={b.hatched ? 'color-mix(in srgb, var(--sky-600) 45%, transparent)' : 'none'}
                  strokeWidth={b.hatched ? 1 : 0}
                />
                <text x={bx + bw / 2} y={height - 5} textAnchor="middle" className={isSel ? 'fill-text-1 text-[11px] font-medium' : 'fill-text-3 text-[11px]'}>
                  {b.label}
                </text>
                {isSel && (
                  <g pointerEvents="none">
                    <rect x={bx + bw / 2 - 30} y={by - 26} width={60} height={20} rx={10} fill="var(--surface)" stroke="var(--line-sky)" />
                    <text x={bx + bw / 2} y={by - 16} dy="0.32em" textAnchor="middle" className="num fill-text-1 text-[11px] font-medium">
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
        <div className="pointer-events-none absolute left-0 top-0 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs shadow-e2">
          <span className="font-medium">{bars[hover].title}</span>
          <span className="ml-2 text-text-3">{bars[hover].hatched ? 'Simulated' : 'Real'}</span>
        </div>
      )}
    </div>
  );
};
