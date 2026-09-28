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
  const bottom = 54;
  const top = 30;
  const baselineY = height - bottom;

  const x = scaleBand<string>().domain(bars.map((b) => b.key)).range([0, width]).paddingInner(0.25).paddingOuter(0.05);
  const y = scaleLinear().domain([0, Math.max(...bars.map((b) => b.value)) * 1.05 || 1]).range([baselineY, top]);
  const bw = x.bandwidth();
  const barW = Math.min(44, Math.max(14, bw));

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
            const computedY = y(b.value);
            const rawH = baselineY - computedY;
            // Minimum height 10px so small/zero value circles are always visible
            const h = Math.max(10, Math.min(baselineY - top, rawH));
            const by = baselineY - h;
            const rx = Math.min(barW / 2, h / 2);
            const isSel = i === selected;
            const fill = b.hatched ? `url(#${hatchId})` : isSel ? 'var(--sky-600)' : i >= bars.length - 3 ? 'var(--sky-500)' : 'var(--sky-400)';

            return (
              <g key={b.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                {/* Hit target */}
                <rect x={rawBx} y={top - 10} width={bw} height={height - top + 10} fill="transparent" />

                {/* Pill / Circle mark (always visible above baseline) */}
                <rect
                  x={bx} y={by} width={barW} height={h} rx={rx}
                  fill={fill}
                  stroke={b.hatched ? 'color-mix(in srgb, var(--sky-600) 60%, transparent)' : 'none'}
                  strokeWidth={b.hatched ? 1.5 : 0}
                />

                {/* Label text placed comfortably below baselineY */}
                <text
                  x={rawBx + bw / 2}
                  y={baselineY + 18}
                  textAnchor="middle"
                  className={isSel ? 'fill-text-1 text-[11px] font-bold' : 'fill-text-3 text-[11px] font-medium'}
                >
                  {b.label.length > 20 ? (
                    <>
                      <tspan x={rawBx + bw / 2} dy="0">
                        {b.label.slice(0, Math.ceil(b.label.length / 2))}
                      </tspan>
                      <tspan x={rawBx + bw / 2} dy="1.2em">
                        {b.label.slice(Math.ceil(b.label.length / 2))}
                      </tspan>
                    </>
                  ) : (
                    b.label
                  )}
                </text>

                {/* Value chip above selected bar */}
                {isSel && (
                  <g pointerEvents="none">
                    <rect
                      x={rawBx + bw / 2 - 34}
                      y={Math.max(2, by - 26)}
                      width={68}
                      height={20}
                      rx={10}
                      fill="var(--surface)"
                      stroke="var(--line-sky)"
                    />
                    <text
                      x={rawBx + bw / 2}
                      y={Math.max(12, by - 16)}
                      dy="0.32em"
                      textAnchor="middle"
                      className="num fill-text-1 text-[11px] font-bold"
                    >
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
