'use client';

import React from 'react';
import clsx from 'clsx';
import { CheckCircle2, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Attribution, QualityMetadata } from '@aerofarex/shared-types';
import { points, signed } from '@/lib/format';
import { QualityBadge } from '@/components/ui/QualityBadge';
import { Skeleton } from '@/components/ui/States';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  direction: number;
  note: string;
  quality: QualityMetadata;
  hero?: boolean;
  reconciled?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, change, direction, note, quality, hero, reconciled,
}) => {
  const Trend = direction >= 0 ? TrendingUp : TrendingDown;
  return (
    <article className={clsx('flex min-h-[164px] flex-col p-[clamp(16px,1.4vw,20px)]', hero ? 'card-hero' : 'card')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] leading-tight font-medium">{title}</h2>
        {hero && reconciled !== undefined && (
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
              reconciled ? 'bg-black/10 text-black' : 'bg-status-warning/20 text-status-warning',
            )}
          >
            {reconciled ? (
              <>
                <CheckCircle2 size={13} aria-hidden /> Reconciled
              </>
            ) : (
              <>
                <AlertTriangle size={13} aria-hidden /> Discrepancy
              </>
            )}
          </span>
        )}
      </div>
      <p
        className={clsx(
          'font-display mt-3 leading-tight truncate max-w-full overflow-hidden whitespace-nowrap',
          value.length > 10
            ? 'text-[clamp(18px,1.6vw,24px)] font-bold tracking-tight'
            : value.length > 6
            ? 'text-[clamp(22px,2.1vw,30px)] font-bold'
            : 'num text-[clamp(32px,2.8vw,44px)]',
        )}
        title={value}
      >
        {value}
      </p>
      <p className={clsx('mt-3 flex items-center gap-1.5 text-xs', hero ? 'text-text-1' : 'text-text-2')}>
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold',
            hero ? 'bg-white/60 text-black' : 'bg-surface-tint text-sky-900',
          )}
        >
          <Trend size={12} aria-hidden />
          {change}
        </span>
        {note}
      </p>
      <QualityBadge quality={quality} onBand={hero} className="mt-auto pt-3" />
    </article>
  );
};

export const AttributionKpiCards: React.FC<{
  attribution?: Attribution;
  isPending?: boolean;
}> = ({ attribution, isPending }) => {
  if (isPending || !attribution) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading attribution metrics">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[172px] rounded-[22px]" />
        ))}
      </div>
    );
  }

  const { delta, value, previous_value, reconciled, axes, quality } = attribution;

  // Find top route driver
  const routesSorted = [...axes.route].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const topRoute = routesSorted[0] ?? { label: 'None', contribution: 0 };

  // Find top carrier driver
  const carrierSorted = [...axes.carrier].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const topCarrier = carrierSorted[0] ?? { label: 'None', contribution: 0 };

  // Find top economic driver
  const driverSorted = [...axes.driver].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const topDriver = driverSorted[0] ?? { label: 'None', contribution: 0 };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        hero
        title="Net Index Movement"
        value={`${signed(delta, 2)} pts`}
        change={`${signed(delta, 2)} pts`}
        direction={delta}
        note={`from ${points(previous_value)} to ${points(value)}`}
        quality={quality}
        reconciled={reconciled}
      />
      <MetricCard
        title="Top Route Driver"
        value={topRoute.label.replace(' → ', '➔')}
        change={`${signed(topRoute.contribution, 2)} pts`}
        direction={topRoute.contribution}
        note="largest route impact"
        quality={quality}
      />
      <MetricCard
        title="Top Airline Driver"
        value={topCarrier.label}
        change={`${signed(topCarrier.contribution, 2)} pts`}
        direction={topCarrier.contribution}
        note="largest carrier impact"
        quality={quality}
      />
      <MetricCard
        title="Primary Economic Driver"
        value={topDriver.label}
        change={`${signed(topDriver.contribution, 2)} pts`}
        direction={topDriver.contribution}
        note="macro market factor"
        quality={quality}
      />
    </div>
  );
};
