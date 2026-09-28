'use client';

import React from 'react';
import clsx from 'clsx';
import { TrendingUp, Clock, ShieldCheck } from 'lucide-react';
import type { LeadTimeMatrix } from '@aerofarex/shared-types';
import { inr, pct, renderValueWithNum } from '@/lib/format';
import { Skeleton } from '@/components/ui/States';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  direction: number;
  note: string;
  hero?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, change, direction, note, hero,
}) => {
  const Trend = direction >= 0 ? TrendingUp : Clock;
  return (
    <article className={clsx('flex min-h-[164px] flex-col p-[clamp(16px,1.4vw,20px)]', hero ? 'card-hero' : 'card')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] leading-tight font-medium">{title}</h2>
        {hero && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold text-black">
            <ShieldCheck size={13} aria-hidden /> Yield Curve
          </span>
        )}
      </div>
      <p
        className={clsx(
          'font-display mt-3 leading-tight truncate max-w-full overflow-hidden whitespace-nowrap',
          value.length > 10
            ? 'text-[clamp(18px,1.6vw,24px)] tracking-tight'
            : value.length > 6
            ? 'text-[clamp(22px,2.1vw,30px)]'
            : 'text-[clamp(32px,2.8vw,44px)]',
        )}
        title={value}
      >
        {renderValueWithNum(value)}
      </p>
      <p className={clsx('mt-3 flex items-center gap-1.5 text-xs', hero ? 'text-text-1' : 'text-text-2')}>
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold',
            hero ? 'bg-white/60 text-black' : 'bg-surface-tint text-sky-900',
          )}
        >
          <Trend size={12} aria-hidden />
          {renderValueWithNum(change)}
        </span>
        {renderValueWithNum(note)}
      </p>
    </article>
  );
};

export const LeadTimeKpiCards: React.FC<{
  matrix?: LeadTimeMatrix;
  isPending?: boolean;
}> = ({ matrix, isPending }) => {
  if (isPending || !matrix) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading lead time metrics">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[172px] rounded-[22px]" />
        ))}
      </div>
    );
  }

  // Calculate yield surge: T+1 avg fare vs T+45 avg fare
  const validCells = matrix.cells.filter((c) => c.total_fare_paise !== null);
  const t1Cells = validCells.filter((c) => c.window === 'T+1');
  const t45Cells = validCells.filter((c) => c.window === 'T+45');

  const avgT1 = t1Cells.length
    ? t1Cells.reduce((acc, c) => acc + (c.total_fare_paise || 0), 0) / t1Cells.length
    : 0;
  const avgT45 = t45Cells.length
    ? t45Cells.reduce((acc, c) => acc + (c.total_fare_paise || 0), 0) / t45Cells.length
    : 1;

  const multiple = avgT45 > 0 ? (avgT1 / avgT45).toFixed(1) : '3.2';

  // Heaviest window
  const heaviestWindow = Object.entries(matrix.weights).sort((a, b) => b[1] - a[1])[0];

  // Imputed cell count
  const missingCount = matrix.cells.filter((c) => c.total_fare_paise === null).length;
  const totalCount = matrix.cells.length;
  const observedPct = ((totalCount - missingCount) / totalCount) * 100;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        hero
        title="T+1 Surge Multiple"
        value={`${multiple}x Price`}
        change={`+${((parseFloat(multiple) - 1) * 100).toFixed(0)}%`}
        direction={1}
        note="last-minute vs advance (T+45)"
      />
      <MetricCard
        title="Core Business Window"
        value={heaviestWindow ? heaviestWindow[0] : 'T+15'}
        change={heaviestWindow ? pct(heaviestWindow[1], 0) : '35%'}
        direction={1}
        note="highest weight in DGCA index"
      />
      <MetricCard
        title="Cheapest Booking Window"
        value="T+45 Advance"
        change={inr(avgT45)}
        direction={-1}
        note="mean advance purchase fare"
      />
      <MetricCard
        title="Cell Observed Rate"
        value={`${observedPct.toFixed(0)}%`}
        change={`${totalCount - missingCount}/${totalCount}`}
        direction={1}
        note={`${missingCount} cells hatched (imputed)`}
      />
    </div>
  );
};
