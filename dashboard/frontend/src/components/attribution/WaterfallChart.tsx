'use client';

import React, { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { points, signed } from '@/lib/format';
import { useWidth } from '@/components/charts/useSize';

export interface WaterfallStep {
  key: string;
  label: string;
  contribution: number;
}

export const WaterfallChart: React.FC<{
  previousValue: number;
  value: number;
  steps: WaterfallStep[];
  ariaLabel: string;
}> = ({ previousValue, value, steps, ariaLabel }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Prepare waterfall items
  // Index 0: Previous Day Index (Base)
  // Index 1..N: Step contributions
  // Index N+1: Today's Index (Total)
  let cumulative = previousValue;
  const items = [
    {
      key: '__start__',
      label: 'Previous Day',
      startVal: 0,
      endVal: previousValue,
      contribution: previousValue,
      isTotal: true,
      color: 'var(--text-3)',
    },
    ...steps.map((s) => {
      const startVal = cumulative;
      cumulative += s.contribution;
      const endVal = cumulative;
      return {
        key: s.key,
        label: s.label,
        startVal,
        endVal,
        contribution: s.contribution,
        isTotal: false,
        color: s.contribution >= 0 ? 'var(--diverge-up)' : 'var(--diverge-down)',
      };
    }),
    {
      key: '__end__',
      label: 'Today Index',
      startVal: 0,
      endVal: value,
      contribution: value,
      isTotal: true,
      color: 'var(--bg-sky-400)',
    },
  ];

  // Scale domain calculation
  const allValues = [
    0,
    previousValue,
    value,
    ...items.flatMap((i) => [i.startVal, i.endVal]),
  ];
  const minVal = Math.min(...allValues) * 0.98;
  const maxVal = Math.max(...allValues) * 1.01;

  const height = 300;
  const paddingBottom = 60;
  const paddingTop = 30;
  const paddingLeft = 45;
  const paddingRight = 20;

  const plotWidth = Math.max(100, width - paddingLeft - paddingRight);

  const yScale = scaleLinear().domain([minVal, maxVal]).range([height - paddingBottom, paddingTop]);
  const colWidth = items.length > 0 ? plotWidth / items.length : 40;
  const barWidth = Math.max(12, Math.min(48, colWidth * 0.65));

  return (
    <div ref={ref} className="w-full relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="overflow-visible"
        >
          {/* Grid lines */}
          {yScale.ticks(5).map((t) => (
            <g key={t}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke="var(--line)"
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 8}
                y={yScale(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-text-3 text-[11px] num"
              >
                {points(t, 1)}
              </text>
            </g>
          ))}

          {/* Connectors & Bars */}
          {items.map((item, idx) => {
            const cx = paddingLeft + idx * colWidth + colWidth / 2;
            const x0 = cx - barWidth / 2;

            // Bar top & bottom y-coordinates
            const y1 = yScale(Math.max(item.startVal, item.endVal));
            const y2 = yScale(Math.min(item.startVal, item.endVal));
            const barH = Math.max(3, Math.abs(y2 - y1));

            // Connector to next bar
            const nextItem = items[idx + 1];
            let nextLineY = 0;
            if (nextItem) {
              nextLineY = yScale(item.isTotal ? item.endVal : item.endVal);
            }

            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer transition-opacity"
              >
                {/* Connector line to next step */}
                {nextItem && !item.isTotal && (
                  <line
                    x1={cx}
                    x2={paddingLeft + (idx + 1) * colWidth + colWidth / 2}
                    y1={nextLineY}
                    y2={nextLineY}
                    stroke="var(--text-3)"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                    opacity={0.6}
                  />
                )}

                {/* Rect Bar */}
                <rect
                  x={x0}
                  y={y1}
                  width={barWidth}
                  height={barH}
                  rx={4}
                  fill={item.color}
                  opacity={isHovered ? 1 : 0.88}
                  stroke={isHovered ? 'var(--text-1)' : 'transparent'}
                  strokeWidth={1.5}
                />

                {/* Top Value Label */}
                <text
                  x={cx}
                  y={y1 - 6}
                  textAnchor="middle"
                  className="fill-text-1 text-[11px] font-medium num"
                >
                  {item.isTotal ? points(item.contribution, 1) : signed(item.contribution, 2)}
                </text>

                {/* X-axis Label */}
                <text
                  x={cx}
                  y={height - paddingBottom + 18}
                  textAnchor="middle"
                  className="fill-text-2 text-[11px] font-medium"
                >
                  {item.label.length > 12 ? `${item.label.slice(0, 10)}…` : item.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Floating tooltip */}
      {hoveredIndex !== null && items[hoveredIndex] && (
        <div
          className="absolute z-10 rounded-xl bg-black text-white p-2.5 text-xs shadow-xl pointer-events-none transform -translate-x-1/2"
          style={{
            left: paddingLeft + hoveredIndex * colWidth + colWidth / 2,
            top: 0,
          }}
        >
          <div className="font-bold border-b border-white/20 pb-1 mb-1">
            {items[hoveredIndex].label}
          </div>
          <div>
            {items[hoveredIndex].isTotal ? (
              <span>Index: <strong>{points(items[hoveredIndex].contribution, 2)}</strong></span>
            ) : (
              <>
                <div>Impact: <strong>{signed(items[hoveredIndex].contribution, 2)} pts</strong></div>
                <div className="text-[10px] text-white/70">
                  {points(items[hoveredIndex].startVal, 2)} ➔ {points(items[hoveredIndex].endVal, 2)}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
