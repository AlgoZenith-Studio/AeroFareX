'use client';

import React from 'react';
import { scaleLinear } from 'd3-scale';
import { signed } from '@/lib/format';
import { useWidth } from './useSize';

/**
 * Diverging horizontal bars for attribution contributions (index points).
 * Up = --diverge-up, down = --diverge-down, neutral grey zero rule (rule 3).
 * Every bar is labelled with its value, so polarity never relies on colour.
 */
export const ContributionBars: React.FC<{
  items: { key: string; label: string; contribution: number }[];
  ariaLabel: string;
}> = ({ items, ariaLabel }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const labelW = Math.min(150, width * 0.38);
  const valueW = 56;
  const row = 34;
  const max = Math.max(...items.map((i) => Math.abs(i.contribution)), 1e-6);
  const x = scaleLinear().domain([-max, max]).range([labelW + 4, Math.max(labelW + 40, width - valueW)]);

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={items.length * row + 4} role="img" aria-label={ariaLabel}>
          <line x1={x(0)} x2={x(0)} y1={0} y2={items.length * row + 4} stroke="var(--diverge-mid)" strokeWidth={1.5} />
          {items.map((it, i) => {
            const cy = i * row + row / 2 + 2;
            const x0 = x(Math.min(0, it.contribution));
            const w = Math.max(3, Math.abs(x(it.contribution) - x(0)));
            return (
              <g key={it.key}>
                <text x={0} y={cy} dy="0.32em" className="fill-text-2 text-[12px]">{it.label}</text>
                <rect x={x0} y={cy - 7} width={w} height={14} rx={4} fill={it.contribution >= 0 ? 'var(--diverge-up)' : 'var(--diverge-down)'} />
                <text x={width} y={cy} dy="0.32em" textAnchor="end" className="num fill-text-1 text-[12px] font-medium">
                  {signed(it.contribution, 2)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};
