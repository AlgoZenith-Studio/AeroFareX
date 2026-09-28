'use client';

import React from 'react';
import { scaleLinear } from 'd3-scale';

export const RouteSparkline: React.FC<{
  data: { date: string; value: number }[];
  width?: number;
  height?: number;
}> = ({ data, width = 110, height = 28 }) => {
  if (!data || data.length < 2) {
    return <div className="w-[110px] h-[28px] bg-surface-alt rounded" />;
  }

  const minVal = Math.min(...data.map((d) => d.value));
  const maxVal = Math.max(...data.map((d) => d.value));
  const padding = 2;

  const xScale = scaleLinear()
    .domain([0, data.length - 1])
    .range([padding, width - padding]);

  const yScale = scaleLinear()
    .domain([minVal === maxVal ? minVal - 1 : minVal, maxVal])
    .range([height - padding, padding]);

  const pathPoints = data.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.value).toFixed(1)}`).join(' L ');
  const dPath = `M ${pathPoints}`;

  const lastVal = data[data.length - 1].value;
  const firstVal = data[0].value;
  const isUp = lastVal >= firstVal;
  const strokeColor = isUp ? 'var(--status-warning)' : 'var(--accent)';

  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="14-day index sparkline">
      <path d={dPath} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={xScale(data.length - 1)}
        cy={yScale(lastVal)}
        r={3}
        fill={strokeColor}
      />
    </svg>
  );
};
