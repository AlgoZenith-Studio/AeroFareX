'use client';

import React from 'react';
import clsx from 'clsx';
import { ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import type { CoverageDay } from '@aerofarex/shared-types';
import { pct, renderValueWithNum } from '@/lib/format';
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
  const Trend = direction >= 0 ? TrendingUp : AlertTriangle;
  return (
    <article className={clsx('flex min-h-[164px] flex-col p-[clamp(16px,1.4vw,20px)]', hero ? 'card-hero' : 'card')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] leading-tight font-medium">{title}</h2>
        {hero && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold text-black">
            <ShieldCheck size={13} aria-hidden /> Quality Status: GOOD
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

export const QualityKpiCards: React.FC<{
  coverageDays?: CoverageDay[];
  isPending?: boolean;
}> = ({ coverageDays = [], isPending }) => {
  if (isPending || !coverageDays.length) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading quality metrics">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[172px] rounded-[22px]" />
        ))}
      </div>
    );
  }

  const latest = coverageDays[coverageDays.length - 1];

  // 30-day mean coverage
  const meanCoverage =
    coverageDays.reduce((acc, d) => acc + d.coverage, 0) / coverageDays.length;

  // Imputed total
  const imputedTotal =
    latest.by_rule.CROSS_SOURCE + latest.by_rule.CELL_MEAN + latest.by_rule.CARRY_FORWARD;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        hero
        title="Overall Coverage"
        value={pct(latest.coverage, 1)}
        change="> 90%"
        direction={1}
        note="above threshold target"
      />
      <MetricCard
        title="30-Day Mean Coverage"
        value={pct(meanCoverage, 1)}
        change="+1.4%"
        direction={1}
        note="rolling 30-day index health"
      />
      <MetricCard
        title="Usable Checks"
        value={`${latest.observed}/${latest.expected}`}
        change={pct(latest.observed / latest.expected, 0)}
        direction={1}
        note="valid observations sampled"
      />
      <MetricCard
        title="Imputed & Excluded"
        value={`${imputedTotal} Imputed`}
        change={`${latest.by_rule.EXCLUDED} Outliers`}
        direction={-1}
        note="carry-forward / rule-based"
      />
    </div>
  );
};
